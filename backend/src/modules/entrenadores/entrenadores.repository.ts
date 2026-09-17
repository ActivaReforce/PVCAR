import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import type { Alcance } from '../../lib/alcance.js';
import { ESTADO, ROL, ROLES_AUXILIARES } from '../../lib/constants.js';
import { offsetDe, ordenSeguro, type Paginacion } from '../../lib/paginacion.js';
import { contieneSinTildes } from '../../lib/sql.js';
import type { ListarEntrenadoresQuery } from './entrenadores.schemas.js';

export interface ColegioResumen {
  col_id: number;
  col_nombre: string;
}

export interface EntrenadorListado {
  ent_id: number;
  usu_nombre: string;
  usu_correo: string;
  usu_telefono: string | null;
  usu_foto: string | null;
  ent_cedula: string | null;
  /** Estado de la ficha de entrenador. */
  est_id: number;
  /** Estado del usuario: puede estar inactivo con la ficha activa. */
  usuario_est_id: number;
  /** false si perdio el rol 3 pero conserva la ficha (pasa en los datos reales). */
  tiene_rol: boolean;
  colegios: ColegioResumen[];
  disciplinas: number;
  /** Alumnos con inscripcion activa en sus disciplinas activas. */
  alumnos: number;
  auxiliares: number;
}

export interface AsignacionListada {
  entasig_id: number;
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_nombre: string;
  dia_id: number;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  entasig_fecha_inicio: string;
  entasig_fecha_fin: string | null;
  est_id: number;
  /** Disciplina de baja: la asignacion sigue abierta pero ya no se imparte. */
  disciplina_est_id: number;
  alumnos: number;
}

export interface AuxiliarListado {
  entaux_id: number;
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  rol_id: number | null;
  est_id: number | null;
  /** Avisos sobre datos que ya no cuadran; en los datos reales hay tres. */
  usuario_activo: boolean;
  tiene_rol_auxiliar: boolean;
}

/**
 * Alcance: un coordinador ve los entrenadores que dan clase en sus colegios.
 *
 * Se mira contra las asignaciones **activas**: si alguien dejo de dar clase
 * en ese colegio hace un ano, ya no es asunto suyo. Los entrenadores sin
 * ninguna asignacion no los ve nadie salvo Propietario y Admin — son los que
 * hay que repartir, y repartirlos es decision global.
 */
const F_ALCANCE = `(
    $1::boolean OR EXISTS (
        SELECT 1
        FROM public.entrenador_asignacion ea
        JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
        WHERE ea.ent_id = e.ent_id
          AND ea.est_id = ${ESTADO.ACTIVO}
          AND ea.entasig_fecha_fin IS NULL
          AND cah.col_id = ANY($2::int[])
    )
)`;

const F_BUSCAR = `($3::text IS NULL OR ${contieneSinTildes('u.usu_nombre', '$3')}
                                    OR ${contieneSinTildes("COALESCE(e.ent_cedula, '')", '$3')})`;

const F_COLEGIO = `($4::int[] IS NULL OR EXISTS (
    SELECT 1
    FROM public.entrenador_asignacion ea
    JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
    WHERE ea.ent_id = e.ent_id
      AND ea.est_id = ${ESTADO.ACTIVO}
      AND ea.entasig_fecha_fin IS NULL
      AND cah.col_id = ANY($4::int[])
))`;

const F_SIN_ASIGNAR = `(NOT $5::boolean OR COALESCE(d.n, 0) = 0)`;
const F_ESTADO = `($6::int IS NULL OR e.est_id = $6)`;

const COLUMNAS_ORDEN: Record<string, string> = {
  nombre: 'u.usu_nombre',
  disciplinas: 'disciplinas',
  alumnos: 'alumnos',
  creacion: 'e.ent_fecha_creacion',
};

/**
 * Las disciplinas activas del entrenador, sus colegios y sus alumnos salen de
 * la misma lateral. En la pantalla vieja los colegios se sacaban cruzando
 * arrays en el navegador y el filtro por colegio usaba un **hash del nombre**
 * como identificador.
 */
