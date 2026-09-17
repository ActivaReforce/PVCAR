import { ESTADO } from '../../lib/constants.js';
import type { ConsultaReporte, ContextoReporte, FiltrosReporte } from './reportes.definiciones.js';

/**
 * Las gráficas de cada reporte.
 *
 * ---------------------------------------------------------------------------
 * Por qué viven aquí y no en el navegador
 *
 * En el sistema viejo cada reporte tenía una pestaña de análisis de entre 194 y
 * **741 líneas** que se traía las filas y las agrupaba con `reduce` en memoria:
 * la de evaluaciones descargaba las 1 261 pendientes y la de asistencia, las
 * 13 202 marcas, para pintar cuatro barras.
 *
 * Aquí cada gráfica es **una consulta agregada**. Lo que viaja al navegador son
 * las diez o veinte filas que se van a dibujar.
 *
 * ---------------------------------------------------------------------------
 * Una gráfica se declara, no se programa
 *
 * Cada entrada dice qué pregunta responde, qué forma tiene y qué columnas son
 * la etiqueta y las series. El frontend tiene **un componente por forma**, no
 * uno por gráfica, así que añadir una es añadir una consulta aquí.
 *
 * La forma sale del trabajo que hace el dato, no del gusto:
 *
 *   magnitud entre categorías  -> barras, una sola serie, un solo color
 *   evolución en el tiempo     -> línea
 *   composición de un total    -> apilada al 100 %
 *   cómo se reparten los valores -> histograma
 *
 * Ninguna lleva dos ejes verticales. Nunca. Dos medidas de escalas distintas
 * son dos gráficas.
 */

export type FormaGrafica = 'linea' | 'barras' | 'apilada100' | 'histograma';

export interface SerieGrafica {
  clave: string;
  nombre: string;
}

export interface DefinicionGrafica {
  id: string;
  titulo: string;
  /** Qué pregunta responde, en una línea. Se enseña bajo el título. */
  descripcion: string;
  forma: FormaGrafica;
  /** Columna que va en el eje de categorías. */
  etiqueta: string;
  series: SerieGrafica[];
  formato: 'porcentaje' | 'entero';
  /** Usa la escala ordenada de asistencia en vez de los tonos categóricos. */
  escala?: 'asistencia';
  /** Aviso honesto: qué ignora esta gráfica de los filtros de pantalla. */
  nota?: string;
  construir: (f: FiltrosReporte, ctx: ContextoReporte) => ConsultaReporte;
}

const textoONulo = (v: string | undefined) => (v && v.trim().length > 0 ? v.trim() : null);
const oNulo = <T>(v: T | undefined): T | null => v ?? null;

/** Los cuatro estados, contados y en porcentaje sobre el total del grupo. */
function composicion(alias: string): string {
  return `
      count(*) FILTER (WHERE ${alias}.asisest_id = 1)::int AS presente,
      count(*) FILTER (WHERE ${alias}.asisest_id = 2)::int AS ausente,
      count(*) FILTER (WHERE ${alias}.asisest_id = 3)::int AS tarde,
      count(*) FILTER (WHERE ${alias}.asisest_id = 4)::int AS justificado`;
}

/** El porcentaje de presentes sobre el total del grupo, a un decimal. */
function tasaPresencia(alias: string): string {
  return `round(count(*) FILTER (WHERE ${alias}.asisest_id = 1) * 100.0 / NULLIF(count(*), 0), 1)::float8`;
}

const SERIES_ASISTENCIA: SerieGrafica[] = [
  { clave: 'presente', nombre: 'Presente' },
  { clave: 'tarde', nombre: 'Tarde' },
  { clave: 'justificado', nombre: 'Justificado' },
  { clave: 'ausente', nombre: 'Ausente' },
];

// ---------------------------------------------------------------------------

