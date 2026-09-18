import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import type { Alcance } from '../../lib/alcance.js';
import { ESTADO, ROL } from '../../lib/constants.js';
import { offsetDe, ordenSeguro, type Paginacion } from '../../lib/paginacion.js';
import { contieneSinTildes, paramsUsados } from '../../lib/sql.js';
import type { ListarEstudiantesQuery } from './estudiantes.schemas.js';

export interface EstudianteListado {
  nino_id: number;
  nino_nombre: string;
  nino_edad: number | null;
  nino_foto: string | null;
  col_id: number;
  col_nombre: string;
  catninograd_id: number | null;
  catninograd_nombre: string | null;
  est_id: number;
  nino_fecha_creacion: string | null;
  /** Inscripciones activas. */
  disciplinas: number;
  representantes: number;
}

/**
 * La ficha trae lo que la lista no: cedula, transporte y —sobre todo— la
 * informacion de salud, que es dato sensible de un menor. En el sistema viejo
 * viajaba en la consulta de la lista, junto al `usuario` anidado del padre
 * **con su contrasena dentro**.
 */
export interface EstudianteDetalle extends EstudianteListado {
  nino_cedula: string | null;
  nino_toma_transporte: boolean | null;
  nino_info_salud: string | null;
  nino_otra_info: string | null;
  nino_fecha_modificacion: string | null;
}

export interface InscripcionListada {
  ninoasig_id: number;
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_nombre: string;
  dia_id: number;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  ninoasig_fecha_inscripcion: string;
  ninoasig_fecha_baja: string | null;
  est_id: number;
  disciplina_est_id: number;
  entrenador: string | null;
}

export interface RepresentanteListado {
  ninopadre_id: number;
  padre_id: number;
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  usu_telefono: string | null;
  padre_sector_residencia: string | null;
  usuario_activo: boolean;
}

/**
 * Quien ve a que estudiante.
 *
 * Tres caminos y ninguno se decide en el navegador:
 *   global            -> todos
 *   por colegio       -> el coordinador ve los de sus colegios
 *   por disciplina    -> el entrenador y sus auxiliares ven a los inscritos
 *                        en las disciplinas que imparten
 *
 * El del representante sale de sus hijos y va por `alcance.disciplinas`, que
 * ya los cubre.
 *
 * En el sistema viejo esto era un `.in('col_id', allowedColegioIds)` anadido
 * en el navegador: **si la lista salia vacia el filtro no se aplicaba** y la
 * consulta devolvia los 796 ninos.
 */
const F_ALCANCE = `(
    $1::boolean
    OR n.col_id = ANY($2::int[])
    OR EXISTS (
        SELECT 1 FROM public.nino_asignacion na
        WHERE na.nino_id = n.nino_id
          AND na.est_id = ${ESTADO.ACTIVO}
          AND na.colacthor_id = ANY($3::int[])
    )
)`;

const F_BUSCAR = `($4::text IS NULL OR ${contieneSinTildes('n.nino_nombre', '$4')}
                                    OR ${contieneSinTildes("COALESCE(n.nino_cedula, '')", '$4')})`;

const F_COLEGIO = `($5::int[] IS NULL OR n.col_id = ANY($5::int[]))`;

const F_DISCIPLINA = `($6::int IS NULL OR EXISTS (
    SELECT 1 FROM public.nino_asignacion na
    WHERE na.nino_id = n.nino_id AND na.colacthor_id = $6 AND na.est_id = ${ESTADO.ACTIVO}
))`;

const F_SIN_ASIGNAR = `(NOT $7::boolean OR COALESCE(insc.n, 0) = 0)`;
const F_GRADO = `($8::int IS NULL OR n.catninograd_id = $8)`;
const F_ESTADO = `($9::int IS NULL OR n.est_id = $9)`;

const COLUMNAS_ORDEN: Record<string, string> = {
  nombre: 'n.nino_nombre',
  colegio: 'col.col_nombre',
  grado: 'n.catninograd_id',
  edad: 'n.nino_edad',
  creacion: 'n.nino_fecha_creacion',
};

const LATERALES = `
    LEFT JOIN LATERAL (
        SELECT count(*) AS n
        FROM public.nino_asignacion na
        WHERE na.nino_id = n.nino_id AND na.est_id = ${ESTADO.ACTIVO}
    ) insc ON TRUE
    LEFT JOIN LATERAL (
        SELECT count(*) AS n
        FROM public.nino_padre np
        WHERE np.nino_id = n.nino_id
    ) rep ON TRUE
`;

