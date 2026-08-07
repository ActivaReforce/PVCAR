import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import type { Alcance } from '../../lib/alcance.js';
import { ESTADO, ROL } from '../../lib/constants.js';
import { offsetDe, ordenSeguro, type Paginacion } from '../../lib/paginacion.js';
import type { ListarUsuariosQuery } from './usuarios.schemas.js';

export interface RolResumen {
  rol_id: number;
  rol_nombre: string;
  rol_titulo: string;
}

/** Fila de la lista. Solo lo que pinta la pantalla: nada de select *. */
export interface UsuarioListado {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  usu_telefono: string | null;
  usu_foto: string | null;
  usu_fecha_creacion: string | null;
  est_id: number;
  roles: RolResumen[];
}

export interface UsuarioDetalle extends UsuarioListado {
  auth_user_id: string | null;
  usu_fecha_modificacion: string | null;
  ent_cedula: string | null;
  ent_est_id: number | null;
  padre_id: number | null;
  padre_sector_residencia: string | null;
}

/**
 * Los conteos de la pantalla, cada uno con su alcance. No es un capricho: si
 * todos salieran del mismo filtro, cada boton se contradiria con el de al lado.
 *
 *   activos / inactivos / total  ignoran el filtro de ESTADO, porque son ellos
 *       los que lo eligen. Si respetaran su propio filtro, al pulsar
 *       "Inactivos" el boton "Activos" mostraria 0.
 *   porRol y totalDelEstado      ignoran la seleccion de ROLES, por lo mismo:
 *       al marcar Entrenador, los demas roles caerian a 0 y no habria forma de
 *       ver cuantos hay en cada uno para elegir.
 *
 * La busqueda y el alcance del usuario los respetan todos.
 */
export interface ConteosUsuarios {
  /** Con los roles seleccionados aplicados; sin el filtro de estado. */
  total: number;
  activos: number;
  inactivos: number;
  /** Por rol, con el estado aplicado y sin la seleccion de roles. */
  porRol: Record<string, number>;
  /** Cuantos hay en el estado elegido, sin filtrar por rol. Es el de "Ver Todos". */
  totalDelEstado: number;
  /**
   * Los que no tienen ningun rol: no salen en ninguna tarjeta, y son la razon
   * de que la suma de las tarjetas quede por debajo del total. Ojo, la suma
   * tampoco tiene por que cuadrar por arriba: quien tenga dos roles cuenta en
   * las dos tarjetas.
   */
  sinRol: number;
}

/**
 * Quien ve a quien.
 *
 * Propietario y Admin ven a todos. El Coordinador tambien tiene usuarios.ver,
 * pero no es global: ve solo a la gente que toca sus colegios — los otros
 * coordinadores del colegio, los entrenadores con asignacion activa alli, los
 * auxiliares de esos entrenadores y los representantes de sus estudiantes.
 * Mas a si mismo, para que su propia ficha no desaparezca de la lista.
 *
 * En el sistema viejo esta pantalla no filtraba nada: cualquiera con la anon
 * key se traia la tabla usuario entera.
 */
const CTE_VISIBLES = `
  visibles AS (
      SELECT cc.usu_id
      FROM public.colegio_coordinador cc
      WHERE cc.col_id = ANY($2::int[])
      UNION
      SELECT ea.ent_id AS usu_id
      FROM public.entrenador_asignacion ea
      JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
      WHERE cah.col_id = ANY($2::int[])
      UNION
      SELECT aux.usu_id
      FROM public.entrenador_auxiliar aux
      JOIN public.entrenador_asignacion ea ON ea.ent_id = aux.ent_id
      JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
      WHERE cah.col_id = ANY($2::int[])
      UNION
      SELECT p.usu_id
      FROM public.padre p
      JOIN public.nino_padre np ON np.padre_id = p.padre_id
      JOIN public.nino_asignacion na ON na.nino_id = np.nino_id
      JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = na.colacthor_id
      WHERE cah.col_id = ANY($2::int[])
      UNION
      SELECT $3::int AS usu_id
  )
`;

/**
 * Los filtros van sueltos y se combinan segun lo que cada consulta necesite
 * ignorar. Los parametros son siempre los mismos y en el mismo orden, para que
 * todas las consultas compartan el array:
 *   $1 global  $2 colegios  $3 yo  $4 buscar  $5 roles  $6 estado
 */