const usuariosPorRol: DefinicionGrafica = {
  id: 'usuarios-por-rol',
  titulo: 'Usuarios por rol',
  descripcion: 'Cuánta gente hay de cada rol. Quien tiene dos roles cuenta en los dos.',
  forma: 'barras',
  etiqueta: 'rol',
  series: [{ clave: 'usuarios', nombre: 'Usuarios' }],
  formato: 'entero',
  nota: 'Los usuarios sin ningún rol no aparecen: por eso la suma puede no dar el total.',
  construir: (f, ctx) => ({
    sql: `
      WITH visibles AS (
          SELECT cc.usu_id FROM public.colegio_coordinador cc WHERE cc.col_id = ANY($2::int[])
          UNION
          SELECT ea.ent_id FROM public.entrenador_asignacion ea
            JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
           WHERE cah.col_id = ANY($2::int[])
          UNION
          SELECT aux.usu_id FROM public.entrenador_auxiliar aux
            JOIN public.entrenador_asignacion ea ON ea.ent_id = aux.ent_id
            JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
           WHERE cah.col_id = ANY($2::int[])
      )
      SELECT r.rol_titulo AS rol, count(*)::int AS usuarios
        FROM public.usuario u
        JOIN public.usuario_rol ur ON ur.usu_id = u.usu_id
        JOIN public.rol r ON r.rol_id = ur.rol_id
       WHERE ($1::boolean OR u.usu_id IN (SELECT usu_id FROM visibles) OR u.usu_id = $3)
         AND ($4::int IS NULL OR u.est_id = $4)
       GROUP BY r.rol_id, r.rol_titulo
       ORDER BY usuarios DESC`,
    params: [ctx.global, ctx.colegios, ctx.actorId, oNulo(f.estado)],
  }),
};

const alumnosPorColegio: DefinicionGrafica = {
  id: 'alumnos-por-colegio',
  titulo: 'Alumnos activos por colegio',
  descripcion: 'Dónde está la matrícula.',
  forma: 'barras',
  etiqueta: 'colegio',
  series: [{ clave: 'alumnos', nombre: 'Alumnos' }],
  formato: 'entero',
  construir: (f, ctx) => ({
    sql: `
      SELECT c.col_nombre AS colegio,
             count(n.nino_id) FILTER (WHERE n.est_id = ${ESTADO.ACTIVO})::int AS alumnos
        FROM public.colegio c
        LEFT JOIN public.nino n ON n.col_id = c.col_id
       WHERE ($1::boolean OR c.col_id = ANY($2::int[]))
         AND ($3::int[] IS NULL OR c.col_id = ANY($3::int[]))
       GROUP BY c.col_id, c.col_nombre
       ORDER BY alumnos DESC`,
    params: [ctx.global, ctx.colegios, oNulo(f.colegio)],
  }),
};

const disciplinasPorColegio: DefinicionGrafica = {
  id: 'disciplinas-por-colegio',
  titulo: 'Disciplinas activas por colegio',
  descripcion: 'Cuánta oferta tiene cada colegio.',
  forma: 'barras',
  etiqueta: 'colegio',
  series: [{ clave: 'disciplinas', nombre: 'Disciplinas' }],
  formato: 'entero',
  construir: (f, ctx) => ({
    sql: `
      SELECT c.col_nombre AS colegio,
             count(cah.colacthor_id) FILTER (WHERE cah.est_id = ${ESTADO.ACTIVO})::int AS disciplinas
        FROM public.colegio c
        LEFT JOIN public.colegio_actividad_horario cah ON cah.col_id = c.col_id
       WHERE ($1::boolean OR c.col_id = ANY($2::int[]))
         AND ($3::int[] IS NULL OR c.col_id = ANY($3::int[]))
       GROUP BY c.col_id, c.col_nombre
       ORDER BY disciplinas DESC`,
    params: [ctx.global, ctx.colegios, oNulo(f.colegio)],
  }),
};

