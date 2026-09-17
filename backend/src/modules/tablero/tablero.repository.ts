import { getPool } from '../../config/db.js';
import { ESTADO } from '../../lib/constants.js';

/**
 * Consultas del Tablero.
 *
 * ---------------------------------------------------------------------------
 * Una consulta por tablero
 *
 * El sistema viejo montaba cada tablero con entre 9 y 14 peticiones a Supabase
 * desde el navegador, y para los porcentajes de asistencia se traía **todas
 * las filas** de `asistencia_nino` —13 202— para contarlas con un `forEach`.
 * Cada vez que alguien abría la aplicación.
 *
 * Aquí cada tablero es **un solo viaje** y todas las cuentas salen agregadas
 * de Postgres. Lo que llega al navegador son unas decenas de números.
 *
 * ---------------------------------------------------------------------------
 * Qué es del periodo y qué no
 *
 * Los inventarios —cuántos colegios, cuántos alumnos activos— son estado de
 * hoy y no dependen del rango de fechas. Los porcentajes de asistencia **sí**.
 * Mezclarlos sin decirlo es lo que hacía que las cifras del tablero viejo no
 * significaran nada concreto: eran el histórico completo desde 2025.
 */

export interface Asistencia {
  total: number;
  presente: number;
  ausente: number;
  tarde: number;
  justificado: number;
}

/** El mismo agregado en los cuatro tableros. `alias` es la tabla ya filtrada. */
function resumenAsistencia(alias: string): string {
  return `json_build_object(
      'total',       count(*),
      'presente',    count(*) FILTER (WHERE ${alias}.asisest_id = 1),
      'ausente',     count(*) FILTER (WHERE ${alias}.asisest_id = 2),
      'tarde',       count(*) FILTER (WHERE ${alias}.asisest_id = 3),
      'justificado', count(*) FILTER (WHERE ${alias}.asisest_id = 4)
  )`;
}

export interface TableroGeneral {
  colegios: number;
  usuarios: number;
  actividades: number;
  disciplinas: number;
  estudiantes: number;
  evaluaciones: number;
  evaluacionesPendientes: number;
  encuestasPublicadas: number;
  asistenciaAlumnos: Asistencia;
  asistenciaEntrenadores: Asistencia;
}

export async function tableroGeneral(desde: string, hasta: string): Promise<TableroGeneral> {
  const { rows } = await getPool().query<TableroGeneral>(
    `SELECT
        (SELECT count(*) FROM public.colegio)::int                                            AS colegios,
        (SELECT count(*) FROM public.usuario WHERE est_id = ${ESTADO.ACTIVO})::int             AS usuarios,
        (SELECT count(*) FROM public.actividad)::int                                          AS actividades,
        (SELECT count(*) FROM public.colegio_actividad_horario WHERE est_id = ${ESTADO.ACTIVO})::int AS disciplinas,
        (SELECT count(*) FROM public.nino WHERE est_id = ${ESTADO.ACTIVO})::int                AS estudiantes,
        (SELECT count(*) FROM public.evaluacion WHERE est_id = ${ESTADO.ACTIVO})::int          AS evaluaciones,
        (SELECT count(*) FROM public.evaluacion_nino_pendiente WHERE est_id = ${ESTADO.PENDIENTE})::int AS "evaluacionesPendientes",
        (SELECT count(*) FROM public.encuesta WHERE est_id = ${ESTADO.PUBLICADO})::int         AS "encuestasPublicadas",
        (SELECT ${resumenAsistencia('a')} FROM public.asistencia_nino a
          WHERE a.asisnino_fecha BETWEEN $1::date AND $2::date)                                AS "asistenciaAlumnos",
        (SELECT ${resumenAsistencia('a')} FROM public.asistencia_entrenador a
          WHERE a.asisent_fecha BETWEEN $1::date AND $2::date)                                 AS "asistenciaEntrenadores"`,
    [desde, hasta],
  );
  return rows[0]!;
}

export interface ColegioDelCoordinador {
  col_id: number;
  col_nombre: string;
  disciplinas: number;
  estudiantes: number;
  entrenadores: number;
}

