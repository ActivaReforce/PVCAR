import type { FormaGrafica, SerieGrafica } from '../reportes/reportes.analisis.js';
import { paramsUsados } from '../../lib/sql.js';

/**
 * El resumen de Data anterior: los indicadores y las gráficas.
 *
 * Tres filtros y nada más —colegio, desde, hasta— porque son los únicos que
 * significan lo mismo en todas las gráficas. Los marcadores son fijos:
 *
 *   $1 colegio (archivo.colegio.col_id) o NULL
 *   $2 desde o NULL
 *   $3 hasta o NULL
 *
 * Una consulta que no usa las fechas solo escribe $1, y `paramsUsados` recorta
 * el array a lo que la consulta menciona. Ninguna usa $2 o $3 sin $1, así que
 * no puede quedar un hueco.
 *
 * Las formas y la escala de asistencia son las de Reportes, que ya pasaron el
 * validador de color en la Fase 13 (`frontend/src/components/graficas/paleta.ts`).
 * Aquí no se inventa ningún color.
 */

export interface FiltrosResumen {
  colegio?: number;
  desde?: string;
  hasta?: string;
}

export interface GraficaHistorico {
  id: string;
  titulo: string;
  descripcion: string;
  forma: FormaGrafica;
  etiqueta: string;
  series: SerieGrafica[];
  formato: 'porcentaje' | 'entero';
  escala?: 'asistencia';
  nota?: string;
  sql: string;
}

const COLEGIO = (expr: string) => `($1::int IS NULL OR ${expr} = $1::int)`;
const RANGO = (expr: string) =>
  `($2::date IS NULL OR ${expr} >= $2::date) AND ($3::date IS NULL OR ${expr} <= $3::date)`;

/** "oct 2025": el mes en español sin depender del lc_time del servidor. */
const MES = (expr: string) =>
  `(ARRAY['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month FROM ${expr})::int]
   || ' ' || extract(year FROM ${expr})::int`;

/** El orden de las series es el de la escala de asistencia de paleta.ts. */
const SERIES_ASISTENCIA: SerieGrafica[] = [
  { clave: 'presente', nombre: 'Presente' },
  { clave: 'tarde', nombre: 'Tarde' },
  { clave: 'justificado', nombre: 'Justificado' },
  { clave: 'ausente', nombre: 'Ausente' },
];

const COMPOSICION = (a: string) => `
       count(*) FILTER (WHERE ${a}.asisest_id = 1)::int AS presente,
       count(*) FILTER (WHERE ${a}.asisest_id = 2)::int AS ausente,
       count(*) FILTER (WHERE ${a}.asisest_id = 3)::int AS tarde,
       count(*) FILTER (WHERE ${a}.asisest_id = 4)::int AS justificado`;

const ASISTENCIA_ALUMNOS = `
  FROM archivo.asistencia_nino an
  JOIN archivo.colegio_actividad_horario d ON d.colacthor_id = an.colacthor_id`;

export const SQL_INDICADORES = `
SELECT
  (SELECT count(*) FROM archivo.nino n WHERE ${COLEGIO('n.col_id')})::int AS alumnos,
  (SELECT count(*) FROM archivo.colegio c WHERE ${COLEGIO('c.col_id')})::int AS colegios,
  (SELECT count(*) FROM archivo.colegio_actividad_horario d WHERE ${COLEGIO('d.col_id')})::int AS disciplinas,
  (SELECT count(DISTINCT ea.ent_id)
     FROM archivo.entrenador_asignacion ea
     JOIN archivo.colegio_actividad_horario d ON d.colacthor_id = ea.colacthor_id
    WHERE ${COLEGIO('d.col_id')})::int AS entrenadores,
  (SELECT count(*)
     FROM archivo.nino_asignacion na
     JOIN archivo.colegio_actividad_horario d ON d.colacthor_id = na.colacthor_id
    WHERE ${COLEGIO('d.col_id')} AND ${RANGO('na.ninoasig_fecha_inscripcion::date')})::int AS inscripciones,
  a.asistencias,
  a.pct_presencia,
  a.primera,
  a.ultima,
  e.asistencias_entrenadores,
  e.pct_presencia_entrenadores
FROM (
  SELECT count(*)::int AS asistencias,
         round(count(*) FILTER (WHERE an.asisest_id = 1) * 100.0 / NULLIF(count(*), 0), 1)::float8 AS pct_presencia,
         to_char(min(an.asisnino_fecha), 'YYYY-MM-DD') AS primera,
         to_char(max(an.asisnino_fecha), 'YYYY-MM-DD') AS ultima
  ${ASISTENCIA_ALUMNOS}
   WHERE ${COLEGIO('d.col_id')} AND ${RANGO('an.asisnino_fecha')}
) a,
(
  SELECT count(*)::int AS asistencias_entrenadores,
         round(count(*) FILTER (WHERE ae.asisest_id = 1) * 100.0 / NULLIF(count(*), 0), 1)::float8
           AS pct_presencia_entrenadores
    FROM archivo.asistencia_entrenador ae
   WHERE ${COLEGIO('ae.col_id')} AND ${RANGO('ae.asisent_fecha')}
) e`;