const disciplinasPorActividad: DefinicionGrafica = {
  id: 'disciplinas-por-actividad',
  titulo: 'Actividades más impartidas',
  descripcion: 'En cuántas disciplinas activas se usa cada actividad.',
  forma: 'barras',
  etiqueta: 'actividad',
  series: [{ clave: 'disciplinas', nombre: 'Disciplinas' }],
  formato: 'entero',
  nota: 'Las 15 primeras. El resto están en la tabla.',
  construir: (f) => ({
    sql: `
      SELECT a.act_nombre AS actividad,
             count(cah.colacthor_id) FILTER (WHERE cah.est_id = ${ESTADO.ACTIVO})::int AS disciplinas
        FROM public.actividad a
        LEFT JOIN public.colegio_actividad_horario cah ON cah.act_id = a.act_id
       WHERE ($1::text IS NULL OR a.act_nombre ILIKE '%' || $1 || '%')
       GROUP BY a.act_id, a.act_nombre
      HAVING count(cah.colacthor_id) FILTER (WHERE cah.est_id = ${ESTADO.ACTIVO}) > 0
       ORDER BY disciplinas DESC
       LIMIT 15`,
    params: [textoONulo(f.buscar)],
  }),
};

const disciplinasPorDia: DefinicionGrafica = {
  id: 'disciplinas-por-dia',
  titulo: 'Carga por día de la semana',
  descripcion: 'Cuántas disciplinas activas se imparten cada día.',
  forma: 'barras',
  etiqueta: 'dia',
  series: [{ clave: 'disciplinas', nombre: 'Disciplinas' }],
  formato: 'entero',
  construir: (f, ctx) => ({
    sql: `
      SELECT d.dia_nombre AS dia,
             count(cah.colacthor_id)::int AS disciplinas
        FROM public.dia d
        LEFT JOIN public.colegio_actividad_horario cah
               ON cah.dia_id = d.dia_id
              AND cah.est_id = ${ESTADO.ACTIVO}
              AND ($1::boolean OR cah.colacthor_id = ANY($2::int[]) OR cah.col_id = ANY($3::int[]))
              AND ($4::int[] IS NULL OR cah.col_id = ANY($4::int[]))
       GROUP BY d.dia_id, d.dia_nombre
       ORDER BY d.dia_id`,
    params: [ctx.global, ctx.disciplinas, ctx.colegios, oNulo(f.colegio)],
  }),
};

const alumnosPorDisciplina: DefinicionGrafica = {
  id: 'alumnos-por-disciplina',
  titulo: 'Disciplinas con más alumnos',
  descripcion: 'Dónde se concentran las inscripciones activas.',
  forma: 'barras',
  etiqueta: 'disciplina',
  series: [{ clave: 'alumnos', nombre: 'Alumnos' }],
  formato: 'entero',
  nota: 'Las 15 primeras.',
  construir: (f, ctx) => ({
    sql: `
      SELECT a.act_nombre || ' · ' || c.col_nombre AS disciplina,
             count(na.ninoasig_id)::int AS alumnos
        FROM public.colegio_actividad_horario cah
        JOIN public.actividad a ON a.act_id = cah.act_id
        JOIN public.colegio c   ON c.col_id = cah.col_id
        LEFT JOIN public.nino_asignacion na
               ON na.colacthor_id = cah.colacthor_id AND na.est_id = ${ESTADO.ACTIVO}
       WHERE cah.est_id = ${ESTADO.ACTIVO}
         AND ($1::boolean OR cah.colacthor_id = ANY($2::int[]) OR cah.col_id = ANY($3::int[]))
         AND ($4::int[] IS NULL OR cah.col_id = ANY($4::int[]))
       GROUP BY cah.colacthor_id, a.act_nombre, c.col_nombre
      HAVING count(na.ninoasig_id) > 0
       ORDER BY alumnos DESC
       LIMIT 15`,
    params: [ctx.global, ctx.disciplinas, ctx.colegios, oNulo(f.colegio)],
  }),
};

