import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import type { Alcance } from '../../lib/alcance.js';
import { ESTADO } from '../../lib/constants.js';
import { offsetDe, ordenSeguro, type Paginacion } from '../../lib/paginacion.js';
import { contieneSinTildes, paramsUsados } from '../../lib/sql.js';
import type { ListarDisciplinasQuery } from './disciplinas.schemas.js';

export interface EntrenadorDeDisciplina {
  usu_id: number;
  usu_nombre: string;
}

export interface DisciplinaListada {
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_id: number;
  act_nombre: string;
  cat_nombre: string | null;
  dia_id: number;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  est_id: number;
  colacthor_fecha_creacion: string | null;
  /** Entrenadores con asignacion activa. Normalmente uno; el modelo admite varios. */
  entrenadores: EntrenadorDeDisciplina[];
  /** Alumnos con inscripcion activa. */
  alumnos: number;
  /** Evaluaciones asignadas a esta disciplina. */
  evaluaciones: number;
}

/**
 * Alcance.
 *
 * El coordinador ve las disciplinas de sus colegios; el entrenador y sus
 * auxiliares, las que tienen asignadas; el representante, las de sus hijos.
 * Todo eso ya lo resuelve alcanceDe y llega aqui como dos listas.
 *
 * En el sistema viejo esto eran cinco ramas con `return` temprano dentro del
 * propio componente, y cuando la lista salia vacia el filtro no se aplicaba:
 * se devolvian todas las disciplinas del sistema.
 */
const F_ALCANCE = `($1::boolean OR d.colacthor_id = ANY($2::int[]))`;

const F_BUSCAR = `($3::text IS NULL OR ${contieneSinTildes('col.col_nombre', '$3')}
                                     OR ${contieneSinTildes('act.act_nombre', '$3')}
                                     OR ${contieneSinTildes('dia.dia_nombre', '$3')})`;

const F_COLEGIO = `($4::int[] IS NULL OR d.col_id = ANY($4::int[]))`;
const F_ACTIVIDAD = `($5::int[] IS NULL OR d.act_id = ANY($5::int[]))`;
const F_DIA = `($6::int IS NULL OR d.dia_id = $6)`;
const F_ESTADO = `($7::int IS NULL OR d.est_id = $7)`;
const F_SIN_ENTRENADOR = `(NOT $8::boolean OR COALESCE(ent.n, 0) = 0)`;

const COLUMNAS_ORDEN: Record<string, string> = {
  horario: 'd.dia_id',
  colegio: 'col.col_nombre',
  actividad: 'act.act_nombre',
  creacion: 'd.colacthor_fecha_creacion',
  alumnos: 'alumnos',
};

const LATERALES = `
    LEFT JOIN LATERAL (
        SELECT json_agg(
                   jsonb_build_object('usu_id', u.usu_id, 'usu_nombre', u.usu_nombre)
                   ORDER BY u.usu_nombre
               ) AS lista,
               count(*) AS n
        FROM public.entrenador_asignacion ea
        JOIN public.usuario u ON u.usu_id = ea.ent_id
        WHERE ea.colacthor_id = d.colacthor_id
          AND ea.est_id = ${ESTADO.ACTIVO}
          AND ea.entasig_fecha_fin IS NULL
    ) ent ON TRUE
    LEFT JOIN LATERAL (
        SELECT count(*) AS n
        FROM public.nino_asignacion na
        WHERE na.colacthor_id = d.colacthor_id AND na.est_id = ${ESTADO.ACTIVO}
    ) al ON TRUE
    LEFT JOIN LATERAL (
        SELECT count(*) AS n
        FROM public.evaluacion_asignacion eva
        WHERE eva.colacthor_id = d.colacthor_id
    ) ev ON TRUE
`;

const COLUMNAS = `
        d.colacthor_id,
        d.col_id,
        col.col_nombre,
        d.act_id,
        act.act_nombre,
        cat.cat_nombre,
        d.dia_id,
        dia.dia_nombre,
        d.colacthor_hora_inicio,
        d.colacthor_hora_fin,
        d.est_id,
        d.colacthor_fecha_creacion,
        COALESCE(ent.lista, '[]'::json) AS entrenadores,
        COALESCE(al.n, 0)::int AS alumnos,
        COALESCE(ev.n, 0)::int AS evaluaciones
`;

const DESDE = `
    FROM public.colegio_actividad_horario d
    JOIN public.colegio   col ON col.col_id = d.col_id
    JOIN public.actividad act ON act.act_id = d.act_id
    JOIN public.dia       dia ON dia.dia_id = d.dia_id
    LEFT JOIN public.categoria cat ON cat.cat_id = act.cat_id
    ${LATERALES}
`;