const COLUMNAS = `
        n.nino_id,
        n.nino_nombre,
        n.nino_edad,
        n.nino_foto,
        n.col_id,
        col.col_nombre,
        n.catninograd_id,
        g.catninograd_nombre,
        n.est_id,
        n.nino_fecha_creacion,
        COALESCE(insc.n, 0)::int AS disciplinas,
        COALESCE(rep.n, 0)::int  AS representantes
`;

const DESDE = `
    FROM public.nino n
    JOIN public.colegio col ON col.col_id = n.col_id
    LEFT JOIN public.categoria_nino_grado g ON g.catninograd_id = n.catninograd_id
    ${LATERALES}
`;

function params(query: ListarEstudiantesQuery, alcance: Alcance): unknown[] {
  return [
    alcance.global,
    alcance.colegios,
    alcance.disciplinas,
    query.buscar && query.buscar.length > 0 ? query.buscar : null,
    query.colegio ?? null,
    query.disciplina ?? null,
    query.sinAsignar === true,
    query.grado ?? null,
    query.estado ?? null,
  ];
}

export async function listarEstudiantes(
  query: ListarEstudiantesQuery,
  alcance: Alcance,
): Promise<{ items: EstudianteListado[]; total: number }> {
  const columna = ordenSeguro(query.orden, COLUMNAS_ORDEN, 'n.nino_nombre');
  const direccion = query.dir === 'desc' ? 'DESC' : 'ASC';
  const paginacion: Paginacion = { page: query.page, limit: query.limit };

  const { rows } = await getPool().query<EstudianteListado & { total: string }>(
    `
    SELECT ${COLUMNAS}, count(*) OVER() AS total
    ${DESDE}
    WHERE ${F_ALCANCE} AND ${F_BUSCAR} AND ${F_COLEGIO} AND ${F_DISCIPLINA}
      AND ${F_SIN_ASIGNAR} AND ${F_GRADO} AND ${F_ESTADO}
    ORDER BY ${columna} ${direccion} NULLS LAST, n.nino_id ASC
    LIMIT $10 OFFSET $11
    `,
    [...params(query, alcance), paginacion.limit, offsetDe(paginacion)],
  );

  const total = rows.length > 0 ? Number(rows[0]?.total ?? 0) : 0;
  return { items: rows.map(({ total: _t, ...resto }) => resto), total };
}

/**
 * Conteos de la pantalla. Como en Usuarios, cada uno ignora a proposito el
 * filtro que el mismo gobierna:
 *   activos / inactivos / total   ignoran el filtro de estado
 *   sinAsignar                    ignora el filtro de disciplina
 * La busqueda, el colegio, el grado y el alcance los respetan todos.
 */
export interface ConteosEstudiantes {
  total: number;
  activos: number;
  inactivos: number;
  sinAsignar: number;
}

export async function contarEstudiantes(
  query: ListarEstudiantesQuery,
  alcance: Alcance,
): Promise<ConteosEstudiantes> {
  const sql = `
    WITH base AS (
        SELECT n.est_id, COALESCE(insc.n, 0) AS inscripciones
        ${DESDE}
        WHERE ${F_ALCANCE} AND ${F_BUSCAR} AND ${F_COLEGIO} AND ${F_GRADO}
    )
    SELECT count(*)                                            AS total,
           count(*) FILTER (WHERE est_id = ${ESTADO.ACTIVO})   AS activos,
           count(*) FILTER (WHERE est_id <> ${ESTADO.ACTIVO})  AS inactivos,
           count(*) FILTER (WHERE inscripciones = 0)           AS sin_asignar
    FROM base
  `;

  // Sin disciplina, "sin asignar" ni estado: esta consulta no los menciona.
  const { rows } = await getPool().query<Record<string, string>>(
    sql,
    paramsUsados(sql, params(query, alcance)),
  );

  const n = (k: string): number => Number(rows[0]?.[k] ?? 0);
  return {
    total: n('total'),
    activos: n('activos'),
    inactivos: n('inactivos'),
    sinAsignar: n('sin_asignar'),
  };
}