const alumnosPorEntrenador: DefinicionGrafica = {
  id: 'alumnos-por-entrenador',
  titulo: 'Carga de alumnos por entrenador',
  descripcion: 'Cuántos alumnos distintos tiene cada uno en sus disciplinas vigentes.',
  forma: 'barras',
  etiqueta: 'entrenador',
  series: [{ clave: 'alumnos', nombre: 'Alumnos' }],
  formato: 'entero',
  nota: 'Los 15 con más carga.',
  construir: (f, ctx) => ({
    sql: `
      WITH suyas AS (
          SELECT ea.ent_id, ea.colacthor_id, cah.col_id
            FROM public.entrenador_asignacion ea
            JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
           WHERE ea.entasig_fecha_fin IS NULL AND ea.est_id = ${ESTADO.ACTIVO}
      )
      SELECT u.usu_nombre AS entrenador,
             count(DISTINCT na.nino_id)::int AS alumnos
        FROM public.entrenador en
        JOIN public.usuario u ON u.usu_id = en.ent_id
        JOIN suyas s ON s.ent_id = en.ent_id
        LEFT JOIN public.nino_asignacion na
               ON na.colacthor_id = s.colacthor_id AND na.est_id = ${ESTADO.ACTIVO}
       WHERE ($1::boolean OR s.colacthor_id = ANY($2::int[]) OR s.col_id = ANY($3::int[]))
         AND ($4::int[] IS NULL OR s.col_id = ANY($4::int[]))
         AND ($5::int IS NULL OR en.est_id = $5)
       GROUP BY en.ent_id, u.usu_nombre
      HAVING count(DISTINCT na.nino_id) > 0
       ORDER BY alumnos DESC
       LIMIT 15`,
    params: [ctx.global, ctx.disciplinas, ctx.colegios, oNulo(f.colegio), oNulo(f.estado)],
  }),
};

const alumnosPorGrado: DefinicionGrafica = {
  id: 'alumnos-por-grado',
  titulo: 'Alumnos por grado',
  descripcion: 'Cómo se reparte la matrícula activa por grado escolar.',
  forma: 'barras',
  etiqueta: 'grado',
  series: [{ clave: 'alumnos', nombre: 'Alumnos' }],
  formato: 'entero',
  construir: (f, ctx) => ({
    sql: `
      SELECT COALESCE(g.catninograd_nombre, 'Sin grado') AS grado,
             count(*)::int AS alumnos
        FROM public.nino n
        LEFT JOIN public.categoria_nino_grado g ON g.catninograd_id = n.catninograd_id
       WHERE n.est_id = ${ESTADO.ACTIVO}
         AND ($1::boolean
              OR n.col_id = ANY($3::int[])
              OR EXISTS (SELECT 1 FROM public.nino_asignacion na
                          WHERE na.nino_id = n.nino_id
                            AND na.est_id = ${ESTADO.ACTIVO}
                            AND na.colacthor_id = ANY($2::int[])))
         AND ($4::int[] IS NULL OR n.col_id = ANY($4::int[]))
       GROUP BY g.catninograd_id, g.catninograd_nombre
       ORDER BY alumnos DESC`,
    params: [ctx.global, ctx.disciplinas, ctx.colegios, oNulo(f.colegio)],
  }),
};

// ---------------------------------------------------------------------------
// Asistencia

