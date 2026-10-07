import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import type { Alcance } from '../../lib/alcance.js';
import { ESTADO } from '../../lib/constants.js';
import { offsetDe, ordenSeguro, type Paginacion } from '../../lib/paginacion.js';
import { horarioTexto, horariosJson, primerHorario, tieneDia, type HorarioDisciplina } from '../../lib/horarios.js';
import { contieneSinTildes, paramsUsados } from '../../lib/sql.js';
import type { Franja, ListarDisciplinasQuery } from './disciplinas.schemas.js';
import { HOY_EC } from '../../lib/fecha.js';

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
  /** Color pastel de la actividad (0022) o null. */
  act_color: string | null;
  cat_nombre: string | null;
  /** Sus dias, cada uno con su hora, ordenados de lunes a domingo. */
  horarios: HorarioDisciplina[];
  /** "Lun y Mié 15:00–16:00". */
  horario_texto: string | null;
  est_id: number;
  colacthor_fecha_creacion: string | null;
  /** Entrenadores con asignacion activa. Normalmente uno; el modelo admite varios. */
  entrenadores: EntrenadorDeDisciplina[];
  /** Alumnos con inscripcion activa. */
  alumnos: number;
  /** Evaluaciones asignadas a esta disciplina. */
  evaluaciones: number;
  /**
   * Solo para un representante: cuáles de SUS hijos van a esta disciplina
   * (2026-10-07). Vacío para el personal: nunca lleva alumnos ajenos.
   */
  hijos?: Array<{ nino_id: number; nino_nombre: string }>;
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
                                     OR EXISTS (SELECT 1 FROM public.disciplina_horario hb
                                                  JOIN public.dia db ON db.dia_id = hb.dia_id
                                                 WHERE hb.colacthor_id = d.colacthor_id
                                                   AND ${contieneSinTildes('db.dia_nombre', '$3')}))`;

const F_COLEGIO = `($4::int[] IS NULL OR d.col_id = ANY($4::int[]))`;
const F_ACTIVIDAD = `($5::int[] IS NULL OR d.act_id = ANY($5::int[]))`;
const F_DIA = `($6::int IS NULL OR ${tieneDia('$6')})`;
const F_ESTADO = `($7::int IS NULL OR d.est_id = $7)`;
const F_SIN_ENTRENADOR = `(NOT $8::boolean OR COALESCE(ent.n, 0) = 0)`;

const COLUMNAS_ORDEN: Record<string, string> = {
  horario: 'primer_horario',
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
        act.act_color,
        cat.cat_nombre,
        ${horariosJson('d')} AS horarios,
        ${horarioTexto('d')} AS horario_texto,
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
    LEFT JOIN public.categoria cat ON cat.cat_id = act.cat_id
    ${LATERALES}
`;