const F_VISIBLE = `($1::boolean OR u.usu_id IN (SELECT usu_id FROM visibles))`;

const F_BUSCAR = `($4::text IS NULL OR u.usu_nombre ILIKE '%' || $4 || '%'
                                   OR u.usu_correo ILIKE '%' || $4 || '%')`;

const SIN_NINGUN_ROL = `NOT EXISTS (SELECT 1 FROM public.usuario_rol ur WHERE ur.usu_id = u.usu_id)`;

/**
 * $7 es el filtro "sin rol": manda sobre $5 porque son excluyentes — o se
 * piden usuarios de ciertos roles, o los que no tienen ninguno.
 */
const F_ROL = `(CASE WHEN $7::boolean THEN ${SIN_NINGUN_ROL}
                     ELSE ($5::int[] IS NULL OR EXISTS (
                               SELECT 1 FROM public.usuario_rol ur
                               WHERE ur.usu_id = u.usu_id AND ur.rol_id = ANY($5::int[])))
                END)`;

const F_ESTADO = `($6::int IS NULL OR u.est_id = $6)`;

const COLUMNAS_ORDEN: Record<string, string> = {
  nombre: 'u.usu_nombre',
  correo: 'u.usu_correo',
  creacion: 'u.usu_fecha_creacion',
  estado: 'u.est_id',
};

function paramsBase(query: ListarUsuariosQuery, alcance: Alcance, yo: number): unknown[] {
  return [
    alcance.global,
    alcance.colegios,
    yo,
    query.buscar && query.buscar.length > 0 ? query.buscar : null,
    query.rol && query.rol.length > 0 ? query.rol : null,
    query.estado ?? null,
    query.sinRol === true,
  ];
}

/**
 * Pagina de usuarios con sus roles. count(*) OVER() devuelve el total del
 * filtro en la misma pasada: el sistema viejo se traia todas las filas solo
 * para contarlas.
 */
export async function listarUsuarios(
  query: ListarUsuariosQuery,
  alcance: Alcance,
  yo: number,
): Promise<{ items: UsuarioListado[]; total: number }> {
  const columna = ordenSeguro(query.orden, COLUMNAS_ORDEN, 'u.usu_nombre');
  const direccion = query.dir === 'desc' ? 'DESC' : 'ASC';
  const paginacion: Paginacion = { page: query.page, limit: query.limit };

  const sql = `
    WITH ${CTE_VISIBLES}
    SELECT
        u.usu_id,
        u.usu_nombre,
        u.usu_correo,
        u.usu_telefono,
        u.usu_foto,
        u.usu_fecha_creacion,
        u.est_id,
        COALESCE(r.roles, '[]'::json) AS roles,
        count(*) OVER() AS total
    FROM public.usuario u
    LEFT JOIN LATERAL (
        SELECT json_agg(
                   jsonb_build_object(
                       'rol_id',     rol.rol_id,
                       'rol_nombre', rol.rol_nombre,
                       'rol_titulo', rol.rol_titulo
                   ) ORDER BY rol.rol_id
               ) AS roles
        FROM public.usuario_rol ur
        JOIN public.rol rol ON rol.rol_id = ur.rol_id
        WHERE ur.usu_id = u.usu_id
    ) r ON TRUE
    WHERE ${F_VISIBLE} AND ${F_BUSCAR} AND ${F_ROL} AND ${F_ESTADO}
    ORDER BY ${columna} ${direccion}, u.usu_id ASC
    LIMIT $8 OFFSET $9
  `;

  const { rows } = await getPool().query<UsuarioListado & { total: string }>(sql, [
    ...paramsBase(query, alcance, yo),
    paginacion.limit,
    offsetDe(paginacion),
  ]);

  const total = rows.length > 0 ? Number(rows[0]?.total ?? 0) : 0;
  const items = rows.map(({ total: _total, ...resto }) => resto);
  return { items, total };
}

/**
 * Conteos de las tarjetas: totales por estado y usuarios por rol.
 *
 * Ignoran el filtro de estado a proposito — las tarjetas dicen "45 activos /
 * 23 inactivos" y tienen que seguir diciendolo cuando se filtra por uno de los
 * dos — y salen de SQL, no de contar el array cargado. En el sistema viejo la
 * tarjeta de cada rol contaba sobre los usuarios que hubiera en memoria: con
 * paginacion de verdad, ese numero seria el de la pagina actual.
 */