const asistenciaAlumnosPorFecha: DefinicionGrafica = {
  id: 'asistencia-alumnos-fecha',
  titulo: 'Asistencia en el tiempo',
  descripcion: 'Porcentaje de presentes en cada fecha del rango.',
  forma: 'linea',
  etiqueta: 'fecha',
  series: [{ clave: 'tasa', nombre: '% presentes' }],
  formato: 'porcentaje',
  nota: 'Cada punto es una fecha con clases. Los días sin registros no aparecen.',
  construir: (f, ctx) => ({
    sql: `
      SELECT to_char(an.asisnino_fecha, 'DD/MM')  AS fecha,
             ${tasaPresencia('an')}               AS tasa,
             count(*)::int                        AS registros
        FROM public.asistencia_nino an
        JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = an.colacthor_id
       WHERE an.asisnino_fecha BETWEEN $4::date AND $5::date
         AND ($1::boolean OR an.colacthor_id = ANY($2::int[]) OR cah.col_id = ANY($3::int[]))
         AND ($6::int[] IS NULL OR cah.col_id = ANY($6::int[]))
         AND ($7::int IS NULL OR an.colacthor_id = $7)
       GROUP BY an.asisnino_fecha
       ORDER BY an.asisnino_fecha`,
    params: [
      ctx.global,
      ctx.disciplinas,
      ctx.colegios,
      f.desde,
      f.hasta,
      oNulo(f.colegio),
      oNulo(f.disciplina),
    ],
  }),
};

const composicionAlumnosPorColegio: DefinicionGrafica = {
  id: 'asistencia-alumnos-colegio',
  titulo: 'Composición de la asistencia por colegio',
  descripcion: 'Cómo se reparten los cuatro estados en cada colegio, sobre el total de cada uno.',
  forma: 'apilada100',
  etiqueta: 'colegio',
  series: SERIES_ASISTENCIA,
  formato: 'porcentaje',
  escala: 'asistencia',
  construir: (f, ctx) => ({
    sql: `
      SELECT c.col_nombre AS colegio, ${composicion('an')}
        FROM public.asistencia_nino an
        JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = an.colacthor_id
        JOIN public.colegio c ON c.col_id = cah.col_id
       WHERE an.asisnino_fecha BETWEEN $4::date AND $5::date
         AND ($1::boolean OR an.colacthor_id = ANY($2::int[]) OR cah.col_id = ANY($3::int[]))
         AND ($6::int[] IS NULL OR cah.col_id = ANY($6::int[]))
         AND ($7::int IS NULL OR an.colacthor_id = $7)
       GROUP BY c.col_id, c.col_nombre
       ORDER BY c.col_nombre`,
    params: [
      ctx.global,
      ctx.disciplinas,
      ctx.colegios,
      f.desde,
      f.hasta,
      oNulo(f.colegio),
      oNulo(f.disciplina),
    ],
  }),
};

const asistenciaPorDiaSemana: DefinicionGrafica = {
  id: 'asistencia-alumnos-dia',
  titulo: 'Asistencia por día de la semana',
  descripcion: 'Si hay días en los que se falta más. Es lo que no se podía ver antes.',
  forma: 'barras',
  etiqueta: 'dia',
  series: [{ clave: 'tasa', nombre: '% presentes' }],
  formato: 'porcentaje',
  construir: (f, ctx) => ({
    sql: `
      SELECT d.dia_nombre                   AS dia,
             ${tasaPresencia('an')}         AS tasa,
             count(*)::int                  AS registros
        FROM public.asistencia_nino an
        JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = an.colacthor_id
        JOIN public.dia d ON d.dia_id = cah.dia_id
       WHERE an.asisnino_fecha BETWEEN $4::date AND $5::date
         AND ($1::boolean OR an.colacthor_id = ANY($2::int[]) OR cah.col_id = ANY($3::int[]))
         AND ($6::int[] IS NULL OR cah.col_id = ANY($6::int[]))
         AND ($7::int IS NULL OR an.colacthor_id = $7)
       GROUP BY d.dia_id, d.dia_nombre
       ORDER BY d.dia_id`,
    params: [
      ctx.global,
      ctx.disciplinas,
      ctx.colegios,
      f.desde,
      f.hasta,
      oNulo(f.colegio),
      oNulo(f.disciplina),
    ],
  }),
};