export async function obtenerEstudiante(
  ninoId: number,
  client?: PoolClient,
): Promise<EstudianteDetalle | null> {
  const ejecutor = client ?? getPool();
  const { rows } = await ejecutor.query<EstudianteDetalle>(
    `
    SELECT ${COLUMNAS},
           n.nino_cedula,
           n.nino_toma_transporte,
           n.nino_info_salud,
           n.nino_otra_info,
           n.nino_fecha_modificacion
    ${DESDE}
    WHERE n.nino_id = $1
    `,
    [ninoId],
  );
  return rows[0] ?? null;
}

export async function listarInscripciones(
  ninoId: number,
  historial: boolean,
): Promise<InscripcionListada[]> {
  const { rows } = await getPool().query<InscripcionListada>(
    `
    SELECT na.ninoasig_id,
           na.colacthor_id,
           cah.col_id,
           col.col_nombre,
           act.act_nombre,
           cah.dia_id,
           dia.dia_nombre,
           cah.colacthor_hora_inicio,
           cah.colacthor_hora_fin,
           na.ninoasig_fecha_inscripcion,
           na.ninoasig_fecha_baja,
           na.est_id,
           cah.est_id AS disciplina_est_id,
           ent.usu_nombre AS entrenador
      FROM public.nino_asignacion na
      JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = na.colacthor_id
      JOIN public.colegio   col ON col.col_id = cah.col_id
      JOIN public.actividad act ON act.act_id = cah.act_id
      JOIN public.dia       dia ON dia.dia_id = cah.dia_id
      LEFT JOIN LATERAL (
          SELECT u.usu_nombre
          FROM public.entrenador_asignacion ea
          JOIN public.usuario u ON u.usu_id = ea.ent_id
          WHERE ea.colacthor_id = cah.colacthor_id
            AND ea.est_id = ${ESTADO.ACTIVO}
            AND ea.entasig_fecha_fin IS NULL
          LIMIT 1
      ) ent ON TRUE
     WHERE na.nino_id = $1
       AND ($2::boolean OR na.est_id = ${ESTADO.ACTIVO})
     ORDER BY (na.est_id <> ${ESTADO.ACTIVO}), cah.dia_id, cah.colacthor_hora_inicio
    `,
    [ninoId, historial],
  );
  return rows;
}

/** Disciplinas activas del colegio del estudiante en las que no esta inscrito. */
export interface DisciplinaDisponible {
  colacthor_id: number;
  act_nombre: string;
  dia_id: number;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  alumnos: number;
  entrenador: string | null;
  /** true si existe una inscripcion cerrada: reinscribir la reabre. */
  fue_inscrito: boolean;
}

export async function listarDisponibles(ninoId: number): Promise<DisciplinaDisponible[]> {
  const { rows } = await getPool().query<DisciplinaDisponible>(
    `
    SELECT cah.colacthor_id,
           act.act_nombre,
           cah.dia_id,
           dia.dia_nombre,
           cah.colacthor_hora_inicio,
           cah.colacthor_hora_fin,
           COALESCE(al.n, 0)::int AS alumnos,
           ent.usu_nombre AS entrenador,
           EXISTS (
               SELECT 1 FROM public.nino_asignacion vieja
               WHERE vieja.nino_id = $1 AND vieja.colacthor_id = cah.colacthor_id
           ) AS fue_inscrito
      FROM public.nino n
      JOIN public.colegio_actividad_horario cah ON cah.col_id = n.col_id
      JOIN public.actividad act ON act.act_id = cah.act_id
      JOIN public.dia       dia ON dia.dia_id = cah.dia_id
      LEFT JOIN LATERAL (
          SELECT count(*) AS n FROM public.nino_asignacion na2
          WHERE na2.colacthor_id = cah.colacthor_id AND na2.est_id = ${ESTADO.ACTIVO}
      ) al ON TRUE
      LEFT JOIN LATERAL (
          SELECT u.usu_nombre
          FROM public.entrenador_asignacion ea
          JOIN public.usuario u ON u.usu_id = ea.ent_id
          WHERE ea.colacthor_id = cah.colacthor_id
            AND ea.est_id = ${ESTADO.ACTIVO}
            AND ea.entasig_fecha_fin IS NULL
          LIMIT 1
      ) ent ON TRUE
     WHERE n.nino_id = $1
       AND cah.est_id = ${ESTADO.ACTIVO}
       AND NOT EXISTS (
           SELECT 1 FROM public.nino_asignacion activa
           WHERE activa.nino_id = $1
             AND activa.colacthor_id = cah.colacthor_id
             AND activa.est_id = ${ESTADO.ACTIVO}
       )
     ORDER BY cah.dia_id, cah.colacthor_hora_inicio, act.act_nombre
    `,
    [ninoId],
  );
  return rows;
}

