import type { PoolClient } from 'pg';
import { ESTADO } from './constants.js';

/**
 * Auxiliares que se quedan sin titular.
 *
 * El auxiliar va atado al entrenador, no a la disciplina. Regla del cliente
 * (2026-10-07): cuando un entrenador se queda **sin ninguna disciplina** —por
 * reemplazo, por quitarle la ultima, por baja de la disciplina o por baja de
 * la persona— sus auxiliares se desvinculan. Si aun da otras, siguen con el.
 *
 * No pasan solos al entrenador nuevo: se asignan a mano, y la pantalla
 * muestra un recordatorio con esta lista.
 *
 * Desvincular es baja logica (`est_id = 2`): la fila se queda y las
 * asistencias del auxiliar no se tocan.
 */
export interface AuxiliarDesvinculado {
  auxiliar: string;
  titular: string;
}

export async function soltarAuxiliaresSinClases(
  client: PoolClient,
  entIds: number[],
): Promise<AuxiliarDesvinculado[]> {
  if (entIds.length === 0) return [];
  const { rows } = await client.query<AuxiliarDesvinculado>(
    `UPDATE public.entrenador_auxiliar aux
        SET est_id = $2
       FROM public.usuario a, public.usuario t
      WHERE aux.ent_id = ANY($1::int[])
        AND aux.est_id = $3
        AND a.usu_id = aux.usu_id
        AND t.usu_id = aux.ent_id
        AND NOT EXISTS (SELECT 1 FROM public.entrenador_asignacion ea
                         WHERE ea.ent_id = aux.ent_id AND ea.entasig_fecha_fin IS NULL)
      RETURNING a.usu_nombre AS auxiliar, t.usu_nombre AS titular`,
    [[...new Set(entIds)], ESTADO.INACTIVO, ESTADO.ACTIVO],
  );
  return rows;
}