const LATERALES = `
    LEFT JOIN LATERAL (
        SELECT count(*) AS n,
               COALESCE(sum(al.n), 0) AS alumnos,
               json_agg(DISTINCT jsonb_build_object('col_id', col.col_id, 'col_nombre', col.col_nombre)) AS colegios
        FROM public.entrenador_asignacion ea
        JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
        JOIN public.colegio col ON col.col_id = cah.col_id
        LEFT JOIN LATERAL (
            SELECT count(*) AS n
            FROM public.nino_asignacion na
            WHERE na.colacthor_id = cah.colacthor_id AND na.est_id = ${ESTADO.ACTIVO}
        ) al ON TRUE
        WHERE ea.ent_id = e.ent_id
          AND ea.est_id = ${ESTADO.ACTIVO}
          AND ea.entasig_fecha_fin IS NULL
    ) d ON TRUE
    LEFT JOIN LATERAL (
        SELECT count(*) AS n
        FROM public.entrenador_auxiliar aux
        WHERE aux.ent_id = e.ent_id AND aux.est_id = ${ESTADO.ACTIVO}
    ) aux ON TRUE
    LEFT JOIN LATERAL (
        SELECT true AS tiene
        FROM public.usuario_rol ur
        WHERE ur.usu_id = e.ent_id AND ur.rol_id = ${ROL.ENTRENADOR}
        LIMIT 1
    ) rol ON TRUE
`;

const COLUMNAS = `
        e.ent_id,
        u.usu_nombre,
        u.usu_correo,
        u.usu_telefono,
        u.usu_foto,
        e.ent_cedula,
        e.est_id,
        u.est_id AS usuario_est_id,
        COALESCE(rol.tiene, false) AS tiene_rol,
        COALESCE(d.colegios, '[]'::json) AS colegios,
        COALESCE(d.n, 0)::int AS disciplinas,
        COALESCE(d.alumnos, 0)::int AS alumnos,
        COALESCE(aux.n, 0)::int AS auxiliares
`;

function params(query: ListarEntrenadoresQuery, alcance: Alcance): unknown[] {
  return [
    alcance.global,
    alcance.colegios,
    query.buscar && query.buscar.length > 0 ? query.buscar : null,
    query.colegio ?? null,
    query.sinAsignar === true,
    query.estado ?? null,
  ];
}

export async function listarEntrenadores(
  query: ListarEntrenadoresQuery,
  alcance: Alcance,
): Promise<{ items: EntrenadorListado[]; total: number }> {
  const columna = ordenSeguro(query.orden, COLUMNAS_ORDEN, 'u.usu_nombre');
  const direccion = query.dir === 'desc' ? 'DESC' : 'ASC';
  const paginacion: Paginacion = { page: query.page, limit: query.limit };

  const { rows } = await getPool().query<EntrenadorListado & { total: string }>(
    `
    SELECT ${COLUMNAS}, count(*) OVER() AS total
    FROM public.entrenador e
    JOIN public.usuario u ON u.usu_id = e.ent_id
    ${LATERALES}
    WHERE ${F_ALCANCE} AND ${F_BUSCAR} AND ${F_COLEGIO} AND ${F_SIN_ASIGNAR} AND ${F_ESTADO}
    ORDER BY ${columna} ${direccion}, e.ent_id ASC
    LIMIT $7 OFFSET $8
    `,
    [...params(query, alcance), paginacion.limit, offsetDe(paginacion)],
  );

  const total = rows.length > 0 ? Number(rows[0]?.total ?? 0) : 0;
  return { items: rows.map(({ total: _t, ...resto }) => resto), total };
}

export interface ConteosEntrenadores {
  total: number;
  activos: number;
  inactivos: number;
  sinAsignar: number;
}

export async function contarEntrenadores(
  query: ListarEntrenadoresQuery,
  alcance: Alcance,
): Promise<ConteosEntrenadores> {
  const { rows } = await getPool().query<Record<string, string>>(
    `
    WITH base AS (
        SELECT e.est_id, COALESCE(d.n, 0) AS disciplinas
        FROM public.entrenador e
        JOIN public.usuario u ON u.usu_id = e.ent_id
        ${LATERALES}
        WHERE ${F_ALCANCE} AND ${F_BUSCAR} AND ${F_COLEGIO}
    )
    SELECT count(*)                                           AS total,
           count(*) FILTER (WHERE est_id = ${ESTADO.ACTIVO})  AS activos,
           count(*) FILTER (WHERE est_id <> ${ESTADO.ACTIVO}) AS inactivos,
           count(*) FILTER (WHERE disciplinas = 0)            AS sin_asignar
    FROM base
    `,
    params(query, alcance),
  );

  const n = (k: string): number => Number(rows[0]?.[k] ?? 0);
  return {
    total: n('total'),
    activos: n('activos'),
    inactivos: n('inactivos'),
    sinAsignar: n('sin_asignar'),
  };
}