export async function inscripcionesActivas(
  client: PoolClient,
  ninoId: number,
): Promise<Array<{ ninoasig_id: number; colacthor_id: number }>> {
  const { rows } = await client.query<{ ninoasig_id: number; colacthor_id: number }>(
    `SELECT ninoasig_id, colacthor_id FROM public.nino_asignacion
      WHERE nino_id = $1 AND est_id = $2`,
    [ninoId, ESTADO.ACTIVO],
  );
  return rows;
}

/**
 * Inscribir.
 *
 * Si ya existe una inscripcion cerrada para ese par, se **reabre** con la
 * funcion `reactivate_nino_asignacion` del esquema en vez de insertar otra
 * fila: el indice unico parcial `ninoasig_una_activa_por_horario` solo admite
 * una activa, y esa funcion ademas devuelve a pendiente las evaluaciones que
 * la baja habia desactivado. Es la misma que usaba el sistema viejo por RPC —
 * aqui se llama desde el backend, dentro de la transaccion.
 *
 * Si no existia, el INSERT dispara el trigger que crea las evaluaciones
 * pendientes de esa disciplina.
 */
export async function inscribir(
  client: PoolClient,
  ninoId: number,
  colacthorId: number,
): Promise<{ ninoasig_id: number; reactivada: boolean }> {
  const { rows: reabierta } = await client.query<{ id: number | null }>(
    'SELECT public.reactivate_nino_asignacion($1, $2) AS id',
    [ninoId, colacthorId],
  );
  if (reabierta[0]?.id) {
    return { ninoasig_id: reabierta[0].id, reactivada: true };
  }

  const { rows } = await client.query<{ ninoasig_id: number }>(
    `INSERT INTO public.nino_asignacion (nino_id, colacthor_id, est_id)
     VALUES ($1, $2, $3)
     RETURNING ninoasig_id`,
    [ninoId, colacthorId, ESTADO.ACTIVO],
  );
  return { ninoasig_id: rows[0]!.ninoasig_id, reactivada: false };
}

/** Dar de baja una inscripcion: fecha de baja, no DELETE. */
export async function darDeBajaInscripcion(
  client: PoolClient,
  ninoasigId: number,
): Promise<void> {
  await client.query(
    `UPDATE public.nino_asignacion
        SET est_id = $2, ninoasig_fecha_baja = now()
      WHERE ninoasig_id = $1 AND est_id = $3`,
    [ninoasigId, ESTADO.INACTIVO, ESTADO.ACTIVO],
  );
}

/** Todas las inscripciones activas de golpe: lo que arrastra la baja del nino. */
export async function cerrarTodasLasInscripciones(
  client: PoolClient,
  ninoId: number,
): Promise<number> {
  const { rowCount } = await client.query(
    `UPDATE public.nino_asignacion
        SET est_id = $2, ninoasig_fecha_baja = now()
      WHERE nino_id = $1 AND est_id = $3`,
    [ninoId, ESTADO.INACTIVO, ESTADO.ACTIVO],
  );
  return rowCount ?? 0;
}

export async function disciplinaDelColegio(
  client: PoolClient,
  colacthorId: number,
): Promise<{ colacthor_id: number; col_id: number; est_id: number } | null> {
  const { rows } = await client.query<{ colacthor_id: number; col_id: number; est_id: number }>(
    'SELECT colacthor_id, col_id, est_id FROM public.colegio_actividad_horario WHERE colacthor_id = $1',
    [colacthorId],
  );
  return rows[0] ?? null;
}

export async function insertarEstudiante(
  client: PoolClient,
  datos: {
    nombre: string;
    colId: number;
    gradoId: number | null;
    edad: number | null;
    cedula: string | null;
    transporte: boolean | null;
    salud: string | null;
    otra: string | null;
    foto: string | null;
  },
): Promise<number> {
  const { rows } = await client.query<{ nino_id: number }>(
    `INSERT INTO public.nino
         (nino_nombre, col_id, catninograd_id, nino_edad, nino_cedula,
          nino_toma_transporte, nino_info_salud, nino_otra_info, nino_foto, est_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING nino_id`,
    [
      datos.nombre,
      datos.colId,
      datos.gradoId,
      datos.edad,
      datos.cedula,
      datos.transporte,
      datos.salud,
      datos.otra,
      datos.foto,
      ESTADO.ACTIVO,
    ],
  );
  return rows[0]!.nino_id;
}

