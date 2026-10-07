import type { PoolClient } from 'pg';
import { getPool } from '../config/db.js';
import { ESTADO } from './constants.js';

/**
 * Horarios de las disciplinas (Disciplinas v2, migracion 0021).
 *
 * Una disciplina es un grupo con varios dias, cada uno con su hora, en
 * `disciplina_horario`. Aqui vive lo que comparten los modulos: como se
 * pinta el horario en SQL y como se detecta un cruce.
 *
 * Cruce = mismo dia y franjas que se pisan. 15:00-16:00 y 16:00-17:00 NO se
 * cruzan: OVERLAPS trata el final como abierto.
 */

/** Texto del horario de la disciplina `alias.colacthor_id`: "Lun y Mié 15:00–16:00". */
export function horarioTexto(alias = 'd'): string {
  return `public.disciplina_horario_texto(${alias}.colacthor_id)`;
}

/** Los dias como array JSON [{dia_id, dia_nombre, inicio, fin}], ordenados. */
export function horariosJson(alias = 'd'): string {
  return `(SELECT COALESCE(json_agg(json_build_object(
                    'dia_id', h.dia_id,
                    'dia_nombre', dd.dia_nombre,
                    'inicio', to_char(h.dishor_hora_inicio, 'HH24:MI'),
                    'fin', to_char(h.dishor_hora_fin, 'HH24:MI'))
                  ORDER BY h.dia_id), '[]'::json)
            FROM public.disciplina_horario h
            JOIN public.dia dd ON dd.dia_id = h.dia_id
           WHERE h.colacthor_id = ${alias}.colacthor_id)`;
}

/** El primer dia y hora de la disciplina, para ordenar listados. */
export function primerHorario(alias = 'd'): string {
  return `(SELECT min(h.dia_id * 10000 + extract(hour from h.dishor_hora_inicio) * 100
                     + extract(minute from h.dishor_hora_inicio))
             FROM public.disciplina_horario h WHERE h.colacthor_id = ${alias}.colacthor_id)`;
}

/** Condicion "la disciplina tiene clase el dia `param`". */
export function tieneDia(param: string, alias = 'd'): string {
  return `EXISTS (SELECT 1 FROM public.disciplina_horario h
                   WHERE h.colacthor_id = ${alias}.colacthor_id AND h.dia_id = ${param})`;
}

export interface HorarioDisciplina {
  dia_id: number;
  dia_nombre: string;
  inicio: string;
  fin: string;
}

export interface Cruce {
  a: number;
  b: number;
  a_nombre: string;
  b_nombre: string;
  dia_nombre: string;
}

const NOMBRE = (alias: string) =>
  `(SELECT act.act_nombre || ' — ' || col.col_nombre || ' (' || public.disciplina_horario_texto(x.colacthor_id) || ')'
      FROM public.colegio_actividad_horario x
      JOIN public.actividad act ON act.act_id = x.act_id
      JOIN public.colegio col ON col.col_id = x.col_id
     WHERE x.colacthor_id = ${alias})`;

/**
 * Pares de disciplinas de `ids` que se cruzan entre si. Vacio = compatibles.
 */
export async function crucesEntre(
  ids: number[],
  client?: PoolClient,
): Promise<Cruce[]> {
  const unicos = [...new Set(ids)];
  if (unicos.length < 2) return [];
  const { rows } = await (client ?? getPool()).query<Cruce>(
    `SELECT DISTINCT ON (a.colacthor_id, b.colacthor_id)
            a.colacthor_id AS a, b.colacthor_id AS b,
            ${NOMBRE('a.colacthor_id')} AS a_nombre,
            ${NOMBRE('b.colacthor_id')} AS b_nombre,
            dd.dia_nombre
       FROM public.disciplina_horario a
       JOIN public.disciplina_horario b
         ON b.dia_id = a.dia_id AND b.colacthor_id > a.colacthor_id
        AND (a.dishor_hora_inicio, a.dishor_hora_fin) OVERLAPS (b.dishor_hora_inicio, b.dishor_hora_fin)
       JOIN public.dia dd ON dd.dia_id = a.dia_id
      WHERE a.colacthor_id = ANY($1::int[]) AND b.colacthor_id = ANY($1::int[])
      ORDER BY a.colacthor_id, b.colacthor_id, a.dia_id`,
    [unicos],
  );
  return rows;
}

/** Disciplinas activas en las que esta inscrito el nino. */
export async function disciplinasActivasDeNino(
  ninoId: number,
  client?: PoolClient,
): Promise<number[]> {
  const { rows } = await (client ?? getPool()).query<{ colacthor_id: number }>(
    `SELECT na.colacthor_id FROM public.nino_asignacion na
      WHERE na.nino_id = $1 AND na.est_id = $2`,
    [ninoId, ESTADO.ACTIVO],
  );
  return rows.map((r) => r.colacthor_id);
}

