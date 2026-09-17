import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import type { Alcance } from '../../lib/alcance.js';
import { ESTADO } from '../../lib/constants.js';
import { armarPagina, offsetDe, ordenSeguro, type Pagina, type Paginacion } from '../../lib/paginacion.js';
import { contieneSinTildes } from '../../lib/sql.js';
import type { ListarEvaluacionesQuery, ListarPendientesQuery, ParametroInput } from './evaluaciones.schemas.js';
import type { ParametroPuntuable, RangoTiempo } from './evaluaciones.scoring.js';

/**
 * Consultas de Evaluaciones.
 *
 * ---------------------------------------------------------------------------
 * Quien ve que evaluacion
 *
 * Una evaluacion es una plantilla: no tiene colegio ni disciplina propios
 * hasta que se vincula. Asi que el alcance va por tres caminos y basta uno:
 *
 *   global                -> Propietario y Admin lo ven todo
 *   la creo el actor      -> si no, al crear una se perderia de vista hasta
 *                            vincularla, que es justo el paso siguiente
 *   esta vinculada a una  -> el entrenador ve las evaluaciones que tiene que
 *   disciplina suya          pasar, y solo esas
 *
 * El sistema viejo no filtraba nada: la lista de evaluaciones se traia entera
 * y el filtro por colegio se aplicaba —cuando se aplicaba— en el navegador.
 */

export interface EvaluacionListada {
  eva_id: number;
  eva_titulo: string;
  eva_descripcion: string | null;
  eva_categoria: string | null;
  eva_puntaje_total: number;
  est_id: number;
  eva_fecha_creacion: string;
  eva_creador: number;
  creador: string;
  parametros: number;
  disciplinas: number;
  pendientes: number;
  evaluados: number;
}

export interface ParametroDetalle extends ParametroPuntuable {
  evaparam_nota: string | null;
  evatipometo_nombre: string;
  /** Intentos ya registrados contra este parametro, en toda la evaluacion. */
  intentos_registrados: number;
}

export interface ConteosEvaluaciones {
  total: number;
  activas: number;
  deBaja: number;
  sinDisciplinas: number;
}

export interface DisciplinaVinculada {
  evaasig_id: number;
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_nombre: string;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  est_id: number;
  alumnos: number;
  pendientes: number;
  evaluados: number;
}

export interface DisciplinaDisponible {
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_nombre: string;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  alumnos: number;
  /** True si estuvo vinculada y se desvinculo: volver a vincularla la reactiva. */
  estuvo: boolean;
}

export interface AlumnoPendiente {
  evaninopen_id: number;
  nino_id: number;
  nino_nombre: string;
  nino_foto: string | null;
  catninograd_nombre: string | null;
  est_id: number;
  evaninopen_fecha_finalizacion: string | null;
  evaluado_por: string | null;
  puntaje: number;
  intentos_registrados: number;
}

export interface IntentoGuardado {
  evaint_id: number;
  evaparam_id: number;
  evaint_intento: number;
  evaint_tiempo: number | null;
  evaint_logro: boolean | null;
  evaint_num: number | null;
  evaint_mobak: number | null;
  evaint_puntaje_obtenido: number;
}

// ---------------------------------------------------------------------------
// Catalogos

export async function listarMetodos(): Promise<Array<{ evatipometo_id: number; evatipometo_nombre: string }>> {
  const { rows } = await getPool().query(
    `SELECT evatipometo_id, evatipometo_nombre
       FROM public.evaluacion_tipo_metodo ORDER BY evatipometo_id`,
  );
  return rows;
}

/**
 * Las categorias que ya se han usado.
 *
 * `eva_categoria` es texto libre —no hay tabla de catalogo— asi que el
 * selector se alimenta de lo que existe. Sin esto cada quien escribe "S17",
 * "s17" y "Sub 17" y el filtro por categoria deja de servir.
 */