function params(query: ListarDisciplinasQuery, alcance: Alcance): unknown[] {
  return [
    alcance.global,
    // El representante ve en la lista las disciplinas de sus hijos (y nada más).
    [...new Set([...alcance.disciplinas, ...alcance.disciplinasDeHijos])],
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
  const columna = ordenSeguro(query.orden, COLUMNAS_ORDEN, 'primer_horario');
  const direccion = query.dir === 'desc' ? 'DESC' : 'ASC';
  const paginacion: Paginacion = { page: query.page, limit: query.limit };

  const { rows } = await getPool().query<DisciplinaListada & { total: string; primer_horario: unknown }>(
    `
    SELECT ${COLUMNAS}, ${primerHorario('d')} AS primer_horario, count(*) OVER() AS total,
           COALESCE((
               SELECT json_agg(json_build_object('nino_id', n.nino_id, 'nino_nombre', n.nino_nombre)
                               ORDER BY n.nino_nombre)
                 FROM public.nino_asignacion na
                 JOIN public.nino n ON n.nino_id = na.nino_id
                WHERE na.colacthor_id = d.colacthor_id
                  AND na.est_id = ${ESTADO.ACTIVO}
                  AND na.nino_id = ANY($11::int[])
           ), '[]'::json) AS hijos
    ${DESDE}
    WHERE ${F_ALCANCE} AND ${F_BUSCAR} AND ${F_COLEGIO} AND ${F_ACTIVIDAD}
      AND ${F_DIA} AND ${F_ESTADO} AND ${F_SIN_ENTRENADOR}
    ORDER BY ${columna} ${direccion}, primer_horario ASC, col.col_nombre ASC, d.colacthor_id ASC
    LIMIT $9 OFFSET $10
    `,
    // $11: los hijos del representante (alcance.ninos); vacío para el personal.
    [...params(query, alcance), paginacion.limit, offsetDe(paginacion), alcance.ninos],
  );

  const total = rows.length > 0 ? Number(rows[0]?.total ?? 0) : 0;
  return { items: rows.map(({ total: _t, primer_horario: _p, ...resto }) => resto), total };
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
 * La misma actividad en el mismo colegio pisando horario algún día.
 *
 * Se llama con los horarios ya escritos, dentro de la transaccion. No es lo
 * mismo que dos actividades distintas a la misma hora (eso es legitimo: son
 * dos grupos en espacios distintos): dos grupos de la misma actividad que se
 * pisan no se distinguen —no tienen nombre de grupo— y las asistencias de esa
 * tarde acabarian en uno u otro al azar. El duplicado exacto es un caso de
 * esto.
 */
export async function haySolape(
  client: PoolClient,
  colacthorId: number,
): Promise<{ dia_nombre: string; inicio: string; fin: string } | null> {
  const { rows } = await client.query<{ dia_nombre: string; inicio: string; fin: string }>(
    `SELECT dd.dia_nombre,
            to_char(b.dishor_hora_inicio, 'HH24:MI') AS inicio,
            to_char(b.dishor_hora_fin, 'HH24:MI')    AS fin
       FROM public.colegio_actividad_horario yo
       JOIN public.colegio_actividad_horario otra
         ON otra.col_id = yo.col_id AND otra.act_id = yo.act_id
        AND otra.colacthor_id <> yo.colacthor_id AND otra.est_id = $2
       JOIN public.disciplina_horario a ON a.colacthor_id = yo.colacthor_id
       JOIN public.disciplina_horario b ON b.colacthor_id = otra.colacthor_id AND b.dia_id = a.dia_id
        AND (a.dishor_hora_inicio, a.dishor_hora_fin) OVERLAPS (b.dishor_hora_inicio, b.dishor_hora_fin)
       JOIN public.dia dd ON dd.dia_id = a.dia_id
      WHERE yo.colacthor_id = $1
      ORDER BY a.dia_id
      LIMIT 1`,
    [colacthorId, ESTADO.ACTIVO],
  );
  return rows[0] ?? null;
}

export async function insertarDisciplina(
  client: PoolClient,
  datos: { colId: number; actId: number },
): Promise<number> {
  const { rows } = await client.query<{ colacthor_id: number }>(
    `INSERT INTO public.colegio_actividad_horario (col_id, act_id, est_id)
     VALUES ($1, $2, $3)
     RETURNING colacthor_id`,
    [datos.colId, datos.actId, ESTADO.ACTIVO],
  );
  return rows[0]!.colacthor_id;
}

/** Sustituye los dias de la disciplina por `horarios`. */
export async function reemplazarHorarios(
  client: PoolClient,
  colacthorId: number,
  horarios: Franja[],
): Promise<void> {
  await client.query('DELETE FROM public.disciplina_horario WHERE colacthor_id = $1', [colacthorId]);
  await client.query(
    `INSERT INTO public.disciplina_horario (colacthor_id, dia_id, dishor_hora_inicio, dishor_hora_fin)
     SELECT $1, f.dia_id, f.inicio::time, f.fin::time
       FROM json_to_recordset($2::json) AS f(dia_id smallint, inicio text, fin text)`,
    [colacthorId, JSON.stringify(horarios)],
  );
}

export async function actualizarDisciplina(
  client: PoolClient,
  colacthorId: number,
  campos: { colId?: number; actId?: number },
): Promise<void> {
  await client.query(
    `UPDATE public.colegio_actividad_horario
        SET col_id = COALESCE($2::int, col_id),
            act_id = COALESCE($3::int, act_id)
      WHERE colacthor_id = $1`,
    [colacthorId, campos.colId ?? null, campos.actId ?? null],
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
): Promise<{ inscripciones: number; asignaciones: number; entrenadores: number[] }> {
  const inscripciones = await client.query(
    `UPDATE public.nino_asignacion
        SET est_id = $2, ninoasig_fecha_baja = now()
      WHERE colacthor_id = $1 AND est_id = $3`,
    [colacthorId, ESTADO.INACTIVO, ESTADO.ACTIVO],
  );
  const asignaciones = await client.query(
    `UPDATE public.entrenador_asignacion
        SET est_id = $2, entasig_fecha_fin = ${HOY_EC}
      WHERE colacthor_id = $1 AND est_id = $3 AND entasig_fecha_fin IS NULL
      RETURNING ent_id`,
    [colacthorId, ESTADO.INACTIVO, ESTADO.ACTIVO],
  );
  return {
    inscripciones: inscripciones.rowCount ?? 0,
    asignaciones: asignaciones.rowCount ?? 0,
    entrenadores: asignaciones.rows.map((r: { ent_id: number }) => r.ent_id),
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