const asistenciaEntrenadoresPorFecha: DefinicionGrafica = {
  id: 'asistencia-entrenadores-fecha',
  titulo: 'Asistencia del personal en el tiempo',
  descripcion: 'Porcentaje de presentes por fecha, titulares y auxiliares juntos.',
  forma: 'linea',
  etiqueta: 'fecha',
  series: [{ clave: 'tasa', nombre: '% presentes' }],
  formato: 'porcentaje',
  construir: (f, ctx) => ({
    sql: `
      WITH marcas AS (
          SELECT ae.asisent_fecha AS fecha, ae.asisest_id, ae.col_id
            FROM public.asistencia_entrenador ae
           WHERE ae.asisent_fecha BETWEEN $3::date AND $4::date
             AND ($1::boolean OR ae.col_id = ANY($2::int[]))
             AND ($5::int[] IS NULL OR ae.col_id = ANY($5::int[]))
          UNION ALL
          SELECT aa.asisaux_fecha, aa.asisest_id, aa.col_id
            FROM public.asistencia_auxiliar aa
           WHERE aa.asisaux_fecha BETWEEN $3::date AND $4::date
             AND ($1::boolean OR aa.col_id = ANY($2::int[]))
             AND ($5::int[] IS NULL OR aa.col_id = ANY($5::int[]))
      )
      SELECT to_char(m.fecha, 'DD/MM')  AS fecha,
             ${tasaPresencia('m')}      AS tasa,
             count(*)::int              AS registros
        FROM marcas m
       GROUP BY m.fecha
       ORDER BY m.fecha`,
    params: [ctx.global, ctx.colegios, f.desde, f.hasta, oNulo(f.colegio)],
  }),
};

const composicionEntrenadoresPorColegio: DefinicionGrafica = {
  id: 'asistencia-entrenadores-colegio',
  titulo: 'Composición de la asistencia del personal',
  descripcion: 'Los cuatro estados por colegio, titulares y auxiliares juntos.',
  forma: 'apilada100',
  etiqueta: 'colegio',
  series: SERIES_ASISTENCIA,
  formato: 'porcentaje',
  escala: 'asistencia',
  construir: (f, ctx) => ({
    sql: `
      WITH marcas AS (
          SELECT ae.asisest_id, ae.col_id
            FROM public.asistencia_entrenador ae
           WHERE ae.asisent_fecha BETWEEN $3::date AND $4::date
             AND ($1::boolean OR ae.col_id = ANY($2::int[]))
             AND ($5::int[] IS NULL OR ae.col_id = ANY($5::int[]))
          UNION ALL
          SELECT aa.asisest_id, aa.col_id
            FROM public.asistencia_auxiliar aa
           WHERE aa.asisaux_fecha BETWEEN $3::date AND $4::date
             AND ($1::boolean OR aa.col_id = ANY($2::int[]))
             AND ($5::int[] IS NULL OR aa.col_id = ANY($5::int[]))
      )
      SELECT c.col_nombre AS colegio, ${composicion('m')}
        FROM marcas m
        JOIN public.colegio c ON c.col_id = m.col_id
       GROUP BY c.col_id, c.col_nombre
       ORDER BY c.col_nombre`,
    params: [ctx.global, ctx.colegios, f.desde, f.hasta, oNulo(f.colegio)],
  }),
};

// ---------------------------------------------------------------------------
// Evaluaciones