export async function obtenerEntrenador(
  entId: number,
  client?: PoolClient,
): Promise<EntrenadorListado | null> {
  const ejecutor = client ?? getPool();
  const { rows } = await ejecutor.query<EntrenadorListado>(
    `
    SELECT ${COLUMNAS}
    FROM public.entrenador e
    JOIN public.usuario u ON u.usu_id = e.ent_id
    ${LATERALES}
    WHERE e.ent_id = $1
    `,
    [entId],
  );
  return rows[0] ?? null;
}

/**
 * Asignaciones de un entrenador.
 *
 * `historial = false` devuelve solo las abiertas; `true`, todas. El dato
 * siempre estuvo ahi —39 de las 119 filas estan cerradas— pero no habia
 * ninguna pantalla que lo ensenara: no se podia saber quien dio que y hasta
 * cuando, que es justo lo que se pregunta al revisar una asistencia vieja.
 */
export async function listarAsignaciones(
  entId: number,
  historial: boolean,
): Promise<AsignacionListada[]> {
  const { rows } = await getPool().query<AsignacionListada>(
    `
    SELECT ea.entasig_id,
           ea.colacthor_id,
           cah.col_id,
           col.col_nombre,
           act.act_nombre,
           cah.dia_id,
           dia.dia_nombre,
           cah.colacthor_hora_inicio,
           cah.colacthor_hora_fin,
           ea.entasig_fecha_inicio,
           ea.entasig_fecha_fin,
           ea.est_id,
           cah.est_id AS disciplina_est_id,
           COALESCE(al.n, 0)::int AS alumnos
      FROM public.entrenador_asignacion ea
      JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
      JOIN public.colegio   col ON col.col_id = cah.col_id
      JOIN public.actividad act ON act.act_id = cah.act_id
      JOIN public.dia       dia ON dia.dia_id = cah.dia_id
      LEFT JOIN LATERAL (
          SELECT count(*) AS n FROM public.nino_asignacion na
          WHERE na.colacthor_id = cah.colacthor_id AND na.est_id = ${ESTADO.ACTIVO}
      ) al ON TRUE
     WHERE ea.ent_id = $1
       AND ($2::boolean OR (ea.entasig_fecha_fin IS NULL AND ea.est_id = ${ESTADO.ACTIVO}))
     ORDER BY (ea.entasig_fecha_fin IS NOT NULL), cah.dia_id, cah.colacthor_hora_inicio,
              ea.entasig_fecha_inicio DESC
    `,
    [entId, historial],
  );
  return rows;
}

/** La asignacion activa de esa disciplina, sea de quien sea. */
export async function entrenadorActivoDe(
  client: PoolClient,
  colacthorId: number,
): Promise<{ entasig_id: number; ent_id: number; usu_nombre: string } | null> {
  const { rows } = await client.query<{ entasig_id: number; ent_id: number; usu_nombre: string }>(
    `SELECT ea.entasig_id, ea.ent_id, u.usu_nombre
       FROM public.entrenador_asignacion ea
       JOIN public.usuario u ON u.usu_id = ea.ent_id
      WHERE ea.colacthor_id = $1 AND ea.est_id = $2 AND ea.entasig_fecha_fin IS NULL
      LIMIT 1`,
    [colacthorId, ESTADO.ACTIVO],
  );
  return rows[0] ?? null;
}