export interface TableroCoordinador {
  colegios: ColegioDelCoordinador[];
  evaluacionesAsignadas: number;
  evaluacionesPendientes: number;
  asistenciaAlumnos: Asistencia;
  asistenciaEntrenadores: Asistencia;
}

export async function tableroCoordinador(
  desde: string,
  hasta: string,
  colegios: number[],
  disciplinas: number[],
): Promise<TableroCoordinador> {
  const { rows } = await getPool().query<TableroCoordinador>(
    `SELECT
        COALESCE((
            SELECT json_agg(json_build_object(
                'col_id',       c.col_id,
                'col_nombre',   c.col_nombre,
                'disciplinas',  (SELECT count(*) FROM public.colegio_actividad_horario x
                                  WHERE x.col_id = c.col_id AND x.est_id = ${ESTADO.ACTIVO}),
                'estudiantes',  (SELECT count(*) FROM public.nino n
                                  WHERE n.col_id = c.col_id AND n.est_id = ${ESTADO.ACTIVO}),
                'entrenadores', (SELECT count(DISTINCT ea.ent_id)
                                   FROM public.entrenador_asignacion ea
                                   JOIN public.colegio_actividad_horario x ON x.colacthor_id = ea.colacthor_id
                                  WHERE x.col_id = c.col_id
                                    AND ea.entasig_fecha_fin IS NULL
                                    AND ea.est_id = ${ESTADO.ACTIVO})
            ) ORDER BY c.col_nombre)
            FROM public.colegio c WHERE c.col_id = ANY($3::int[])
        ), '[]'::json) AS colegios,

        (SELECT count(DISTINCT ea.eva_id) FROM public.evaluacion_asignacion ea
          WHERE ea.colacthor_id = ANY($4::int[]) AND ea.est_id = ${ESTADO.ACTIVO})::int AS "evaluacionesAsignadas",

        (SELECT count(*) FROM public.evaluacion_nino_pendiente np
           JOIN public.nino_asignacion na ON na.ninoasig_id = np.ninoasig_id
          WHERE na.colacthor_id = ANY($4::int[]) AND np.est_id = ${ESTADO.PENDIENTE})::int AS "evaluacionesPendientes",

        (SELECT ${resumenAsistencia('a')} FROM public.asistencia_nino a
          WHERE a.asisnino_fecha BETWEEN $1::date AND $2::date
            AND a.colacthor_id = ANY($4::int[]))  AS "asistenciaAlumnos",

        (SELECT ${resumenAsistencia('a')} FROM public.asistencia_entrenador a
          WHERE a.asisent_fecha BETWEEN $1::date AND $2::date
            AND a.col_id = ANY($3::int[]))        AS "asistenciaEntrenadores"`,
    [desde, hasta, colegios, disciplinas],
  );
  return rows[0]!;
}

export interface DisciplinaDelEntrenador {
  colacthor_id: number;
  act_nombre: string;
  col_nombre: string;
  dia_nombre: string;
  hora: string | null;
  alumnos: number;
  pendientes: number;
}

export interface TableroEntrenador {
  disciplinas: DisciplinaDelEntrenador[];
  estudiantes: number;
  evaluacionesPendientes: number;
  asistenciaAlumnos: Asistencia;
  miAsistencia: Asistencia;
}

/**
 * El tablero del entrenador y de sus auxiliares.
 *
 * `disciplinas` sale del alcance, que para un asistente o un respaldo son las
 * de **su titular**: por eso se pasa la lista ya resuelta en vez del `ent_id`.
 * `miAsistencia`, en cambio, es la de la persona que mira, y para un auxiliar
 * vive en `asistencia_auxiliar`, no en `asistencia_entrenador`.
 */