export async function contarUsuarios(
  query: ListarUsuariosQuery,
  alcance: Alcance,
  yo: number,
): Promise<ConteosUsuarios> {
  const sql = `
    WITH ${CTE_VISIBLES},
    -- Para los botones de estado: se aplica todo menos el propio estado.
    sin_estado AS (
        SELECT u.usu_id, u.est_id
        FROM public.usuario u
        WHERE ${F_VISIBLE} AND ${F_BUSCAR} AND ${F_ROL}
    ),
    -- Para las tarjetas de rol: se aplica todo menos la seleccion de roles.
    -- 'ninguno' marca a los que no tienen ningun rol; son los que hacian que
    -- la suma de las tarjetas no llegara al total del estado.
    sin_rol AS (
        SELECT u.usu_id, ${SIN_NINGUN_ROL} AS ninguno
        FROM public.usuario u
        WHERE ${F_VISIBLE} AND ${F_BUSCAR} AND ${F_ESTADO}
    )
    SELECT
        (SELECT count(*) FROM sin_estado)                                    AS total,
        (SELECT count(*) FROM sin_estado WHERE est_id = ${ESTADO.ACTIVO})    AS activos,
        (SELECT count(*) FROM sin_estado WHERE est_id = ${ESTADO.INACTIVO})  AS inactivos,
        (SELECT count(*) FROM sin_rol)                                       AS total_del_estado,
        (SELECT count(*) FROM sin_rol WHERE ninguno)                         AS sin_rol,
        COALESCE((
            SELECT json_object_agg(rol_id, n)
            FROM (
                SELECT ur.rol_id, count(*) AS n
                FROM public.usuario_rol ur
                JOIN sin_rol b ON b.usu_id = ur.usu_id
                GROUP BY ur.rol_id
            ) x
        ), '{}'::json) AS por_rol
  `;

  const { rows } = await getPool().query<{
    total: string;
    activos: string;
    inactivos: string;
    total_del_estado: string;
    sin_rol: string;
    por_rol: Record<string, number>;
  }>(sql, paramsBase(query, alcance, yo));

  return {
    total: Number(rows[0]?.total ?? 0),
    activos: Number(rows[0]?.activos ?? 0),
    inactivos: Number(rows[0]?.inactivos ?? 0),
    totalDelEstado: Number(rows[0]?.total_del_estado ?? 0),
    sinRol: Number(rows[0]?.sin_rol ?? 0),
    porRol: rows[0]?.por_rol ?? {},
  };
}

/** Ficha completa. entrenador y padre entran por LEFT JOIN: pueden no existir. */
export async function obtenerUsuario(
  usuId: number,
  client?: PoolClient,
): Promise<UsuarioDetalle | null> {
  const ejecutor = client ?? getPool();
  const { rows } = await ejecutor.query<UsuarioDetalle>(
    `
    SELECT
        u.usu_id,
        u.auth_user_id,
        u.usu_nombre,
        u.usu_correo,
        u.usu_telefono,
        u.usu_foto,
        u.usu_fecha_creacion,
        u.usu_fecha_modificacion,
        u.est_id,
        e.ent_cedula,
        e.est_id  AS ent_est_id,
        p.padre_id,
        p.padre_sector_residencia,
        COALESCE(r.roles, '[]'::json) AS roles
    FROM public.usuario u
    LEFT JOIN public.entrenador e ON e.ent_id = u.usu_id
    LEFT JOIN public.padre p      ON p.usu_id = u.usu_id
    LEFT JOIN LATERAL (
        SELECT json_agg(
                   jsonb_build_object(
                       'rol_id',     rol.rol_id,
                       'rol_nombre', rol.rol_nombre,
                       'rol_titulo', rol.rol_titulo
                   ) ORDER BY rol.rol_id
               ) AS roles
        FROM public.usuario_rol ur
        JOIN public.rol rol ON rol.rol_id = ur.rol_id
        WHERE ur.usu_id = u.usu_id
    ) r ON TRUE
    WHERE u.usu_id = $1
    `,
    [usuId],
  );
  return rows[0] ?? null;
}