function params(query: ListarDisciplinasQuery, alcance: Alcance): unknown[] {
  return [
    alcance.global,
    alcance.disciplinas,
    query.buscar && query.buscar.length > 0 ? query.buscar : null,
    query.colegio ?? null,
    query.actividad ?? null,
    query.dia ?? null,
    query.estado ?? null,
    query.sinEntrenador === true,
  ];
}

export async function listarDisciplinas(
  query: ListarDisciplinasQuery,
  alcance: Alcance,
): Promise<{ items: DisciplinaListada[]; total: number }> {
  const columna = ordenSeguro(query.orden, COLUMNAS_ORDEN, 'd.dia_id');
  const direccion = query.dir === 'desc' ? 'DESC' : 'ASC';
  const paginacion: Paginacion = { page: query.page, limit: query.limit };

  const { rows } = await getPool().query<DisciplinaListada & { total: string }>(
    `
    SELECT ${COLUMNAS}, count(*) OVER() AS total
    ${DESDE}
    WHERE ${F_ALCANCE} AND ${F_BUSCAR} AND ${F_COLEGIO} AND ${F_ACTIVIDAD}
      AND ${F_DIA} AND ${F_ESTADO} AND ${F_SIN_ENTRENADOR}
    ORDER BY ${columna} ${direccion}, d.colacthor_hora_inicio ASC, col.col_nombre ASC, d.colacthor_id ASC
    LIMIT $9 OFFSET $10
    `,
    [...params(query, alcance), paginacion.limit, offsetDe(paginacion)],
  );

  const total = rows.length > 0 ? Number(rows[0]?.total ?? 0) : 0;
  return { items: rows.map(({ total: _t, ...resto }) => resto), total };
}

/**
 * Resumen de la cabecera: cuantas hay, cuantas sin entrenador y cuantos
 * alumnos inscritos en total, dentro del alcance y de los filtros.
 *
 * En la pantalla vieja estos numeros salian de contar el array cargado, que
 * con paginacion de verdad seria el de la pagina actual.
 */
export interface ConteosDisciplinas {
  total: number;
  activas: number;
  deBaja: number;
  sinEntrenador: number;
  alumnos: number;
}

export async function contarDisciplinas(
  query: ListarDisciplinasQuery,
  alcance: Alcance,
): Promise<ConteosDisciplinas> {
  const sql = `
    WITH base AS (
        SELECT d.est_id, COALESCE(ent.n, 0) AS entrenadores, COALESCE(al.n, 0) AS alumnos
        ${DESDE}
        WHERE ${F_ALCANCE} AND ${F_BUSCAR} AND ${F_COLEGIO} AND ${F_ACTIVIDAD} AND ${F_DIA}
    )
    SELECT count(*)                                            AS total,
           count(*) FILTER (WHERE est_id = ${ESTADO.ACTIVO})   AS activas,
           count(*) FILTER (WHERE est_id <> ${ESTADO.ACTIVO})  AS de_baja,
           count(*) FILTER (WHERE entrenadores = 0)            AS sin_entrenador,
           COALESCE(sum(alumnos), 0)                           AS alumnos
    FROM base
  `;

  // Sin estado ni "sin entrenador": esta consulta no los menciona.
  const { rows } = await getPool().query<Record<string, string>>(
    sql,
    paramsUsados(sql, params(query, alcance)),
  );

  const n = (k: string): number => Number(rows[0]?.[k] ?? 0);
  return {
    total: n('total'),
    activas: n('activas'),
    deBaja: n('de_baja'),
    sinEntrenador: n('sin_entrenador'),
    alumnos: n('alumnos'),
  };
}

export async function obtenerDisciplina(
  colacthorId: number,
  client?: PoolClient,
): Promise<DisciplinaListada | null> {
  const ejecutor = client ?? getPool();
  const { rows } = await ejecutor.query<DisciplinaListada>(
    `SELECT ${COLUMNAS} ${DESDE} WHERE d.colacthor_id = $1`,
    [colacthorId],
  );
  return rows[0] ?? null;
}

/**
 * Dos disciplinas iguales: mismo colegio, misma actividad, mismo dia y misma
 * hora de inicio. La base no lo impide y la pantalla vieja tampoco, asi que se
 * podian crear copias exactas que despues aparecian dos veces en el calendario
 * y en todos los selectores.
 */