export const GRAFICAS_HISTORICO: GraficaHistorico[] = [
  {
    id: 'asistencias-por-mes',
    titulo: 'Asistencias registradas por mes',
    descripcion: 'Cuántas marcas de asistencia de alumnos se tomaron cada mes.',
    forma: 'linea',
    etiqueta: 'mes',
    series: [{ clave: 'registros', nombre: 'Asistencias' }],
    formato: 'entero',
    sql: `
SELECT ${MES('m.mes')} AS mes, m.registros
  FROM (SELECT date_trunc('month', an.asisnino_fecha) AS mes, count(*)::int AS registros
        ${ASISTENCIA_ALUMNOS}
         WHERE ${COLEGIO('d.col_id')} AND ${RANGO('an.asisnino_fecha')}
         GROUP BY 1) m
 ORDER BY m.mes`,
  },
  {
    id: 'presencia-por-mes',
    titulo: 'Presencia por mes',
    descripcion: 'Qué parte de las marcas de cada mes fueron "Presente".',
    forma: 'linea',
    etiqueta: 'mes',
    series: [{ clave: 'presencia', nombre: '% presencia' }],
    formato: 'porcentaje',
    sql: `
SELECT ${MES('m.mes')} AS mes, m.presencia
  FROM (SELECT date_trunc('month', an.asisnino_fecha) AS mes,
               round(count(*) FILTER (WHERE an.asisest_id = 1) * 100.0 / NULLIF(count(*), 0), 1)::float8 AS presencia
        ${ASISTENCIA_ALUMNOS}
         WHERE ${COLEGIO('d.col_id')} AND ${RANGO('an.asisnino_fecha')}
         GROUP BY 1) m
 ORDER BY m.mes`,
  },
  {
    id: 'asistencia-por-colegio',
    titulo: 'Asistencia de alumnos por colegio',
    descripcion: 'Cómo se reparten las marcas de cada colegio entre los cuatro estados.',
    forma: 'apilada100',
    etiqueta: 'colegio',
    series: SERIES_ASISTENCIA,
    formato: 'entero',
    escala: 'asistencia',
    sql: `
SELECT c.col_nombre AS colegio, ${COMPOSICION('an')}
  ${ASISTENCIA_ALUMNOS}
  JOIN archivo.colegio c ON c.col_id = d.col_id
 WHERE ${COLEGIO('d.col_id')} AND ${RANGO('an.asisnino_fecha')}
 GROUP BY c.col_id, c.col_nombre
 ORDER BY count(*) DESC`,
  },
  {
    id: 'presencia-por-dia',
    titulo: 'Presencia por día de la semana',
    descripcion: 'Qué días faltaban más los alumnos.',
    forma: 'barras',
    etiqueta: 'dia',
    series: [{ clave: 'presencia', nombre: '% presencia' }],
    formato: 'porcentaje',
    sql: `
SELECT di.dia_nombre AS dia,
       round(count(*) FILTER (WHERE an.asisest_id = 1) * 100.0 / NULLIF(count(*), 0), 1)::float8 AS presencia
  ${ASISTENCIA_ALUMNOS}
  JOIN archivo.dia di ON di.dia_id = d.dia_id
 WHERE ${COLEGIO('d.col_id')} AND ${RANGO('an.asisnino_fecha')}
 GROUP BY di.dia_id, di.dia_nombre
 ORDER BY di.dia_id`,
  },
  {
    id: 'alumnos-por-colegio',
    titulo: 'Alumnos por colegio',
    descripcion: 'Cuántos alumnos tenía registrados cada colegio.',
    forma: 'barras',
    etiqueta: 'colegio',
    series: [{ clave: 'alumnos', nombre: 'Alumnos' }],
    formato: 'entero',
    nota: 'No depende de las fechas: es el registro de alumnos, no la asistencia.',
    sql: `
SELECT c.col_nombre AS colegio, count(n.nino_id)::int AS alumnos
  FROM archivo.colegio c
  LEFT JOIN archivo.nino n ON n.col_id = c.col_id
 WHERE ${COLEGIO('c.col_id')}
 GROUP BY c.col_id, c.col_nombre
 ORDER BY alumnos DESC`,
  },
  {
    id: 'inscripciones-por-actividad',
    titulo: 'Inscripciones por actividad',
    descripcion: 'Las 15 actividades con más inscripciones.',
    forma: 'barras',
    etiqueta: 'actividad',
    series: [{ clave: 'inscripciones', nombre: 'Inscripciones' }],
    formato: 'entero',
    nota: 'Las fechas se aplican a la fecha de inscripción.',
    sql: `
SELECT a.act_nombre AS actividad, count(*)::int AS inscripciones
  FROM archivo.nino_asignacion na
  JOIN archivo.colegio_actividad_horario d ON d.colacthor_id = na.colacthor_id
  JOIN archivo.actividad a ON a.act_id = d.act_id
 WHERE ${COLEGIO('d.col_id')} AND ${RANGO('na.ninoasig_fecha_inscripcion::date')}
 GROUP BY a.act_id, a.act_nombre
 ORDER BY inscripciones DESC
 LIMIT 15`,
  },
  {
    id: 'asistencia-entrenadores-por-colegio',
    titulo: 'Asistencia de entrenadores por colegio',
    descripcion: 'Si los entrenadores iban a dar su clase, colegio por colegio.',
    forma: 'apilada100',
    etiqueta: 'colegio',
    series: SERIES_ASISTENCIA,
    formato: 'entero',
    escala: 'asistencia',
    sql: `
SELECT c.col_nombre AS colegio, ${COMPOSICION('ae')}
  FROM archivo.asistencia_entrenador ae
  JOIN archivo.colegio c ON c.col_id = ae.col_id
 WHERE ${COLEGIO('ae.col_id')} AND ${RANGO('ae.asisent_fecha')}
 GROUP BY c.col_id, c.col_nombre
 ORDER BY count(*) DESC`,
  },
  {
    id: 'registradores',
    titulo: 'Quién registró la asistencia',
    descripcion: 'Las 15 personas que más asistencias de alumnos registraron.',
    forma: 'barras',
    etiqueta: 'persona',
    series: [{ clave: 'registros', nombre: 'Asistencias registradas' }],
    formato: 'entero',
    sql: `
SELECT u.usu_nombre AS persona, count(*)::int AS registros
  ${ASISTENCIA_ALUMNOS}
  JOIN archivo.usuario u ON u.usu_id = an.usu_registrador
 WHERE ${COLEGIO('d.col_id')} AND ${RANGO('an.asisnino_fecha')}
 GROUP BY u.usu_id, u.usu_nombre
 ORDER BY registros DESC
 LIMIT 15`,
  },
];

/** Los valores de $1..$3, recortados a los que menciona esta consulta. */
export function parametrosResumen(sql: string, f: FiltrosResumen): unknown[] {
  return paramsUsados(sql, [f.colegio ?? null, f.desde ?? null, f.hasta ?? null]);
}