/** Disciplinas que el entrenador tiene abiertas. */
export async function disciplinasAbiertasDeEntrenador(
  entId: number,
  client?: PoolClient,
): Promise<number[]> {
  const { rows } = await (client ?? getPool()).query<{ colacthor_id: number }>(
    `SELECT ea.colacthor_id FROM public.entrenador_asignacion ea
      WHERE ea.ent_id = $1 AND ea.est_id = $2 AND ea.entasig_fecha_fin IS NULL`,
    [entId, ESTADO.ACTIVO],
  );
  return rows.map((r) => r.colacthor_id);
}

/** "Fútbol — Colegio X (Lun 15:00–16:00) y Danza — … se cruzan el Lunes". */
export function describirCruce(c: Cruce): string {
  return `${c.a_nombre} y ${c.b_nombre} se cruzan el ${c.dia_nombre.toLowerCase()}`;
}

/**
 * Quien quedaria cruzado si la disciplina `colacthorId` tuviera los horarios
 * que ya tiene escritos (se llama dentro de la transaccion, despues de
 * reemplazarlos): alumnos activos y entrenadores con la asignacion abierta.
 */
export async function afectadosPorCruce(
  client: PoolClient,
  colacthorId: number,
): Promise<{ alumnos: string[]; entrenadores: string[] }> {
  const { rows: alumnos } = await client.query<{ nombre: string }>(
    `SELECT DISTINCT n.nino_nombre AS nombre
       FROM public.nino_asignacion yo
       JOIN public.nino n ON n.nino_id = yo.nino_id
       JOIN public.nino_asignacion otra
         ON otra.nino_id = yo.nino_id AND otra.colacthor_id <> yo.colacthor_id AND otra.est_id = $2
       JOIN public.disciplina_horario a ON a.colacthor_id = yo.colacthor_id
       JOIN public.disciplina_horario b ON b.colacthor_id = otra.colacthor_id AND b.dia_id = a.dia_id
        AND (a.dishor_hora_inicio, a.dishor_hora_fin) OVERLAPS (b.dishor_hora_inicio, b.dishor_hora_fin)
      WHERE yo.colacthor_id = $1 AND yo.est_id = $2
      ORDER BY 1`,
    [colacthorId, ESTADO.ACTIVO],
  );
  const { rows: entrenadores } = await client.query<{ nombre: string }>(
    `SELECT DISTINCT u.usu_nombre AS nombre
       FROM public.entrenador_asignacion yo
       JOIN public.usuario u ON u.usu_id = yo.ent_id
       JOIN public.entrenador_asignacion otra
         ON otra.ent_id = yo.ent_id AND otra.colacthor_id <> yo.colacthor_id
        AND otra.est_id = $2 AND otra.entasig_fecha_fin IS NULL
       JOIN public.disciplina_horario a ON a.colacthor_id = yo.colacthor_id
       JOIN public.disciplina_horario b ON b.colacthor_id = otra.colacthor_id AND b.dia_id = a.dia_id
        AND (a.dishor_hora_inicio, a.dishor_hora_fin) OVERLAPS (b.dishor_hora_inicio, b.dishor_hora_fin)
      WHERE yo.colacthor_id = $1 AND yo.est_id = $2 AND yo.entasig_fecha_fin IS NULL
      ORDER BY 1`,
    [colacthorId, ESTADO.ACTIVO],
  );
  return {
    alumnos: alumnos.map((r) => r.nombre),
    entrenadores: entrenadores.map((r) => r.nombre),
  };
}

/**
 * El mismo calculo que `crucesEntre`, pero sobre horarios ya cargados (para
 * el formulario publico, que valida antes de que exista nada en la base).
 * Devuelve el dia en que se pisan, o null. "HH:MM" se compara como texto.
 */
export function diaDeCruce(a: HorarioDisciplina[], b: HorarioDisciplina[]): string | null {
  for (const x of a) {
    for (const y of b) {
      if (x.dia_id === y.dia_id && x.inicio < y.fin && y.inicio < x.fin) return x.dia_nombre;
    }
  }
  return null;
}

/**
 * El horario con los días completos: "Lunes y Miércoles 15:00–16:00" o
 * "Lunes 15:00–16:00 · Miércoles 16:00–17:00". Es lo que ve el representante
 * en el formulario público y en su ficha (pedido del cliente, 2026-10-06);
 * las pantallas internas usan la abreviada de `disciplina_horario_texto`.
 */
export function horarioLargo(horarios: HorarioDisciplina[]): string {
  const franjas = new Map<string, HorarioDisciplina[]>();
  for (const h of [...horarios].sort((a, b) => a.dia_id - b.dia_id)) {
    const clave = `${h.inicio}–${h.fin}`;
    franjas.set(clave, [...(franjas.get(clave) ?? []), h]);
  }
  return [...franjas.entries()]
    .map(([horas, dias]) => {
      const nombres = dias.map((d) => d.dia_nombre);
      const lista =
        nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0];
      return `${lista} ${horas}`;
    })
    .join(' · ');
}