export async function tableroEntrenador(
  desde: string,
  hasta: string,
  disciplinas: number[],
  usuId: number,
  esAuxiliar: boolean,
): Promise<TableroEntrenador> {
  const miAsistencia = esAuxiliar
    ? `(SELECT ${resumenAsistencia('a')} FROM public.asistencia_auxiliar a
         WHERE a.asisaux_fecha BETWEEN $1::date AND $2::date AND a.usu_id = $4)`
    : `(SELECT ${resumenAsistencia('a')} FROM public.asistencia_entrenador a
         WHERE a.asisent_fecha BETWEEN $1::date AND $2::date AND a.ent_id = $4)`;

  const { rows } = await getPool().query<TableroEntrenador>(
    `SELECT
        COALESCE((
            SELECT json_agg(json_build_object(
                'colacthor_id', cah.colacthor_id,
                'act_nombre',   act.act_nombre,
                'col_nombre',   c.col_nombre,
                'dia_nombre',   d.dia_nombre,
                'hora',         to_char(cah.colacthor_hora_inicio, 'HH24:MI'),
                'alumnos',      (SELECT count(*) FROM public.nino_asignacion na
                                  WHERE na.colacthor_id = cah.colacthor_id AND na.est_id = ${ESTADO.ACTIVO}),
                'pendientes',   (SELECT count(*) FROM public.evaluacion_nino_pendiente np
                                   JOIN public.nino_asignacion na2 ON na2.ninoasig_id = np.ninoasig_id
                                  WHERE na2.colacthor_id = cah.colacthor_id AND np.est_id = ${ESTADO.PENDIENTE})
            ) ORDER BY d.dia_id, cah.colacthor_hora_inicio)
            FROM public.colegio_actividad_horario cah
            JOIN public.actividad act ON act.act_id = cah.act_id
            JOIN public.colegio c     ON c.col_id = cah.col_id
            JOIN public.dia d         ON d.dia_id = cah.dia_id
            WHERE cah.colacthor_id = ANY($3::int[])
        ), '[]'::json) AS disciplinas,

        (SELECT count(DISTINCT na.nino_id) FROM public.nino_asignacion na
          WHERE na.colacthor_id = ANY($3::int[]) AND na.est_id = ${ESTADO.ACTIVO})::int AS estudiantes,

        (SELECT count(*) FROM public.evaluacion_nino_pendiente np
           JOIN public.nino_asignacion na ON na.ninoasig_id = np.ninoasig_id
          WHERE na.colacthor_id = ANY($3::int[]) AND np.est_id = ${ESTADO.PENDIENTE})::int AS "evaluacionesPendientes",

        (SELECT ${resumenAsistencia('a')} FROM public.asistencia_nino a
          WHERE a.asisnino_fecha BETWEEN $1::date AND $2::date
            AND a.colacthor_id = ANY($3::int[])) AS "asistenciaAlumnos",

        ${miAsistencia} AS "miAsistencia"`,
    [desde, hasta, disciplinas, usuId],
  );
  return rows[0]!;
}

export interface HijoDelRepresentante {
  nino_id: number;
  nino_nombre: string;
  col_nombre: string | null;
  catninograd_nombre: string | null;
  disciplinas: Array<{ act_nombre: string; dia_nombre: string; hora: string | null }>;
  asistencia: Asistencia;
  evaluacionesPendientes: number;
  evaluacionesHechas: number;
  puntaje: number;
}

export interface TableroRepresentante {
  hijos: HijoDelRepresentante[];
}