export async function listarCategorias(): Promise<Array<{ categoria: string; evaluaciones: number }>> {
  const { rows } = await getPool().query(
    `SELECT eva_categoria AS categoria, count(*)::int AS evaluaciones
       FROM public.evaluacion
      WHERE eva_categoria IS NOT NULL AND btrim(eva_categoria) <> ''
      GROUP BY 1 ORDER BY 1`,
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Lista

const F_ALCANCE = `(
    $1::boolean
    OR e.eva_creador = $2
    OR EXISTS (
        SELECT 1 FROM public.evaluacion_asignacion ea
        WHERE ea.eva_id = e.eva_id
          AND ea.est_id = ${ESTADO.ACTIVO}
          AND ea.colacthor_id = ANY($3::int[])
    )
)`;

const F_BUSCAR = `($4::text IS NULL
    OR ${contieneSinTildes('e.eva_titulo', '$4')}
    OR ${contieneSinTildes("COALESCE(e.eva_descripcion, '')", '$4')})`;

const F_CATEGORIA = `($5::text IS NULL OR e.eva_categoria = $5)`;
const F_ESTADO = `($6::int IS NULL OR e.est_id = $6)`;
const F_SIN_DISCIPLINAS = `(NOT $7::boolean OR COALESCE(asig.n, 0) = 0)`;

const LATERALES = `
    LEFT JOIN LATERAL (
        SELECT count(*) AS n FROM public.evaluacion_parametro ep WHERE ep.eva_id = e.eva_id
    ) par ON TRUE
    LEFT JOIN LATERAL (
        SELECT count(*) AS n FROM public.evaluacion_asignacion ea
        WHERE ea.eva_id = e.eva_id AND ea.est_id = ${ESTADO.ACTIVO}
    ) asig ON TRUE
    LEFT JOIN LATERAL (
        SELECT count(*) FILTER (WHERE np.est_id = ${ESTADO.PENDIENTE}) AS pendientes,
               count(*) FILTER (WHERE np.est_id = ${ESTADO.EVALUADO})  AS evaluados
        FROM public.evaluacion_nino_pendiente np WHERE np.eva_id = e.eva_id
    ) pen ON TRUE
`;

const DESDE = `
    FROM public.evaluacion e
    JOIN public.usuario u ON u.usu_id = e.eva_creador
    ${LATERALES}
`;

const COLUMNAS_ORDEN: Record<string, string> = {
  titulo: 'e.eva_titulo',
  categoria: 'e.eva_categoria',
  puntaje: 'e.eva_puntaje_total',
  creacion: 'e.eva_fecha_creacion',
  pendientes: 'COALESCE(pen.pendientes, 0)',
};

function params(query: ListarEvaluacionesQuery, alcance: Alcance, actor: number): unknown[] {
  return [
    alcance.global,
    actor,
    alcance.disciplinas,
    query.buscar && query.buscar.length > 0 ? query.buscar : null,
    query.categoria ?? null,
    query.estado ?? null,
    query.sinDisciplinas === true,
  ];
}

const DONDE = `WHERE ${F_ALCANCE} AND ${F_BUSCAR} AND ${F_CATEGORIA} AND ${F_ESTADO} AND ${F_SIN_DISCIPLINAS}`;

export async function listarEvaluaciones(
  query: ListarEvaluacionesQuery,
  alcance: Alcance,
  actor: number,
): Promise<Pagina<EvaluacionListada>> {
  const columna = ordenSeguro(query.orden, COLUMNAS_ORDEN, 'e.eva_fecha_creacion');
  const direccion = query.dir === 'desc' ? 'DESC' : query.orden ? 'ASC' : 'DESC';
  const base = params(query, alcance, actor);

  const { rows } = await getPool().query<EvaluacionListada>(
    `SELECT e.eva_id,
            e.eva_titulo,
            e.eva_descripcion,
            e.eva_categoria,
            e.eva_puntaje_total::float8 AS eva_puntaje_total,
            e.est_id,
            e.eva_fecha_creacion,
            e.eva_creador,
            u.usu_nombre                 AS creador,
            COALESCE(par.n, 0)::int      AS parametros,
            COALESCE(asig.n, 0)::int     AS disciplinas,
            COALESCE(pen.pendientes, 0)::int AS pendientes,
            COALESCE(pen.evaluados, 0)::int  AS evaluados
     ${DESDE}
     ${DONDE}
     ORDER BY ${columna} ${direccion} NULLS LAST, e.eva_id
     LIMIT $8 OFFSET $9`,
    [...base, query.limit, offsetDe(query)],
  );

  const { rows: cuenta } = await getPool().query<{ total: string }>(
    `SELECT count(*) AS total ${DESDE} ${DONDE}`,
    base,
  );

  return armarPagina(rows, Number(cuenta[0]?.total ?? 0), query as Paginacion);
}

/**
 * Conteos del encabezado.
 *
 * Salen del mismo alcance pero **ignorando los filtros de pantalla** a
 * proposito: si se contaran con el filtro puesto, marcar "Activas" pondria
 * "de baja: 0" y los dos numeros se contradirian. Es la leccion de la Fase 6.
 */
export async function contarEvaluaciones(
  alcance: Alcance,
  actor: number,
): Promise<ConteosEvaluaciones> {
  const { rows } = await getPool().query<ConteosEvaluaciones>(
    `SELECT count(*)::int                                            AS total,
            count(*) FILTER (WHERE e.est_id = ${ESTADO.ACTIVO})::int   AS activas,
            count(*) FILTER (WHERE e.est_id <> ${ESTADO.ACTIVO})::int  AS "deBaja",
            count(*) FILTER (WHERE COALESCE(asig.n, 0) = 0)::int       AS "sinDisciplinas"
       FROM public.evaluacion e
       LEFT JOIN LATERAL (
           SELECT count(*) AS n FROM public.evaluacion_asignacion ea
           WHERE ea.eva_id = e.eva_id AND ea.est_id = ${ESTADO.ACTIVO}
       ) asig ON TRUE
      WHERE ${F_ALCANCE}`,
    [alcance.global, actor, alcance.disciplinas],
  );

  return rows[0] ?? { total: 0, activas: 0, deBaja: 0, sinDisciplinas: 0 };
}

export async function obtenerEvaluacion(evaId: number): Promise<EvaluacionListada | null> {
  const { rows } = await getPool().query<EvaluacionListada>(
    `SELECT e.eva_id,
            e.eva_titulo,
            e.eva_descripcion,
            e.eva_categoria,
            e.eva_puntaje_total::float8 AS eva_puntaje_total,
            e.est_id,
            e.eva_fecha_creacion,
            e.eva_creador,
            u.usu_nombre                 AS creador,
            COALESCE(par.n, 0)::int      AS parametros,
            COALESCE(asig.n, 0)::int     AS disciplinas,
            COALESCE(pen.pendientes, 0)::int AS pendientes,
            COALESCE(pen.evaluados, 0)::int  AS evaluados
     ${DESDE}
     WHERE e.eva_id = $1`,
    [evaId],
  );
  return rows[0] ?? null;
}

/**
 * Los parametros de una evaluacion, con sus umbrales de tiempo.
 *
 * `intentos_registrados` es lo que impide cambiarle el metodo a un parametro
 * que ya tiene notas puestas: un intento guardado como "logro" no significa
 * nada bajo un metodo por tiempo.
 */
export async function listarParametros(evaId: number): Promise<ParametroDetalle[]> {
  const { rows } = await getPool().query<ParametroDetalle>(
    `SELECT p.evaparam_id,
            p.evaparam_nombre,
            p.evaparam_nota,
            p.evatipometo_id,
            m.evatipometo_nombre,
            p.evaparam_intentos,
            p.evaparam_puntaje,
            p.evaparam_escala_min,
            p.evaparam_escala_max,
            CASE WHEN r.evatieran_id IS NULL THEN NULL ELSE json_build_object(
                'evatieran_op_cero',     r.evatieran_op_cero,
                'evatieran_tiempo_cero', r.evatieran_tiempo_cero,
                'evatieran_op_full',     r.evatieran_op_full,
                'evatieran_tiempo_full', r.evatieran_tiempo_full
            ) END AS rango,
            COALESCE(i.n, 0)::int AS intentos_registrados
       FROM public.evaluacion_parametro p
       JOIN public.evaluacion_tipo_metodo m ON m.evatipometo_id = p.evatipometo_id
       LEFT JOIN public.evaluacion_tiempo_rangos r ON r.evaparam_id = p.evaparam_id
       LEFT JOIN LATERAL (
           SELECT count(*) AS n FROM public.evaluacion_intento ei
           WHERE ei.evaparam_id = p.evaparam_id
       ) i ON TRUE
      WHERE p.eva_id = $1
      ORDER BY p.evaparam_id`,
    [evaId],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Escritura de la plantilla

export async function insertarEvaluacion(
  client: PoolClient,
  datos: { titulo: string; descripcion: string | null; categoria: string | null; creador: number },
): Promise<number> {
  const { rows } = await client.query<{ eva_id: number }>(
    `INSERT INTO public.evaluacion (eva_titulo, eva_descripcion, eva_categoria, eva_creador, est_id)
     VALUES ($1, $2, $3, $4, ${ESTADO.ACTIVO})
     RETURNING eva_id`,
    [datos.titulo, datos.descripcion, datos.categoria, datos.creador],
  );
  return rows[0]!.eva_id;
}

export async function actualizarEvaluacion(
  client: PoolClient,
  evaId: number,
  datos: {
    titulo?: string;
    descripcion: string | null;
    tocarDescripcion: boolean;
    categoria: string | null;
    tocarCategoria: boolean;
  },
): Promise<void> {
  await client.query(
    `UPDATE public.evaluacion
        SET eva_titulo      = COALESCE($2, eva_titulo),
            eva_descripcion = CASE WHEN $4::boolean THEN $3 ELSE eva_descripcion END,
            eva_categoria   = CASE WHEN $6::boolean THEN $5 ELSE eva_categoria END
      WHERE eva_id = $1`,
    [
      evaId,
      datos.titulo ?? null,
      datos.descripcion,
      datos.tocarDescripcion,
      datos.categoria,
      datos.tocarCategoria,
    ],
  );
}

export async function insertarParametro(
  client: PoolClient,
  evaId: number,
  p: ParametroInput,
): Promise<number> {
  const { rows } = await client.query<{ evaparam_id: number }>(
    `INSERT INTO public.evaluacion_parametro
         (eva_id, evaparam_nombre, evaparam_nota, evatipometo_id,
          evaparam_intentos, evaparam_puntaje, evaparam_escala_min, evaparam_escala_max)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING evaparam_id`,
    [
      evaId,
      p.evaparam_nombre,
      p.evaparam_nota && p.evaparam_nota.length > 0 ? p.evaparam_nota : null,
      p.evatipometo_id,
      p.evaparam_intentos,
      p.evaparam_puntaje,
      p.evaparam_escala_min ?? null,
      p.evaparam_escala_max ?? null,
    ],
  );
  return rows[0]!.evaparam_id;
}

export async function actualizarParametro(
  client: PoolClient,
  evaparamId: number,
  p: ParametroInput,
): Promise<void> {
  await client.query(
    `UPDATE public.evaluacion_parametro
        SET evaparam_nombre     = $2,
            evaparam_nota       = $3,
            evatipometo_id      = $4,
            evaparam_intentos   = $5,
            evaparam_puntaje    = $6,
            evaparam_escala_min = $7,
            evaparam_escala_max = $8
      WHERE evaparam_id = $1`,
    [
      evaparamId,
      p.evaparam_nombre,
      p.evaparam_nota && p.evaparam_nota.length > 0 ? p.evaparam_nota : null,
      p.evatipometo_id,
      p.evaparam_intentos,
      p.evaparam_puntaje,
      p.evaparam_escala_min ?? null,
      p.evaparam_escala_max ?? null,
    ],
  );
}

export async function borrarParametro(client: PoolClient, evaparamId: number): Promise<void> {
  await client.query(`DELETE FROM public.evaluacion_parametro WHERE evaparam_id = $1`, [
    evaparamId,
  ]);
}

/** Los umbrales van en su tabla, uno por parametro (`UNIQUE (evaparam_id)`). */
export async function guardarRango(
  client: PoolClient,
  evaparamId: number,
  rango: RangoTiempo | null,
): Promise<void> {
  if (rango === null) {
    await client.query(`DELETE FROM public.evaluacion_tiempo_rangos WHERE evaparam_id = $1`, [
      evaparamId,
    ]);
    return;
  }

  await client.query(
    `INSERT INTO public.evaluacion_tiempo_rangos
         (evaparam_id, evatieran_op_cero, evatieran_tiempo_cero, evatieran_op_full, evatieran_tiempo_full)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (evaparam_id) DO UPDATE
        SET evatieran_op_cero     = EXCLUDED.evatieran_op_cero,
            evatieran_tiempo_cero = EXCLUDED.evatieran_tiempo_cero,
            evatieran_op_full     = EXCLUDED.evatieran_op_full,
            evatieran_tiempo_full = EXCLUDED.evatieran_tiempo_full`,
    [
      evaparamId,
      rango.evatieran_op_cero,
      rango.evatieran_tiempo_cero,
      rango.evatieran_op_full,
      rango.evatieran_tiempo_full,
    ],
  );
}

export async function idsDeParametros(client: PoolClient, evaId: number): Promise<number[]> {
  const { rows } = await client.query<{ evaparam_id: number }>(
    `SELECT evaparam_id FROM public.evaluacion_parametro WHERE eva_id = $1`,
    [evaId],
  );
  return rows.map((r) => r.evaparam_id);
}

export async function cambiarEstadoEvaluacion(
  client: PoolClient,
  evaId: number,
  estId: number,
): Promise<void> {
  await client.query(`UPDATE public.evaluacion SET est_id = $2 WHERE eva_id = $1`, [evaId, estId]);
}

export interface ImpactoEvaluacion {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

/**
 * Que se destruye al borrar una evaluacion.
 *
 * Las cuatro tablas cuelgan con ON DELETE CASCADE, asi que no hay nada que lo
 * bloquee: borrar una evaluacion se lleva sus parametros, sus vinculos, las
 * pendientes de todos los alumnos y **los intentos ya registrados**. Por eso
 * el recuento va antes y hay que escribir el titulo.
 */
export async function calcularImpacto(evaId: number): Promise<ImpactoEvaluacion> {
  const { rows } = await getPool().query<{
    parametros: number;
    disciplinas: number;
    pendientes: number;
    evaluados: number;
    intentos: number;
  }>(
    `SELECT (SELECT count(*) FROM public.evaluacion_parametro WHERE eva_id = $1)::int AS parametros,
            (SELECT count(*) FROM public.evaluacion_asignacion WHERE eva_id = $1)::int AS disciplinas,
            (SELECT count(*) FROM public.evaluacion_nino_pendiente
              WHERE eva_id = $1 AND est_id = ${ESTADO.PENDIENTE})::int AS pendientes,
            (SELECT count(*) FROM public.evaluacion_nino_pendiente
              WHERE eva_id = $1 AND est_id = ${ESTADO.EVALUADO})::int AS evaluados,
            (SELECT count(*) FROM public.evaluacion_intento i
               JOIN public.evaluacion_nino_pendiente np ON np.evaninopen_id = i.evaninopen_id
              WHERE np.eva_id = $1)::int AS intentos`,
    [evaId],
  );

  const r = rows[0]!;
  return {
    eliminables: {
      parametros: r.parametros,
      'vínculos con disciplinas': r.disciplinas,
      'evaluaciones pendientes': r.pendientes,
      'alumnos ya evaluados': r.evaluados,
      'intentos registrados': r.intentos,
    },
    bloqueos: {},
    puedeEliminar: true,
  };
}

export async function eliminarEvaluacion(client: PoolClient, evaId: number): Promise<void> {
  await client.query(`DELETE FROM public.evaluacion WHERE eva_id = $1`, [evaId]);
}

// ---------------------------------------------------------------------------
// Disciplinas vinculadas

export async function listarVinculadas(evaId: number): Promise<DisciplinaVinculada[]> {
  const { rows } = await getPool().query<DisciplinaVinculada>(
    `SELECT a.evaasig_id,
            a.colacthor_id,
            cah.col_id,
            c.col_nombre,
            act.act_nombre,
            d.dia_nombre,
            to_char(cah.colacthor_hora_inicio, 'HH24:MI') AS colacthor_hora_inicio,
            a.est_id,
            COALESCE(al.n, 0)::int  AS alumnos,
            COALESCE(p.pendientes, 0)::int AS pendientes,
            COALESCE(p.evaluados, 0)::int  AS evaluados
       FROM public.evaluacion_asignacion a
       JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = a.colacthor_id
       JOIN public.colegio c   ON c.col_id = cah.col_id
       JOIN public.actividad act ON act.act_id = cah.act_id
       JOIN public.dia d       ON d.dia_id = cah.dia_id
       LEFT JOIN LATERAL (
           SELECT count(*) AS n FROM public.nino_asignacion na
           WHERE na.colacthor_id = a.colacthor_id AND na.est_id = ${ESTADO.ACTIVO}
       ) al ON TRUE
       LEFT JOIN LATERAL (
           SELECT count(*) FILTER (WHERE np.est_id = ${ESTADO.PENDIENTE}) AS pendientes,
                  count(*) FILTER (WHERE np.est_id = ${ESTADO.EVALUADO})  AS evaluados
           FROM public.evaluacion_nino_pendiente np
           JOIN public.nino_asignacion na2 ON na2.ninoasig_id = np.ninoasig_id
           WHERE np.eva_id = a.eva_id AND na2.colacthor_id = a.colacthor_id
       ) p ON TRUE
      WHERE a.eva_id = $1
      ORDER BY c.col_nombre, act.act_nombre`,
    [evaId],
  );
  return rows;
}

/**
 * Disciplinas activas del alcance a las que todavia no esta vinculada.
 *
 * `estuvo` marca las que tienen un vinculo desactivado: volver a elegirlas lo
 * reactiva en vez de crear otro, que es lo que exige el UNIQUE
 * `evaluacion_asignacion_eva_colacthor_unique`.
 */
export async function listarDisponibles(
  evaId: number,
  alcance: Alcance,
): Promise<DisciplinaDisponible[]> {
  const { rows } = await getPool().query<DisciplinaDisponible>(
    `SELECT cah.colacthor_id,
            cah.col_id,
            c.col_nombre,
            act.act_nombre,
            d.dia_nombre,
            to_char(cah.colacthor_hora_inicio, 'HH24:MI') AS colacthor_hora_inicio,
            COALESCE(al.n, 0)::int AS alumnos,
            (a.evaasig_id IS NOT NULL) AS estuvo
       FROM public.colegio_actividad_horario cah
       JOIN public.colegio c   ON c.col_id = cah.col_id
       JOIN public.actividad act ON act.act_id = cah.act_id
       JOIN public.dia d       ON d.dia_id = cah.dia_id
       LEFT JOIN public.evaluacion_asignacion a
              ON a.eva_id = $1 AND a.colacthor_id = cah.colacthor_id
       LEFT JOIN LATERAL (
           SELECT count(*) AS n FROM public.nino_asignacion na
           WHERE na.colacthor_id = cah.colacthor_id AND na.est_id = ${ESTADO.ACTIVO}
       ) al ON TRUE
      WHERE cah.est_id = ${ESTADO.ACTIVO}
        AND ($2::boolean OR cah.colacthor_id = ANY($3::int[]))
        AND (a.evaasig_id IS NULL OR a.est_id <> ${ESTADO.ACTIVO})
      ORDER BY c.col_nombre, act.act_nombre, d.dia_id`,
    [evaId, alcance.global, alcance.disciplinas],
  );
  return rows;
}

export async function vinculosActivos(
  client: PoolClient,
  evaId: number,
): Promise<Array<{ evaasig_id: number; colacthor_id: number }>> {
  const { rows } = await client.query<{ evaasig_id: number; colacthor_id: number }>(
    `SELECT evaasig_id, colacthor_id
       FROM public.evaluacion_asignacion
      WHERE eva_id = $1 AND est_id = ${ESTADO.ACTIVO}`,
    [evaId],
  );
  return rows;
}

/** Vincular: crea el vinculo o reactiva el que hubiera. */
export async function vincular(
  client: PoolClient,
  evaId: number,
  colacthorId: number,
): Promise<void> {
  await client.query(
    `INSERT INTO public.evaluacion_asignacion (eva_id, colacthor_id, est_id)
     VALUES ($1, $2, ${ESTADO.ACTIVO})
     ON CONFLICT (eva_id, colacthor_id) DO UPDATE SET est_id = ${ESTADO.ACTIVO}`,
    [evaId, colacthorId],
  );
}

/**
 * Crea las pendientes de todos los alumnos inscritos en esa disciplina.
 *
 * Es la regla 1 del modulo y en el sistema viejo se hacia **desde el
 * navegador**: un SELECT y un INSERT por alumno, sin transaccion, en un bucle.
 * Con 40 alumnos eran 80 peticiones y cualquiera podia fallar en silencio (el
 * codigo hacia `console.error` y seguia).
 *
 * `ON CONFLICT` reactiva las que ya existian desactivadas: el alumno que
 * estuvo, se fue y volvio recupera su pendiente en vez de chocar contra el
 * indice unico de la migracion 0011.
 */
export async function crearPendientesDe(
  client: PoolClient,
  evaId: number,
  colacthorId: number,
): Promise<number> {
  const { rowCount } = await client.query(
    `INSERT INTO public.evaluacion_nino_pendiente (eva_id, ninoasig_id, est_id, usu_id_registrador)
     SELECT $1, na.ninoasig_id, ${ESTADO.PENDIENTE}, NULL
       FROM public.nino_asignacion na
      WHERE na.colacthor_id = $2 AND na.est_id = ${ESTADO.ACTIVO}
     ON CONFLICT (eva_id, ninoasig_id) DO UPDATE
        SET est_id = ${ESTADO.PENDIENTE}
      WHERE public.evaluacion_nino_pendiente.est_id = ${ESTADO.INACTIVO}`,
    [evaId, colacthorId],
  );
  return rowCount ?? 0;
}

/**
 * Desvincular: **no borra nada**.
 *
 * El sistema viejo hacia `DELETE FROM evaluacion_nino_pendiente` de todos los
 * alumnos de esa disciplina, **incluidos los ya evaluados**, y sin avisar: las
 * notas desaparecian. Aqui el vinculo y las pendientes que siguen pendientes
 * pasan a inactivos, y **lo ya evaluado se queda**.
 */
export async function desvincular(
  client: PoolClient,
  evaId: number,
  colacthorId: number,
): Promise<{ desactivadas: number; conservadas: number }> {
  await client.query(
    `UPDATE public.evaluacion_asignacion SET est_id = ${ESTADO.INACTIVO}
      WHERE eva_id = $1 AND colacthor_id = $2`,
    [evaId, colacthorId],
  );

  const { rowCount } = await client.query(
    `UPDATE public.evaluacion_nino_pendiente np
        SET est_id = ${ESTADO.INACTIVO}
       FROM public.nino_asignacion na
      WHERE na.ninoasig_id = np.ninoasig_id
        AND np.eva_id = $1
        AND na.colacthor_id = $2
        AND np.est_id = ${ESTADO.PENDIENTE}`,
    [evaId, colacthorId],
  );

  const { rows } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM public.evaluacion_nino_pendiente np
       JOIN public.nino_asignacion na ON na.ninoasig_id = np.ninoasig_id
      WHERE np.eva_id = $1 AND na.colacthor_id = $2 AND np.est_id = ${ESTADO.EVALUADO}`,
    [evaId, colacthorId],
  );

  return { desactivadas: rowCount ?? 0, conservadas: rows[0]?.n ?? 0 };
}

// ---------------------------------------------------------------------------
// Evaluar alumnos

export async function listarPendientes(query: ListarPendientesQuery): Promise<AlumnoPendiente[]> {
  const { rows } = await getPool().query<AlumnoPendiente>(
    `SELECT np.evaninopen_id,
            n.nino_id,
            n.nino_nombre,
            n.nino_foto,
            g.catninograd_nombre,
            np.est_id,
            np.evaninopen_fecha_finalizacion,
            reg.usu_nombre AS evaluado_por,
            COALESCE(sum(i.evaint_puntaje_obtenido), 0)::float8 AS puntaje,
            count(i.evaint_id)::int AS intentos_registrados
       FROM public.evaluacion_nino_pendiente np
       JOIN public.nino_asignacion na ON na.ninoasig_id = np.ninoasig_id
       JOIN public.nino n ON n.nino_id = na.nino_id
       LEFT JOIN public.categoria_nino_grado g ON g.catninograd_id = n.catninograd_id
       LEFT JOIN public.usuario reg ON reg.usu_id = np.usu_id_registrador
       LEFT JOIN public.evaluacion_intento i ON i.evaninopen_id = np.evaninopen_id
      WHERE np.eva_id = $1
        AND na.colacthor_id = $2
        AND np.est_id <> ${ESTADO.INACTIVO}
        AND ($3::int IS NULL OR np.est_id = $3)
        AND ($4::text IS NULL OR ${contieneSinTildes('n.nino_nombre', '$4')})
      GROUP BY np.evaninopen_id, n.nino_id, n.nino_nombre, n.nino_foto,
               g.catninograd_nombre, np.est_id, np.evaninopen_fecha_finalizacion, reg.usu_nombre
      ORDER BY n.nino_nombre`,
    [
      query.evaluacion,
      query.disciplina,
      query.estado ?? null,
      query.buscar && query.buscar.length > 0 ? query.buscar : null,
    ],
  );
  return rows;
}

export interface FichaPendiente {
  evaninopen_id: number;
  eva_id: number;
  eva_titulo: string;
  eva_puntaje_total: number;
  nino_id: number;
  nino_nombre: string;
  nino_foto: string | null;
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_nombre: string;
  est_id: number;
  evaninopen_fecha_finalizacion: string | null;
  evaluado_por: string | null;
}

export async function obtenerPendiente(evaninopenId: number): Promise<FichaPendiente | null> {
  const { rows } = await getPool().query<FichaPendiente>(
    `SELECT np.evaninopen_id,
            np.eva_id,
            e.eva_titulo,
            e.eva_puntaje_total::float8 AS eva_puntaje_total,
            n.nino_id,
            n.nino_nombre,
            n.nino_foto,
            na.colacthor_id,
            cah.col_id,
            c.col_nombre,
            act.act_nombre,
            np.est_id,
            np.evaninopen_fecha_finalizacion,
            reg.usu_nombre AS evaluado_por
       FROM public.evaluacion_nino_pendiente np
       JOIN public.evaluacion e ON e.eva_id = np.eva_id
       JOIN public.nino_asignacion na ON na.ninoasig_id = np.ninoasig_id
       JOIN public.nino n ON n.nino_id = na.nino_id
       JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = na.colacthor_id
       JOIN public.colegio c ON c.col_id = cah.col_id
       JOIN public.actividad act ON act.act_id = cah.act_id
       LEFT JOIN public.usuario reg ON reg.usu_id = np.usu_id_registrador
      WHERE np.evaninopen_id = $1`,
    [evaninopenId],
  );
  return rows[0] ?? null;
}

export async function listarIntentos(evaninopenId: number): Promise<IntentoGuardado[]> {
  const { rows } = await getPool().query<IntentoGuardado>(
    `SELECT evaint_id, evaparam_id, evaint_intento, evaint_tiempo, evaint_logro,
            evaint_num, evaint_mobak, evaint_puntaje_obtenido::float8 AS evaint_puntaje_obtenido
       FROM public.evaluacion_intento
      WHERE evaninopen_id = $1
      ORDER BY evaparam_id, evaint_intento`,
    [evaninopenId],
  );
  return rows;
}

export async function borrarIntentosDe(client: PoolClient, evaninopenId: number): Promise<number> {
  const { rowCount } = await client.query(
    `DELETE FROM public.evaluacion_intento WHERE evaninopen_id = $1`,
    [evaninopenId],
  );
  return rowCount ?? 0;
}

export async function insertarIntento(
  client: PoolClient,
  evaninopenId: number,
  intento: {
    evaparam_id: number;
    evaint_intento: number;
    tiempo: number | null;
    logro: boolean | null;
    num: number | null;
    mobak: number | null;
    puntaje: number;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO public.evaluacion_intento
         (evaninopen_id, evaparam_id, evaint_intento, evaint_tiempo, evaint_logro,
          evaint_num, evaint_mobak, evaint_puntaje_obtenido)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      evaninopenId,
      intento.evaparam_id,
      intento.evaint_intento,
      intento.tiempo,
      intento.logro,
      intento.num,
      intento.mobak,
      intento.puntaje,
    ],
  );
}

/**
 * Marca al alumno evaluado o lo devuelve a pendiente.
 *
 * `usu_id_registrador` y la fecha de finalizacion se ponen juntos o se quitan
 * juntos: una pendiente con fecha pero sin registrador —o al reves— es un
 * estado que el sistema viejo si producia, porque escribia los dos campos en
 * updates separados.
 */
export async function marcarEstadoPendiente(
  client: PoolClient,
  evaninopenId: number,
  evaluado: boolean,
  registrador: number | null,
): Promise<void> {
  await client.query(
    `UPDATE public.evaluacion_nino_pendiente
        SET est_id = $2,
            usu_id_registrador = $3,
            evaninopen_fecha_finalizacion = CASE WHEN $2 = ${ESTADO.EVALUADO} THEN now() ELSE NULL END
      WHERE evaninopen_id = $1`,
    [evaninopenId, evaluado ? ESTADO.EVALUADO : ESTADO.PENDIENTE, evaluado ? registrador : null],
  );
}
