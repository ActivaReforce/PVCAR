import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import type { Alcance } from '../../lib/alcance.js';
import { ESTADO, ROL } from '../../lib/constants.js';
import { offsetDe, ordenSeguro, type Paginacion } from '../../lib/paginacion.js';
import type { ListarColegiosQuery } from './colegios.schemas.js';

export interface CoordinadorResumen {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
}

/** Fila de la lista. Los dos conteos se calculan en SQL, no descargando filas. */
export interface ColegioListado {
  col_id: number;
  col_nombre: string;
  col_direccion: string;
  col_rep_nombre: string | null;
  col_rep_telefono: string | null;
  col_rep_email: string | null;
  col_rep_foto: string | null;
  col_fecha_creacion: string | null;
  coordinadores: CoordinadorResumen[];
  /** Disciplinas activas del colegio. */
  disciplinas: number;
  /** Estudiantes activos matriculados en el colegio. */
  estudiantes: number;
}

export interface ColegioDetalle extends ColegioListado {
  col_fecha_modificacion: string | null;
}

/**
 * El alcance decide que colegios se ven, y aqui es literal: un coordinador ve
 * los suyos, un entrenador los de las disciplinas que da, y Propietario y
 * Admin lo ven todo.
 *
 * En el sistema viejo esta pantalla traia `colegio` entera para todo el mundo
 * y despues buscaba, ordenaba y paginaba en el navegador: un coordinador veia
 * los siete colegios y los datos de contacto de todos.
 */
const F_ALCANCE = `($1::boolean OR c.col_id = ANY($2::int[]))`;

const F_BUSCAR = `($3::text IS NULL OR c.col_nombre ILIKE '%' || $3 || '%'
                                    OR c.col_direccion ILIKE '%' || $3 || '%'
                                    OR c.col_rep_nombre ILIKE '%' || $3 || '%')`;

const COLUMNAS_ORDEN: Record<string, string> = {
  nombre: 'c.col_nombre',
  creacion: 'c.col_fecha_creacion',
  disciplinas: 'disciplinas',
  estudiantes: 'estudiantes',
};

/** Coordinadores y conteos, iguales en la lista y en la ficha. */
const LATERALES = `
    LEFT JOIN LATERAL (
        SELECT json_agg(
                   jsonb_build_object(
                       'usu_id',     u.usu_id,
                       'usu_nombre', u.usu_nombre,
                       'usu_correo', u.usu_correo
                   ) ORDER BY u.usu_nombre
               ) AS coordinadores
        FROM public.colegio_coordinador cc
        JOIN public.usuario u ON u.usu_id = cc.usu_id
        WHERE cc.col_id = c.col_id
    ) co ON TRUE
    LEFT JOIN LATERAL (
        SELECT count(*) AS n
        FROM public.colegio_actividad_horario cah
        WHERE cah.col_id = c.col_id AND cah.est_id = ${ESTADO.ACTIVO}
    ) d ON TRUE
    LEFT JOIN LATERAL (
        SELECT count(*) AS n
        FROM public.nino n
        WHERE n.col_id = c.col_id AND n.est_id = ${ESTADO.ACTIVO}
    ) e ON TRUE
`;

const COLUMNAS = `
        c.col_id,
        c.col_nombre,
        c.col_direccion,
        c.col_rep_nombre,
        c.col_rep_telefono,
        c.col_rep_email,
        c.col_rep_foto,
        c.col_fecha_creacion,
        COALESCE(co.coordinadores, '[]'::json) AS coordinadores,
        COALESCE(d.n, 0)::int AS disciplinas,
        COALESCE(e.n, 0)::int AS estudiantes
`;

export async function listarColegios(
  query: ListarColegiosQuery,
  alcance: Alcance,
): Promise<{ items: ColegioListado[]; total: number }> {
  const columna = ordenSeguro(query.orden, COLUMNAS_ORDEN, 'c.col_nombre');
  const direccion = query.dir === 'desc' ? 'DESC' : 'ASC';
  const paginacion: Paginacion = { page: query.page, limit: query.limit };

  const { rows } = await getPool().query<ColegioListado & { total: string }>(
    `
    SELECT ${COLUMNAS}, count(*) OVER() AS total
    FROM public.colegio c
    ${LATERALES}
    WHERE ${F_ALCANCE} AND ${F_BUSCAR}
    ORDER BY ${columna} ${direccion}, c.col_id ASC
    LIMIT $4 OFFSET $5
    `,
    [
      alcance.global,
      alcance.colegios,
      query.buscar && query.buscar.length > 0 ? query.buscar : null,
      paginacion.limit,
      offsetDe(paginacion),
    ],
  );

  const total = rows.length > 0 ? Number(rows[0]?.total ?? 0) : 0;
  return { items: rows.map(({ total: _t, ...resto }) => resto), total };
}

