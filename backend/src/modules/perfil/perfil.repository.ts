import { getPool } from '../../config/db.js';
import { ESTADO } from '../../lib/constants.js';
import { horarioTexto } from '../../lib/horarios.js';

/**
 * Lo que la persona tiene a cargo, para enseñarlo en su Perfil (2026-10-07).
 * Todo sale del usu_id del token: nadie ve aquí lo de otro.
 */

export interface ColegioACargo {
  col_id: number;
  col_nombre: string;
}

/** Colegios que coordina. */
export async function colegiosQueCoordina(usuId: number): Promise<ColegioACargo[]> {
  const { rows } = await getPool().query<ColegioACargo>(
    `SELECT c.col_id, c.col_nombre
       FROM public.colegio_coordinador cc
       JOIN public.colegio c ON c.col_id = cc.col_id
      WHERE cc.usu_id = $1
      ORDER BY c.col_nombre`,
    [usuId],
  );
  return rows;
}

export interface DisciplinaQueDa {
  colacthor_id: number;
  act_nombre: string;
  col_nombre: string;
  horario: string | null;
  alumnos: number;
}

/** Disciplinas que da como entrenador (asignaciones abiertas). */
export async function disciplinasQueDa(usuId: number): Promise<DisciplinaQueDa[]> {
  const { rows } = await getPool().query<DisciplinaQueDa>(
    `SELECT d.colacthor_id, a.act_nombre, c.col_nombre,
            ${horarioTexto('d')} AS horario,
            (SELECT count(*) FROM public.nino_asignacion na
              WHERE na.colacthor_id = d.colacthor_id AND na.est_id = $2)::int AS alumnos
       FROM public.entrenador_asignacion ea
       JOIN public.colegio_actividad_horario d ON d.colacthor_id = ea.colacthor_id
       JOIN public.actividad a ON a.act_id = d.act_id
       JOIN public.colegio c ON c.col_id = d.col_id
      WHERE ea.ent_id = $1 AND ea.est_id = $2 AND ea.entasig_fecha_fin IS NULL
      ORDER BY c.col_nombre, a.act_nombre`,
    [usuId, ESTADO.ACTIVO],
  );
  return rows;
}