const distribucionPuntajes: DefinicionGrafica = {
  id: 'evaluaciones-distribucion',
  titulo: 'Distribución de los puntajes',
  descripcion: 'Cuántos alumnos evaluados caen en cada tramo de 10 %.',
  forma: 'histograma',
  etiqueta: 'tramo',
  series: [{ clave: 'alumnos', nombre: 'Alumnos' }],
  formato: 'entero',
  nota: 'Solo los alumnos ya evaluados. Los pendientes no tienen puntaje.',
  construir: (f, ctx) => ({
    sql: `
      WITH puntajes AS (
          SELECT LEAST(9, GREATEST(0, floor(
                     COALESCE((SELECT sum(i.evaint_puntaje_obtenido)
                                 FROM public.evaluacion_intento i
                                WHERE i.evaninopen_id = np.evaninopen_id), 0)
                     * 10 / NULLIF(e.eva_puntaje_total, 0)
                 )))::int AS decil
            FROM public.evaluacion_nino_pendiente np
            JOIN public.evaluacion e ON e.eva_id = np.eva_id
            JOIN public.nino_asignacion na ON na.ninoasig_id = np.ninoasig_id
            JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = na.colacthor_id
           WHERE np.est_id = ${ESTADO.EVALUADO}
             AND e.eva_puntaje_total > 0
             AND ($1::boolean OR na.colacthor_id = ANY($2::int[]) OR cah.col_id = ANY($3::int[]))
             AND ($4::int[] IS NULL OR cah.col_id = ANY($4::int[]))
             AND ($5::int IS NULL OR na.colacthor_id = $5)
      ),
      tramos AS (SELECT generate_series(0, 9) AS decil)
      SELECT (t.decil * 10)::text || '–' || ((t.decil + 1) * 10)::text || ' %' AS tramo,
             count(p.decil)::int AS alumnos
        FROM tramos t
        LEFT JOIN puntajes p ON p.decil = t.decil
       GROUP BY t.decil
       ORDER BY t.decil`,
    params: [ctx.global, ctx.disciplinas, ctx.colegios, oNulo(f.colegio), oNulo(f.disciplina)],
  }),
};

const promedioPorEvaluacion: DefinicionGrafica = {
  id: 'evaluaciones-promedio',
  titulo: 'Promedio por evaluación',
  descripcion: 'Porcentaje medio obtenido en cada evaluación, sobre los ya evaluados.',
  forma: 'barras',
  etiqueta: 'evaluacion',
  series: [{ clave: 'promedio', nombre: '% promedio' }],
  formato: 'porcentaje',
  construir: (f, ctx) => ({
    sql: `
      SELECT e.eva_titulo AS evaluacion,
             round(avg(
                 COALESCE((SELECT sum(i.evaint_puntaje_obtenido)
                             FROM public.evaluacion_intento i
                            WHERE i.evaninopen_id = np.evaninopen_id), 0)
                 * 100 / NULLIF(e.eva_puntaje_total, 0)
             ), 1)::float8 AS promedio,
             count(*)::int AS evaluados
        FROM public.evaluacion_nino_pendiente np
        JOIN public.evaluacion e ON e.eva_id = np.eva_id
        JOIN public.nino_asignacion na ON na.ninoasig_id = np.ninoasig_id
        JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = na.colacthor_id
       WHERE np.est_id = ${ESTADO.EVALUADO}
         AND e.eva_puntaje_total > 0
         AND ($1::boolean OR na.colacthor_id = ANY($2::int[]) OR cah.col_id = ANY($3::int[]))
         AND ($4::int[] IS NULL OR cah.col_id = ANY($4::int[]))
         AND ($5::int IS NULL OR na.colacthor_id = $5)
       GROUP BY e.eva_id, e.eva_titulo
       ORDER BY promedio DESC`,
    params: [ctx.global, ctx.disciplinas, ctx.colegios, oNulo(f.colegio), oNulo(f.disciplina)],
  }),
};

/** Las gráficas de cada reporte, por su id. */
export const GRAFICAS: Record<string, DefinicionGrafica[]> = {
  usuarios: [usuariosPorRol],
  colegios: [alumnosPorColegio, disciplinasPorColegio],
  actividades: [disciplinasPorActividad],
  disciplinas: [disciplinasPorDia, alumnosPorDisciplina],
  entrenadores: [alumnosPorEntrenador],
  estudiantes: [alumnosPorGrado, alumnosPorColegio],
  'asistencias-alumnos': [
    asistenciaAlumnosPorFecha,
    asistenciaPorDiaSemana,
    composicionAlumnosPorColegio,
  ],
  'asistencias-entrenadores': [
    asistenciaEntrenadoresPorFecha,
    composicionEntrenadoresPorColegio,
  ],
  evaluaciones: [distribucionPuntajes, promedioPorEvaluacion],
};