export async function obtenerColegio(colId: number): Promise<ColegioDetalle | null> {
  const { rows } = await getPool().query<ColegioDetalle>(
    `
    SELECT ${COLUMNAS}, c.col_fecha_modificacion
    FROM public.colegio c
    ${LATERALES}
    WHERE c.col_id = $1
    `,
    [colId],
  );
  return rows[0] ?? null;
}

/**
 * Nombre repetido.
 *
 * La tabla no tiene unicidad — la vieja tampoco — asi que dos colegios podian
 * llamarse igual y nadie distinguirlos en los selectores de Disciplinas o
 * Estudiantes. Se compara normalizado, como el correo de usuario.
 */
export async function existeNombre(
  nombre: string,
  excluyendo: number | null,
  client?: PoolClient,
): Promise<boolean> {
  const ejecutor = client ?? getPool();
  const { rows } = await ejecutor.query(
    `SELECT 1 FROM public.colegio
      WHERE lower(trim(col_nombre)) = lower(trim($1))
        AND ($2::int IS NULL OR col_id <> $2)
      LIMIT 1`,
    [nombre, excluyendo],
  );
  return rows.length > 0;
}

export async function insertarColegio(
  client: PoolClient,
  datos: {
    nombre: string;
    direccion: string;
    repNombre: string | null;
    repTelefono: string | null;
    repEmail: string | null;
    repFoto: string | null;
  },
): Promise<number> {
  const { rows } = await client.query<{ col_id: number }>(
    `INSERT INTO public.colegio
         (col_nombre, col_direccion, col_rep_nombre, col_rep_telefono, col_rep_email, col_rep_foto)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING col_id`,
    [datos.nombre, datos.direccion, datos.repNombre, datos.repTelefono, datos.repEmail, datos.repFoto],
  );
  return rows[0]!.col_id;
}

/**
 * Actualiza solo lo que llega. Los campos del contacto tienen que poder
 * vaciarse, asi que cada uno lleva su bandera de "esto viene en el cuerpo".
 */
export async function actualizarColegio(
  client: PoolClient,
  colId: number,
  campos: {
    nombre?: string;
    direccion?: string;
    repNombre: string | null;
    tocarRepNombre: boolean;
    repTelefono: string | null;
    tocarRepTelefono: boolean;
    repEmail: string | null;
    tocarRepEmail: boolean;
    repFoto: string | null;
    tocarRepFoto: boolean;
  },
): Promise<void> {
  await client.query(
    `UPDATE public.colegio
        SET col_nombre       = COALESCE($2::text, col_nombre),
            col_direccion    = COALESCE($3::text, col_direccion),
            col_rep_nombre   = CASE WHEN $4::boolean  THEN $5::text  ELSE col_rep_nombre   END,
            col_rep_telefono = CASE WHEN $6::boolean  THEN $7::text  ELSE col_rep_telefono END,
            col_rep_email    = CASE WHEN $8::boolean  THEN $9::text  ELSE col_rep_email    END,
            col_rep_foto     = CASE WHEN $10::boolean THEN $11::text ELSE col_rep_foto     END,
            col_fecha_modificacion = now()
      WHERE col_id = $1`,
    [
      colId,
      campos.nombre ?? null,
      campos.direccion ?? null,
      campos.tocarRepNombre,
      campos.repNombre,
      campos.tocarRepTelefono,
      campos.repTelefono,
      campos.tocarRepEmail,
      campos.repEmail,
      campos.tocarRepFoto,
      campos.repFoto,
    ],
  );
}

export async function coordinadoresDe(colId: number, client: PoolClient): Promise<number[]> {
  const { rows } = await client.query<{ usu_id: number }>(
    'SELECT usu_id FROM public.colegio_coordinador WHERE col_id = $1',
    [colId],
  );
  return rows.map((r) => r.usu_id);
}

/**
 * Coordinadores por diferencia.
 *
 * El sistema viejo borraba todos y volvia a insertarlos, fuera de transaccion:
 * si el insert fallaba, el colegio se quedaba sin ningun coordinador y nadie
 * lo deshacia. Ademas perdia la traza de desde cuando lo era.
 */