export async function existeIgual(
  client: PoolClient,
  datos: { colId: number; actId: number; diaId: number; horaInicio: string },
  excluyendo: number | null,
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM public.colegio_actividad_horario
      WHERE col_id = $1 AND act_id = $2 AND dia_id = $3
        AND colacthor_hora_inicio = $4::time
        AND ($5::int IS NULL OR colacthor_id <> $5)
      LIMIT 1`,
    [datos.colId, datos.actId, datos.diaId, datos.horaInicio, excluyendo],
  );
  return rows.length > 0;
}

/**
 * Misma actividad, mismo colegio, mismo dia y horarios que se pisan.
 *
 * No es lo mismo que el duplicado exacto: "karate 15:00-16:00" y "karate
 * 15:30-16:30" en el mismo colegio y dia no son la misma fila, pero no pueden
 * existir las dos — es el mismo grupo partido en dos, y las asistencias de esa
 * tarde acabarian en una u otra al azar.
 *
 * Dos actividades distintas a la misma hora si son legitimas: son dos grupos
 * en espacios distintos.
 */
export async function haySolape(
  client: PoolClient,
  datos: {
    colId: number;
    actId: number;
    diaId: number;
    horaInicio: string;
    horaFin: string;
  },
  excluyendo: number | null,
): Promise<{ colacthor_id: number; inicio: string; fin: string } | null> {
  const { rows } = await client.query<{ colacthor_id: number; inicio: string; fin: string }>(
    `SELECT colacthor_id,
            colacthor_hora_inicio::text AS inicio,
            colacthor_hora_fin::text    AS fin
       FROM public.colegio_actividad_horario
      WHERE col_id = $1 AND act_id = $2 AND dia_id = $3
        AND est_id = $6
        AND ($7::int IS NULL OR colacthor_id <> $7)
        AND colacthor_hora_inicio IS NOT NULL
        AND colacthor_hora_fin IS NOT NULL
        AND (colacthor_hora_inicio, colacthor_hora_fin) OVERLAPS ($4::time, $5::time)
      LIMIT 1`,
    [
      datos.colId,
      datos.actId,
      datos.diaId,
      datos.horaInicio,
      datos.horaFin,
      ESTADO.ACTIVO,
      excluyendo,
    ],
  );
  return rows[0] ?? null;
}

export async function insertarDisciplina(
  client: PoolClient,
  datos: {
    colId: number;
    actId: number;
    diaId: number;
    horaInicio: string;
    horaFin: string;
  },
): Promise<number> {
  const { rows } = await client.query<{ colacthor_id: number }>(
    `INSERT INTO public.colegio_actividad_horario
         (col_id, act_id, dia_id, colacthor_hora_inicio, colacthor_hora_fin, est_id)
     VALUES ($1, $2, $3, $4::time, $5::time, $6)
     RETURNING colacthor_id`,
    [datos.colId, datos.actId, datos.diaId, datos.horaInicio, datos.horaFin, ESTADO.ACTIVO],
  );
  return rows[0]!.colacthor_id;
}

export async function actualizarDisciplina(
  client: PoolClient,
  colacthorId: number,
  campos: {
    colId?: number;
    actId?: number;
    diaId?: number;
    horaInicio?: string;
    horaFin?: string;
  },
): Promise<void> {
  await client.query(
    `UPDATE public.colegio_actividad_horario
        SET col_id                = COALESCE($2::int, col_id),
            act_id                = COALESCE($3::int, act_id),
            dia_id                = COALESCE($4::smallint, dia_id),
            colacthor_hora_inicio = COALESCE($5::time, colacthor_hora_inicio),
            colacthor_hora_fin    = COALESCE($6::time, colacthor_hora_fin)
      WHERE colacthor_id = $1`,
    [
      colacthorId,
      campos.colId ?? null,
      campos.actId ?? null,
      campos.diaId ?? null,
      campos.horaInicio ?? null,
      campos.horaFin ?? null,
    ],
  );
}

export async function cambiarEstado(
  client: PoolClient,
  colacthorId: number,
  estId: number,
): Promise<void> {
  await client.query(
    'UPDATE public.colegio_actividad_horario SET est_id = $2 WHERE colacthor_id = $1',
    [colacthorId, estId],
  );
}

/**
 * Lo que arrastra dar de baja una disciplina: sus inscripciones activas se
 * cierran con fecha y las asignaciones de entrenador abiertas tambien.
 *
 * Si no se hiciera, el alumno seguiria "inscrito" en algo que ya no se
 * imparte y el entrenador seguiria teniendola en su alcance.
 */
export async function cerrarDependenciasActivas(
  client: PoolClient,
  colacthorId: number,
): Promise<{ inscripciones: number; asignaciones: number }> {
  const inscripciones = await client.query(
    `UPDATE public.nino_asignacion
        SET est_id = $2, ninoasig_fecha_baja = now()
      WHERE colacthor_id = $1 AND est_id = $3`,
    [colacthorId, ESTADO.INACTIVO, ESTADO.ACTIVO],
  );
  const asignaciones = await client.query(
    `UPDATE public.entrenador_asignacion
        SET est_id = $2, entasig_fecha_fin = CURRENT_DATE
      WHERE colacthor_id = $1 AND est_id = $3 AND entasig_fecha_fin IS NULL`,
    [colacthorId, ESTADO.INACTIVO, ESTADO.ACTIVO],
  );
  return {
    inscripciones: inscripciones.rowCount ?? 0,
    asignaciones: asignaciones.rowCount ?? 0,
  };
}

/** Cuenta lo que se va a cerrar, para ensenarlo antes de confirmar la baja. */
export async function contarDependenciasActivas(
  colacthorId: number,
): Promise<{ inscripciones: number; asignaciones: number }> {
  const { rows } = await getPool().query<Record<string, string>>(
    `SELECT
        (SELECT count(*) FROM public.nino_asignacion
          WHERE colacthor_id = $1 AND est_id = $2) AS inscripciones,
        (SELECT count(*) FROM public.entrenador_asignacion
          WHERE colacthor_id = $1 AND est_id = $2 AND entasig_fecha_fin IS NULL) AS asignaciones`,
    [colacthorId, ESTADO.ACTIVO],
  );
  return {
    inscripciones: Number(rows[0]?.inscripciones ?? 0),
    asignaciones: Number(rows[0]?.asignaciones ?? 0),
  };
}

/**
 * Impacto del borrado permanente.
 *
 * Las cuatro tablas que cuelgan de `colacthor_id` —inscripciones,
 * asignaciones de entrenador, evaluaciones asignadas y asistencias— lo hacen
 * **sin cascada** (verificado en PVCAR_Dev). O sea: una disciplina que se ha
 * usado alguna vez no se borra nunca, y por eso existe la baja.
 */
export interface ImpactoDisciplina {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

export async function calcularImpacto(colacthorId: number): Promise<ImpactoDisciplina> {
  const { rows } = await getPool().query<Record<string, string>>(
    `SELECT
        (SELECT count(*) FROM public.nino_asignacion        WHERE colacthor_id = $1) AS inscripciones,
        (SELECT count(*) FROM public.entrenador_asignacion  WHERE colacthor_id = $1) AS asignaciones,
        (SELECT count(*) FROM public.evaluacion_asignacion  WHERE colacthor_id = $1) AS evaluaciones,
        (SELECT count(*) FROM public.asistencia_nino        WHERE colacthor_id = $1) AS asistencias`,
    [colacthorId],
  );

  const n = (k: string): number => Number(rows[0]?.[k] ?? 0);
  const bloqueosTodos = {
    inscripciones: n('inscripciones'),
    asignaciones: n('asignaciones'),
    evaluaciones: n('evaluaciones'),
    asistencias: n('asistencias'),
  };
  const bloqueos = Object.fromEntries(
    Object.entries(bloqueosTodos).filter(([, valor]) => valor > 0),
  );

  return { eliminables: {}, bloqueos, puedeEliminar: Object.keys(bloqueos).length === 0 };
}

export async function eliminarDisciplina(
  client: PoolClient,
  colacthorId: number,
): Promise<void> {
  await client.query('DELETE FROM public.colegio_actividad_horario WHERE colacthor_id = $1', [
    colacthorId,
  ]);
}

export interface Dia {
  dia_id: number;
  dia_nombre: string;
}

export async function listarDias(): Promise<Dia[]> {
  const { rows } = await getPool().query<Dia>(
    'SELECT dia_id, dia_nombre FROM public.dia ORDER BY dia_id',
  );
  return rows;
}

export async function existeColegio(client: PoolClient, colId: number): Promise<boolean> {
  const { rows } = await client.query('SELECT 1 FROM public.colegio WHERE col_id = $1', [colId]);
  return rows.length > 0;
}

export async function existeActividad(client: PoolClient, actId: number): Promise<boolean> {
  const { rows } = await client.query('SELECT 1 FROM public.actividad WHERE act_id = $1', [actId]);
  return rows.length > 0;
}