/** Ids de rol actuales. Base de la actualizacion por diferencia. */
export async function rolesDe(usuId: number, client: PoolClient): Promise<number[]> {
  const { rows } = await client.query<{ rol_id: number }>(
    'SELECT rol_id FROM public.usuario_rol WHERE usu_id = $1',
    [usuId],
  );
  return rows.map((r) => r.rol_id);
}

export async function existeCorreo(
  correo: string,
  excluyendo: number | null,
  client?: PoolClient,
): Promise<boolean> {
  const ejecutor = client ?? getPool();
  const { rows } = await ejecutor.query(
    `SELECT 1 FROM public.usuario
      WHERE lower(trim(usu_correo)) = lower(trim($1))
        AND ($2::int IS NULL OR usu_id <> $2)
      LIMIT 1`,
    [correo, excluyendo],
  );
  return rows.length > 0;
}

export async function insertarUsuario(
  client: PoolClient,
  datos: {
    authUserId: string;
    nombre: string;
    correo: string;
    telefono: string | null;
    foto: string | null;
  },
): Promise<number> {
  const { rows } = await client.query<{ usu_id: number }>(
    `INSERT INTO public.usuario
         (auth_user_id, usu_nombre, usu_correo, usu_telefono, usu_foto, est_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING usu_id`,
    [
      datos.authUserId,
      datos.nombre,
      datos.correo,
      datos.telefono,
      datos.foto,
      ESTADO.ACTIVO,
    ],
  );
  return rows[0]!.usu_id;
}

/**
 * Actualiza solo los campos presentes. COALESCE con $n::tipo deja pasar el
 * "no lo toques" sin construir el UPDATE a trozos. usu_telefono y usu_foto
 * necesitan poder ponerse a NULL, asi que llevan su propio flag.
 */
export async function actualizarUsuario(
  client: PoolClient,
  usuId: number,
  campos: {
    nombre?: string;
    correo?: string;
    telefono?: string | null;
    tocarTelefono: boolean;
    foto?: string | null;
    tocarFoto: boolean;
  },
): Promise<void> {
  await client.query(
    `UPDATE public.usuario
        SET usu_nombre   = COALESCE($2::text, usu_nombre),
            usu_correo   = COALESCE($3::text, usu_correo),
            usu_telefono = CASE WHEN $4::boolean THEN $5::text ELSE usu_telefono END,
            usu_foto     = CASE WHEN $6::boolean THEN $7::text ELSE usu_foto END,
            usu_fecha_modificacion = now()
      WHERE usu_id = $1`,
    [
      usuId,
      campos.nombre ?? null,
      campos.correo ?? null,
      campos.tocarTelefono,
      campos.telefono ?? null,
      campos.tocarFoto,
      campos.foto ?? null,
    ],
  );
}

/**
 * Roles por diferencia, no borrando todo e insertando de nuevo.
 * El sistema viejo hacia delete + insert: si el insert fallaba, el usuario se
 * quedaba sin ningun rol, y ademas se perdia la traza de desde cuando lo tenia.
 */
export async function sincronizarRoles(
  client: PoolClient,
  usuId: number,
  deseados: number[],
): Promise<{ agregados: number[]; quitados: number[] }> {
  const actuales = await rolesDe(usuId, client);
  const agregados = deseados.filter((r) => !actuales.includes(r));
  const quitados = actuales.filter((r) => !deseados.includes(r));

  if (quitados.length > 0) {
    await client.query(
      'DELETE FROM public.usuario_rol WHERE usu_id = $1 AND rol_id = ANY($2::int[])',
      [usuId, quitados],
    );
  }
  if (agregados.length > 0) {
    await client.query(
      `INSERT INTO public.usuario_rol (usu_id, rol_id)
       SELECT $1, unnest($2::int[])
       ON CONFLICT DO NOTHING`,
      [usuId, agregados],
    );
  }
  return { agregados, quitados };
}