export async function sincronizarCoordinadores(
  client: PoolClient,
  colId: number,
  deseados: number[],
): Promise<{ agregados: number[]; quitados: number[] }> {
  const actuales = await coordinadoresDe(colId, client);
  const agregados = deseados.filter((id) => !actuales.includes(id));
  const quitados = actuales.filter((id) => !deseados.includes(id));

  if (quitados.length > 0) {
    await client.query(
      'DELETE FROM public.colegio_coordinador WHERE col_id = $1 AND usu_id = ANY($2::int[])',
      [colId, quitados],
    );
  }
  if (agregados.length > 0) {
    await client.query(
      `INSERT INTO public.colegio_coordinador (col_id, usu_id)
       SELECT $1, unnest($2::int[])
       ON CONFLICT DO NOTHING`,
      [colId, agregados],
    );
  }
  return { agregados, quitados };
}

/**
 * De los ids que llegan, cuales NO sirven como coordinador: no existen, estan
 * inactivos o no tienen el rol 2. Devolverlos permite decir exactamente cual
 * falla en vez de un "datos invalidos".
 */
export async function idsQueNoPuedenCoordinar(
  client: PoolClient,
  ids: number[],
): Promise<number[]> {
  if (ids.length === 0) return [];
  const { rows } = await client.query<{ usu_id: number }>(
    `SELECT x.usu_id
       FROM unnest($1::int[]) AS x(usu_id)
      WHERE NOT EXISTS (
          SELECT 1
            FROM public.usuario u
            JOIN public.usuario_rol ur ON ur.usu_id = u.usu_id
           WHERE u.usu_id = x.usu_id
             AND u.est_id = $2
             AND ur.rol_id = $3
      )`,
    [ids, ESTADO.ACTIVO, ROL.COORDINADOR],
  );
  return rows.map((r) => r.usu_id);
}

/** Candidatos para el selector del formulario: activos con rol de coordinador. */
export async function listarCandidatosACoordinador(): Promise<CoordinadorResumen[]> {
  const { rows } = await getPool().query<CoordinadorResumen>(
    `SELECT DISTINCT u.usu_id, u.usu_nombre, u.usu_correo
       FROM public.usuario u
       JOIN public.usuario_rol ur ON ur.usu_id = u.usu_id
      WHERE ur.rol_id = $1 AND u.est_id = $2
      ORDER BY u.usu_nombre`,
    [ROL.COORDINADOR, ESTADO.ACTIVO],
  );
  return rows;
}

/**
 * Que se destruye y que lo impide.
 *
 * Ninguna de las cinco claves foraneas que apuntan a `colegio` tiene cascada
 * (verificado en PVCAR_Dev), asi que Postgres rechazaria el DELETE. La
 * diferencia con el sistema viejo no es el resultado, es el momento: alli se
 * intentaba borrar y se traducia el error 23503 a "No puede eliminar el
 * colegio si existen disciplinas", sin decir cuantas ni mencionar a los
 * alumnos ni las asistencias. Aqui se cuenta antes y se ensena.
 */
export interface ImpactoColegio {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

export async function calcularImpacto(colId: number): Promise<ImpactoColegio> {
  const { rows } = await getPool().query<Record<string, string>>(
    `
    SELECT
        (SELECT count(*) FROM public.colegio_coordinador      WHERE col_id = $1) AS coordinadores,
        (SELECT count(*) FROM public.colegio_actividad_horario WHERE col_id = $1) AS disciplinas,
        (SELECT count(*) FROM public.nino                      WHERE col_id = $1) AS estudiantes,
        (SELECT count(*) FROM public.asistencia_entrenador     WHERE col_id = $1) AS asistencias_entrenador,
        (SELECT count(*) FROM public.asistencia_auxiliar       WHERE col_id = $1) AS asistencias_auxiliar
    `,
    [colId],
  );

  const n = (k: string): number => Number(rows[0]?.[k] ?? 0);

  const bloqueosTodos = {
    disciplinas: n('disciplinas'),
    estudiantes: n('estudiantes'),
    asistencias_entrenador: n('asistencias_entrenador'),
    asistencias_auxiliar: n('asistencias_auxiliar'),
  };

  const bloqueos = Object.fromEntries(
    Object.entries(bloqueosTodos).filter(([, valor]) => valor > 0),
  );

  return {
    eliminables: { coordinadores: n('coordinadores') },
    bloqueos,
    puedeEliminar: Object.keys(bloqueos).length === 0,
  };
}

/** Solo se llama cuando calcularImpacto dijo que no hay bloqueos. */
export async function eliminarColegio(client: PoolClient, colId: number): Promise<void> {
  await client.query('DELETE FROM public.colegio_coordinador WHERE col_id = $1', [colId]);
  await client.query('DELETE FROM public.colegio WHERE col_id = $1', [colId]);
}