export async function actualizarEstudiante(
  client: PoolClient,
  ninoId: number,
  campos: {
    nombre?: string;
    colId?: number;
    gradoId: number | null;
    tocarGrado: boolean;
    edad: number | null;
    tocarEdad: boolean;
    cedula: string | null;
    tocarCedula: boolean;
    transporte: boolean | null;
    tocarTransporte: boolean;
    salud: string | null;
    tocarSalud: boolean;
    otra: string | null;
    tocarOtra: boolean;
    foto: string | null;
    tocarFoto: boolean;
  },
): Promise<void> {
  await client.query(
    `UPDATE public.nino
        SET nino_nombre           = COALESCE($2::text, nino_nombre),
            col_id                = COALESCE($3::int, col_id),
            catninograd_id        = CASE WHEN $4::boolean  THEN $5::smallint ELSE catninograd_id       END,
            nino_edad             = CASE WHEN $6::boolean  THEN $7::smallint ELSE nino_edad            END,
            nino_cedula           = CASE WHEN $8::boolean  THEN $9::text     ELSE nino_cedula          END,
            nino_toma_transporte  = CASE WHEN $10::boolean THEN $11::boolean ELSE nino_toma_transporte END,
            nino_info_salud       = CASE WHEN $12::boolean THEN $13::text    ELSE nino_info_salud      END,
            nino_otra_info        = CASE WHEN $14::boolean THEN $15::text    ELSE nino_otra_info       END,
            nino_foto             = CASE WHEN $16::boolean THEN $17::text    ELSE nino_foto            END,
            nino_fecha_modificacion = now()
      WHERE nino_id = $1`,
    [
      ninoId,
      campos.nombre ?? null,
      campos.colId ?? null,
      campos.tocarGrado,
      campos.gradoId,
      campos.tocarEdad,
      campos.edad,
      campos.tocarCedula,
      campos.cedula,
      campos.tocarTransporte,
      campos.transporte,
      campos.tocarSalud,
      campos.salud,
      campos.tocarOtra,
      campos.otra,
      campos.tocarFoto,
      campos.foto,
    ],
  );
}

export async function cambiarEstado(
  client: PoolClient,
  ninoId: number,
  estId: number,
): Promise<void> {
  await client.query(
    'UPDATE public.nino SET est_id = $2, nino_fecha_modificacion = now() WHERE nino_id = $1',
    [ninoId, estId],
  );
}

// ---------------------------------------------------------------------------
// Representantes

export async function listarRepresentantes(ninoId: number): Promise<RepresentanteListado[]> {
  const { rows } = await getPool().query<RepresentanteListado>(
    `SELECT np.ninopadre_id,
            p.padre_id,
            u.usu_id,
            u.usu_nombre,
            u.usu_correo,
            u.usu_telefono,
            p.padre_sector_residencia,
            (u.est_id = ${ESTADO.ACTIVO}) AS usuario_activo
       FROM public.nino_padre np
       JOIN public.padre p   ON p.padre_id = np.padre_id
       JOIN public.usuario u ON u.usu_id = p.usu_id
      WHERE np.nino_id = $1
      ORDER BY u.usu_nombre`,
    [ninoId],
  );
  return rows;
}

/** Usuarios activos con rol 4 que tienen ficha de representante. */
export async function listarCandidatosARepresentante(): Promise<
  Array<{ usu_id: number; padre_id: number; usu_nombre: string; usu_correo: string }>
> {
  const { rows } = await getPool().query<{
    usu_id: number;
    padre_id: number;
    usu_nombre: string;
    usu_correo: string;
  }>(
    `SELECT u.usu_id, p.padre_id, u.usu_nombre, u.usu_correo
       FROM public.usuario u
       JOIN public.usuario_rol ur ON ur.usu_id = u.usu_id AND ur.rol_id = $1
       JOIN public.padre p ON p.usu_id = u.usu_id
      WHERE u.est_id = $2
      ORDER BY u.usu_nombre`,
    [ROL.REPRESENTANTE, ESTADO.ACTIVO],
  );
  return rows;
}