export async function tieneAsignacionActiva(
  client: PoolClient,
  entId: number,
  colacthorId: number,
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM public.entrenador_asignacion
      WHERE ent_id = $1 AND colacthor_id = $2 AND est_id = $3 AND entasig_fecha_fin IS NULL
      LIMIT 1`,
    [entId, colacthorId, ESTADO.ACTIVO],
  );
  return rows.length > 0;
}

export async function abrirAsignacion(
  client: PoolClient,
  entId: number,
  colacthorId: number,
  desde: string | null,
): Promise<number> {
  const { rows } = await client.query<{ entasig_id: number }>(
    `INSERT INTO public.entrenador_asignacion
         (ent_id, colacthor_id, entasig_fecha_inicio, entasig_fecha_fin, est_id)
     VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), NULL, $4)
     RETURNING entasig_id`,
    [entId, colacthorId, desde, ESTADO.ACTIVO],
  );
  return rows[0]!.entasig_id;
}

/**
 * Cerrar no borra: pone la fecha de fin y deja la fila.
 *
 * Es historia, no estado. Las asistencias de entrenador de meses pasados se
 * leen contra estas fechas, y borrar la asignacion las dejaria sin explicar.
 */
export async function cerrarAsignacion(
  client: PoolClient,
  entasigId: number,
): Promise<boolean> {
  const { rowCount } = await client.query(
    `UPDATE public.entrenador_asignacion
        SET entasig_fecha_fin = CURRENT_DATE, est_id = $2
      WHERE entasig_id = $1 AND entasig_fecha_fin IS NULL`,
    [entasigId, ESTADO.INACTIVO],
  );
  return (rowCount ?? 0) > 0;
}

export async function obtenerAsignacion(
  client: PoolClient,
  entasigId: number,
): Promise<{ entasig_id: number; ent_id: number; colacthor_id: number; col_id: number } | null> {
  const { rows } = await client.query<{
    entasig_id: number;
    ent_id: number;
    colacthor_id: number;
    col_id: number;
  }>(
    `SELECT ea.entasig_id, ea.ent_id, ea.colacthor_id, cah.col_id
       FROM public.entrenador_asignacion ea
       JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
      WHERE ea.entasig_id = $1`,
    [entasigId],
  );
  return rows[0] ?? null;
}

/**
 * Disciplinas que se le pueden asignar: activas, dentro del alcance y que no
 * tenga ya. Se devuelve tambien la que ya tiene entrenador, marcada con quien,
 * para poder reemplazarlo desde el mismo sitio en vez de adivinar.
 */
export interface DisciplinaDisponible {
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_nombre: string;
  dia_id: number;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  alumnos: number;
  entrenador_actual: string | null;
}

export async function listarDisponibles(
  entId: number,
  alcance: Alcance,
  colegios: number[] | null,
): Promise<DisciplinaDisponible[]> {
  const { rows } = await getPool().query<DisciplinaDisponible>(
    `
    SELECT cah.colacthor_id,
           cah.col_id,
           col.col_nombre,
           act.act_nombre,
           cah.dia_id,
           dia.dia_nombre,
           cah.colacthor_hora_inicio,
           cah.colacthor_hora_fin,
           COALESCE(al.n, 0)::int AS alumnos,
           ocupada.usu_nombre AS entrenador_actual
      FROM public.colegio_actividad_horario cah
      JOIN public.colegio   col ON col.col_id = cah.col_id
      JOIN public.actividad act ON act.act_id = cah.act_id
      JOIN public.dia       dia ON dia.dia_id = cah.dia_id
      LEFT JOIN LATERAL (
          SELECT count(*) AS n FROM public.nino_asignacion na
          WHERE na.colacthor_id = cah.colacthor_id AND na.est_id = ${ESTADO.ACTIVO}
      ) al ON TRUE
      LEFT JOIN LATERAL (
          SELECT u.usu_nombre
          FROM public.entrenador_asignacion ea
          JOIN public.usuario u ON u.usu_id = ea.ent_id
          WHERE ea.colacthor_id = cah.colacthor_id
            AND ea.est_id = ${ESTADO.ACTIVO}
            AND ea.entasig_fecha_fin IS NULL
          LIMIT 1
      ) ocupada ON TRUE
     WHERE cah.est_id = ${ESTADO.ACTIVO}
       AND ($1::boolean OR cah.col_id = ANY($2::int[]))
       AND ($3::int[] IS NULL OR cah.col_id = ANY($3::int[]))
       AND NOT EXISTS (
           SELECT 1 FROM public.entrenador_asignacion mia
           WHERE mia.colacthor_id = cah.colacthor_id
             AND mia.ent_id = $4
             AND mia.est_id = ${ESTADO.ACTIVO}
             AND mia.entasig_fecha_fin IS NULL
       )
     ORDER BY col.col_nombre, cah.dia_id, cah.colacthor_hora_inicio
    `,
    [alcance.global, alcance.colegios, colegios, entId],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Auxiliares

export async function listarAuxiliares(
  entId: number,
  incluirInactivos: boolean,
): Promise<AuxiliarListado[]> {
  const { rows } = await getPool().query<AuxiliarListado>(
    `
    SELECT aux.entaux_id,
           aux.usu_id,
           u.usu_nombre,
           u.usu_correo,
           aux.rol_id,
           aux.est_id,
           (u.est_id = ${ESTADO.ACTIVO}) AS usuario_activo,
           EXISTS (
               SELECT 1 FROM public.usuario_rol ur
               WHERE ur.usu_id = aux.usu_id AND ur.rol_id = ANY($2::int[])
           ) AS tiene_rol_auxiliar
      FROM public.entrenador_auxiliar aux
      JOIN public.usuario u ON u.usu_id = aux.usu_id
     WHERE aux.ent_id = $1
       AND ($3::boolean OR aux.est_id = ${ESTADO.ACTIVO})
     ORDER BY u.usu_nombre
    `,
    [entId, ROLES_AUXILIARES, incluirInactivos],
  );
  return rows;
}

/** Con quien esta atado ya este usuario, si lo esta. */
export async function auxiliarDe(
  client: PoolClient,
  usuId: number,
): Promise<{ entaux_id: number; ent_id: number; usu_nombre: string } | null> {
  const { rows } = await client.query<{ entaux_id: number; ent_id: number; usu_nombre: string }>(
    `SELECT aux.entaux_id, aux.ent_id, u.usu_nombre
       FROM public.entrenador_auxiliar aux
       JOIN public.usuario u ON u.usu_id = aux.ent_id
      WHERE aux.usu_id = $1 AND aux.est_id = $2
      LIMIT 1`,
    [usuId, ESTADO.ACTIVO],
  );
  return rows[0] ?? null;
}

/** El rol de auxiliar que tiene el usuario (6 o 7), o null si no tiene ninguno. */
export async function rolAuxiliarDe(client: PoolClient, usuId: number): Promise<number | null> {
  const { rows } = await client.query<{ rol_id: number }>(
    `SELECT ur.rol_id FROM public.usuario_rol ur
      WHERE ur.usu_id = $1 AND ur.rol_id = ANY($2::int[])
      ORDER BY ur.rol_id LIMIT 1`,
    [usuId, ROLES_AUXILIARES],
  );
  return rows[0]?.rol_id ?? null;
}

export async function atarAuxiliar(
  client: PoolClient,
  entId: number,
  usuId: number,
  rolId: number,
): Promise<number> {
  const { rows } = await client.query<{ entaux_id: number }>(
    `INSERT INTO public.entrenador_auxiliar (usu_id, rol_id, est_id, ent_id)
     VALUES ($1, $2, $3, $4)
     RETURNING entaux_id`,
    [usuId, rolId, ESTADO.ACTIVO, entId],
  );
  return rows[0]!.entaux_id;
}

/**
 * Soltar un auxiliar es baja logica, no DELETE: la fila dice que respaldo a
 * quien y cuando. El sistema viejo borraba, y con eso desaparecia el vinculo
 * que explica las asistencias de auxiliar ya registradas.
 */
export async function soltarAuxiliar(client: PoolClient, entauxId: number): Promise<boolean> {
  const { rowCount } = await client.query(
    'UPDATE public.entrenador_auxiliar SET est_id = $2 WHERE entaux_id = $1 AND est_id = $3',
    [entauxId, ESTADO.INACTIVO, ESTADO.ACTIVO],
  );
  return (rowCount ?? 0) > 0;
}

export async function obtenerAuxiliar(
  client: PoolClient,
  entauxId: number,
): Promise<{ entaux_id: number; ent_id: number; usu_id: number; est_id: number | null } | null> {
  const { rows } = await client.query<{
    entaux_id: number;
    ent_id: number;
    usu_id: number;
    est_id: number | null;
  }>(
    'SELECT entaux_id, ent_id, usu_id, est_id FROM public.entrenador_auxiliar WHERE entaux_id = $1',
    [entauxId],
  );
  return rows[0] ?? null;
}

/** Candidatos: activos con rol 6 o 7 que no respalden ya a nadie. */
export async function listarCandidatosAAuxiliar(): Promise<
  Array<{ usu_id: number; usu_nombre: string; usu_correo: string; rol_id: number }>
> {
  const { rows } = await getPool().query<{
    usu_id: number;
    usu_nombre: string;
    usu_correo: string;
    rol_id: number;
  }>(
    `SELECT DISTINCT ON (u.usu_id) u.usu_id, u.usu_nombre, u.usu_correo, ur.rol_id
       FROM public.usuario u
       JOIN public.usuario_rol ur ON ur.usu_id = u.usu_id
      WHERE ur.rol_id = ANY($1::int[])
        AND u.est_id = $2
        AND NOT EXISTS (
            SELECT 1 FROM public.entrenador_auxiliar aux
            WHERE aux.usu_id = u.usu_id AND aux.est_id = $2
        )
      ORDER BY u.usu_id, ur.rol_id`,
    [ROLES_AUXILIARES, ESTADO.ACTIVO],
  );
  return rows.sort((a, b) => a.usu_nombre.localeCompare(b.usu_nombre));
}

export async function disciplinaActiva(
  client: PoolClient,
  colacthorId: number,
): Promise<{ colacthor_id: number; col_id: number; est_id: number } | null> {
  const { rows } = await client.query<{ colacthor_id: number; col_id: number; est_id: number }>(
    'SELECT colacthor_id, col_id, est_id FROM public.colegio_actividad_horario WHERE colacthor_id = $1',
    [colacthorId],
  );
  return rows[0] ?? null;
}