export async function tableroRepresentante(
  desde: string,
  hasta: string,
  usuId: number,
): Promise<TableroRepresentante> {
  const { rows } = await getPool().query<{ hijos: HijoDelRepresentante[] }>(
    `SELECT COALESCE((
        SELECT json_agg(json_build_object(
            'nino_id',            n.nino_id,
            'nino_nombre',        n.nino_nombre,
            'col_nombre',         c.col_nombre,
            'catninograd_nombre', g.catninograd_nombre,
            'disciplinas', COALESCE((
                SELECT json_agg(json_build_object(
                    'act_nombre', act.act_nombre,
                    'dia_nombre', d.dia_nombre,
                    'hora',       to_char(cah.colacthor_hora_inicio, 'HH24:MI')
                ) ORDER BY d.dia_id)
                FROM public.nino_asignacion na
                JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = na.colacthor_id
                JOIN public.actividad act ON act.act_id = cah.act_id
                JOIN public.dia d ON d.dia_id = cah.dia_id
                WHERE na.nino_id = n.nino_id AND na.est_id = ${ESTADO.ACTIVO}
            ), '[]'::json),
            'asistencia', (
                SELECT ${resumenAsistencia('a')} FROM public.asistencia_nino a
                WHERE a.nino_id = n.nino_id AND a.asisnino_fecha BETWEEN $1::date AND $2::date
            ),
            'evaluacionesPendientes', (
                SELECT count(*) FROM public.evaluacion_nino_pendiente np
                JOIN public.nino_asignacion na ON na.ninoasig_id = np.ninoasig_id
                WHERE na.nino_id = n.nino_id AND np.est_id = ${ESTADO.PENDIENTE}
            ),
            'evaluacionesHechas', (
                SELECT count(*) FROM public.evaluacion_nino_pendiente np
                JOIN public.nino_asignacion na ON na.ninoasig_id = np.ninoasig_id
                WHERE na.nino_id = n.nino_id AND np.est_id = ${ESTADO.EVALUADO}
            ),
            'puntaje', COALESCE((
                SELECT sum(i.evaint_puntaje_obtenido) FROM public.evaluacion_intento i
                JOIN public.evaluacion_nino_pendiente np ON np.evaninopen_id = i.evaninopen_id
                JOIN public.nino_asignacion na ON na.ninoasig_id = np.ninoasig_id
                WHERE na.nino_id = n.nino_id
            ), 0)
        ) ORDER BY n.nino_nombre)
        FROM public.padre p
        JOIN public.nino_padre np ON np.padre_id = p.padre_id
        JOIN public.nino n ON n.nino_id = np.nino_id
        LEFT JOIN public.colegio c ON c.col_id = n.col_id
        LEFT JOIN public.categoria_nino_grado g ON g.catninograd_id = n.catninograd_id
        WHERE p.usu_id = $3
    ), '[]'::json) AS hijos`,
    [desde, hasta, usuId],
  );
  return { hijos: rows[0]?.hijos ?? [] };
}

export interface PuntoTendencia {
  fecha: string;
  tasa: number;
  registros: number;
}

/**
 * El porcentaje de presentes en cada fecha del periodo.
 *
 * Es la gráfica que el tablero viejo no tenía y que es justo lo que se quiere
 * saber: no "cuánta asistencia hay" sino **si está subiendo o bajando**. Una
 * fila por fecha con clases; los días sin registros no inventan un cero.
 *
 * Global entra con `$3 = true` y los arrays vacíos; el resto filtra por sus
 * disciplinas o sus colegios.
 */
export async function tendenciaAsistencia(
  desde: string,
  hasta: string,
  global: boolean,
  colegios: number[],
  disciplinas: number[],
): Promise<PuntoTendencia[]> {
  const { rows } = await getPool().query<PuntoTendencia>(
    `SELECT to_char(an.asisnino_fecha, 'DD/MM') AS fecha,
            round(count(*) FILTER (WHERE an.asisest_id = 1) * 100.0 / NULLIF(count(*), 0), 1)::float8 AS tasa,
            count(*)::int AS registros
       FROM public.asistencia_nino an
       JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = an.colacthor_id
      WHERE an.asisnino_fecha BETWEEN $1::date AND $2::date
        AND ($3::boolean OR an.colacthor_id = ANY($5::int[]) OR cah.col_id = ANY($4::int[]))
      GROUP BY an.asisnino_fecha
      ORDER BY an.asisnino_fecha`,
    [desde, hasta, global, colegios, disciplinas],
  );
  return rows;
}

/** Hoy en Ecuador, para que el periodo por defecto no salga del navegador. */
export async function hoyEnEcuador(): Promise<string> {
  const { rows } = await getPool().query<{ hoy: string }>(
    `SELECT to_char(now() AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') AS hoy`,
  );
  return rows[0]?.hoy ?? '';
}