export async function padreDeUsuario(
  client: PoolClient,
  usuId: number,
): Promise<{ padre_id: number } | null> {
  const { rows } = await client.query<{ padre_id: number }>(
    `SELECT p.padre_id
       FROM public.padre p
       JOIN public.usuario u ON u.usu_id = p.usu_id
       JOIN public.usuario_rol ur ON ur.usu_id = u.usu_id AND ur.rol_id = $2
      WHERE p.usu_id = $1 AND u.est_id = $3`,
    [usuId, ROL.REPRESENTANTE, ESTADO.ACTIVO],
  );
  return rows[0] ?? null;
}

export async function atarRepresentante(
  client: PoolClient,
  ninoId: number,
  padreId: number,
): Promise<number | null> {
  const { rows } = await client.query<{ ninopadre_id: number }>(
    `INSERT INTO public.nino_padre (nino_id, padre_id)
     SELECT $1, $2
      WHERE NOT EXISTS (
          SELECT 1 FROM public.nino_padre WHERE nino_id = $1 AND padre_id = $2
      )
     RETURNING ninopadre_id`,
    [ninoId, padreId],
  );
  return rows[0]?.ninopadre_id ?? null;
}

export async function soltarRepresentante(
  client: PoolClient,
  ninoId: number,
  ninopadreId: number,
): Promise<boolean> {
  const { rowCount } = await client.query(
    'DELETE FROM public.nino_padre WHERE ninopadre_id = $1 AND nino_id = $2',
    [ninopadreId, ninoId],
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Borrado

/**
 * Que destruye borrar a un estudiante.
 *
 * Las tres FK que apuntan a `nino` son ON DELETE CASCADE, y desde
 * `nino_asignacion` la cascada sigue hasta `evaluacion_nino_pendiente` y
 * `evaluacion_intento`. O sea: **no hay nada que lo impida y se lleva el
 * historial entero**. Es lo que el cliente pidio, pero tiene que verse antes
 * de confirmar — en el sistema viejo ocurria en silencio, porque el codigo
 * solo preveia un error de clave foranea que con estas reglas nunca llega.
 */
export interface ImpactoEstudiante {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

export async function calcularImpacto(ninoId: number): Promise<ImpactoEstudiante> {
  const { rows } = await getPool().query<Record<string, string>>(
    `SELECT
        (SELECT count(*) FROM public.nino_asignacion WHERE nino_id = $1) AS inscripciones,
        (SELECT count(*) FROM public.asistencia_nino WHERE nino_id = $1) AS asistencias,
        (SELECT count(*) FROM public.nino_padre      WHERE nino_id = $1) AS representantes,
        (SELECT count(*)
           FROM public.evaluacion_nino_pendiente enp
           JOIN public.nino_asignacion na ON na.ninoasig_id = enp.ninoasig_id
          WHERE na.nino_id = $1) AS evaluaciones,
        (SELECT count(*)
           FROM public.evaluacion_intento ei
           JOIN public.evaluacion_nino_pendiente enp ON enp.evaninopen_id = ei.evaninopen_id
           JOIN public.nino_asignacion na ON na.ninoasig_id = enp.ninoasig_id
          WHERE na.nino_id = $1) AS intentos`,
    [ninoId],
  );

  const n = (k: string): number => Number(rows[0]?.[k] ?? 0);

  return {
    eliminables: {
      inscripciones: n('inscripciones'),
      asistencias: n('asistencias'),
      evaluaciones: n('evaluaciones'),
      intentos: n('intentos'),
      representantes: n('representantes'),
    },
    bloqueos: {},
    puedeEliminar: true,
  };
}

export async function eliminarEstudiante(client: PoolClient, ninoId: number): Promise<void> {
  await client.query('DELETE FROM public.nino WHERE nino_id = $1', [ninoId]);
}

export interface Grado {
  catninograd_id: number;
  catninograd_nombre: string;
  estudiantes: number;
}

export async function listarGrados(): Promise<Grado[]> {
  const { rows } = await getPool().query<Grado>(
    `SELECT g.catninograd_id,
            g.catninograd_nombre,
            COALESCE(c.n, 0)::int AS estudiantes
       FROM public.categoria_nino_grado g
       LEFT JOIN LATERAL (
           SELECT count(*) AS n FROM public.nino n
           WHERE n.catninograd_id = g.catninograd_id AND n.est_id = ${ESTADO.ACTIVO}
       ) c ON TRUE
      ORDER BY g.catninograd_id`,
  );
  return rows;
}