export async function contarAsignacionesActivas(
  client: PoolClient,
  entId: number,
): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT count(*) AS n FROM public.entrenador_asignacion
      WHERE ent_id = $1 AND est_id = $2 AND entasig_fecha_fin IS NULL`,
    [entId, ESTADO.ACTIVO],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function upsertEntrenador(
  client: PoolClient,
  entId: number,
  cedula: string | null,
  estId: number,
): Promise<void> {
  await client.query(
    `INSERT INTO public.entrenador (ent_id, ent_cedula, est_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (ent_id) DO UPDATE
        SET ent_cedula = COALESCE(EXCLUDED.ent_cedula, public.entrenador.ent_cedula),
            est_id     = EXCLUDED.est_id,
            ent_fecha_modificacion = now()`,
    [entId, cedula, estId],
  );
}

/** Baja del entrenador y cierre de sus asignaciones abiertas, en un paso. */
export async function desactivarEntrenador(client: PoolClient, entId: number): Promise<void> {
  await client.query(
    `UPDATE public.entrenador
        SET est_id = $2, ent_fecha_modificacion = now()
      WHERE ent_id = $1`,
    [entId, ESTADO.INACTIVO],
  );
  await client.query(
    `UPDATE public.entrenador_asignacion
        SET est_id = $2, entasig_fecha_fin = CURRENT_DATE
      WHERE ent_id = $1 AND est_id = $3 AND entasig_fecha_fin IS NULL`,
    [entId, ESTADO.INACTIVO, ESTADO.ACTIVO],
  );
}

export async function upsertPadre(
  client: PoolClient,
  usuId: number,
  sector: string | null,
): Promise<void> {
  const { rows } = await client.query<{ padre_id: number }>(
    'SELECT padre_id FROM public.padre WHERE usu_id = $1',
    [usuId],
  );
  if (rows.length > 0) {
    await client.query(
      `UPDATE public.padre
          SET padre_sector_residencia = COALESCE($2, padre_sector_residencia),
              padre_fecha_modificacion = now()
        WHERE usu_id = $1`,
      [usuId, sector],
    );
    return;
  }
  await client.query(
    'INSERT INTO public.padre (usu_id, padre_sector_residencia) VALUES ($1, $2)',
    [usuId, sector],
  );
}

export async function contarHijosDelPadre(client: PoolClient, usuId: number): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT count(*) AS n
       FROM public.nino_padre np
       JOIN public.padre p ON p.padre_id = np.padre_id
      WHERE p.usu_id = $1`,
    [usuId],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function contarColegiosCoordinados(
  client: PoolClient,
  usuId: number,
): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    'SELECT count(*) AS n FROM public.colegio_coordinador WHERE usu_id = $1',
    [usuId],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function borrarPadre(client: PoolClient, usuId: number): Promise<void> {
  await client.query('DELETE FROM public.padre WHERE usu_id = $1', [usuId]);
}

export async function cambiarEstado(
  client: PoolClient,
  usuId: number,
  estId: number,
): Promise<void> {
  await client.query(
    'UPDATE public.usuario SET est_id = $2, usu_fecha_modificacion = now() WHERE usu_id = $1',
    [usuId, estId],
  );
}

/**
 * Que se destruye y que lo impide, antes de borrar a nadie.
 *
 * Dos grupos, y la diferencia esta en el esquema, no en una opinion:
 *   eliminables — cuelgan del usuario con ON DELETE CASCADE o son puro
 *                 vinculo (pertenencias). Desaparecen con el.
 *   bloqueos    — FK sin cascada: historial que otras filas referencian.
 *                 Postgres rechazaria el DELETE, asi que se avisa antes y con
 *                 el motivo, en vez de soltar un error de clave foranea.
 *
 * Es el recuento que el cliente pidio ver en el modal antes de confirmar.
 */
export interface ImpactoEliminacion {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

export async function calcularImpacto(usuId: number): Promise<ImpactoEliminacion> {
  const { rows } = await getPool().query<Record<string, string>>(
    `
    SELECT
        (SELECT count(*) FROM public.usuario_rol         WHERE usu_id = $1) AS roles,
        (SELECT count(*) FROM public.entrenador          WHERE ent_id = $1) AS ficha_entrenador,
        (SELECT count(*) FROM public.padre               WHERE usu_id = $1) AS ficha_representante,
        (SELECT count(*) FROM public.colegio_coordinador WHERE usu_id = $1) AS colegios_coordinados,
        (SELECT count(*) FROM public.entrenador_auxiliar WHERE usu_id = $1) AS es_auxiliar_de,
        (SELECT count(*) FROM public.entrenador_auxiliar WHERE ent_id = $1) AS auxiliares_a_su_cargo,
        (SELECT count(*) FROM public.entrenador_asignacion WHERE ent_id = $1) AS asignaciones,
        (SELECT count(*) FROM public.asistencia_entrenador WHERE ent_id = $1) AS asistencias_propias,
        (SELECT count(*) FROM public.asistencia_nino       WHERE usu_registrador = $1) AS asistencias_registradas,
        (SELECT count(*) FROM public.asistencia_entrenador WHERE usu_registrador = $1) AS asistencias_entrenador_registradas,
        (SELECT count(*) FROM public.asistencia_auxiliar   WHERE usu_registrador = $1) AS asistencias_auxiliar_registradas,
        (SELECT count(*) FROM public.asistencia_auxiliar   WHERE usu_id = $1) AS asistencias_como_auxiliar,
        (SELECT count(*) FROM public.evaluacion            WHERE eva_creador = $1) AS evaluaciones_creadas,
        (SELECT count(*) FROM public.evaluacion_nino_pendiente WHERE usu_id_registrador = $1) AS evaluaciones_registradas,
        (SELECT count(*) FROM public.encuesta              WHERE encu_creador = $1) AS encuestas_creadas,
        (SELECT count(*) FROM public.nino_padre np JOIN public.padre p ON p.padre_id = np.padre_id
          WHERE p.usu_id = $1) AS estudiantes_vinculados,
        (SELECT count(*) FROM public.encuesta_respondida er JOIN public.padre p ON p.padre_id = er.padre_id
          WHERE p.usu_id = $1) AS encuestas_respondidas
    `,
    [usuId],
  );

  const n = (k: string): number => Number(rows[0]?.[k] ?? 0);

  const eliminables = {
    roles: n('roles'),
    ficha_entrenador: n('ficha_entrenador'),
    ficha_representante: n('ficha_representante'),
    colegios_coordinados: n('colegios_coordinados'),
    es_auxiliar_de: n('es_auxiliar_de'),
    auxiliares_a_su_cargo: n('auxiliares_a_su_cargo'),
  };

  const bloqueosTodos = {
    asignaciones: n('asignaciones'),
    asistencias_propias: n('asistencias_propias'),
    asistencias_registradas: n('asistencias_registradas'),
    asistencias_entrenador_registradas: n('asistencias_entrenador_registradas'),
    asistencias_auxiliar_registradas: n('asistencias_auxiliar_registradas'),
    asistencias_como_auxiliar: n('asistencias_como_auxiliar'),
    evaluaciones_creadas: n('evaluaciones_creadas'),
    evaluaciones_registradas: n('evaluaciones_registradas'),
    encuestas_creadas: n('encuestas_creadas'),
    estudiantes_vinculados: n('estudiantes_vinculados'),
    encuestas_respondidas: n('encuestas_respondidas'),
  };

  const bloqueos = Object.fromEntries(
    Object.entries(bloqueosTodos).filter(([, valor]) => valor > 0),
  );

  return { eliminables, bloqueos, puedeEliminar: Object.keys(bloqueos).length === 0 };
}

/**
 * Borrado permanente. Las pertenencias se quitan a mano porque su FK no lleva
 * cascada; el resto (usuario_rol, entrenador, padre) cae solo con el usuario.
 * Solo se llama cuando calcularImpacto dijo que no hay bloqueos.
 */
export async function eliminarUsuario(client: PoolClient, usuId: number): Promise<void> {
  await client.query('DELETE FROM public.colegio_coordinador WHERE usu_id = $1', [usuId]);
  await client.query(
    'DELETE FROM public.entrenador_auxiliar WHERE usu_id = $1 OR ent_id = $1',
    [usuId],
  );
  await client.query('DELETE FROM public.usuario WHERE usu_id = $1', [usuId]);
}

/** Catalogo de roles, para el selector del formulario. */
export async function listarRoles(): Promise<
  Array<{ rol_id: number; rol_nombre: string; rol_titulo: string; rol_descripcion: string | null }>
> {
  const { rows } = await getPool().query(
    `SELECT rol_id, rol_nombre, rol_titulo, rol_descripcion
       FROM public.rol ORDER BY rol_id`,
  );
  return rows;
}

/** Ids de rol que exigen ficha de entrenador o de representante. */
export const ROL_CON_FICHA = {
  entrenador: ROL.ENTRENADOR,
  representante: ROL.REPRESENTANTE,
} as const;
