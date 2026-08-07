import { getPool } from '../config/db.js';
import { ESTADO, ROL, ROLES_AUXILIARES, ROLES_GLOBALES } from './constants.js';
import type { UsuarioConRoles } from '../modules/auth/auth.repository.js';

/**
 * Que colegios y que disciplinas puede ver un usuario.
 *
 * ---------------------------------------------------------------------------
 * Por que existe este archivo
 *
 * En el sistema viejo esta regla esta escrita seis veces (useEstudiantesData,
 * useStudentsPagination, useStudentCounts, useSchoolCounts, useAttendanceData
 * y SharedDataContext) y ya divergen: unas contemplan al auxiliar y otras no.
 * Peor: se resuelve en el navegador y se aplica anadiendo un .in(...) a la
 * consulta, asi que si la lista sale vacia el filtro no se aplica y se
 * devuelve todo. Y cualquiera con la anon key del bundle se lo salta entero.
 *
 * Aqui hay una sola funcion, corre en el servidor y sale del token.
 *
 * ---------------------------------------------------------------------------
 * La regla de los varios roles (decision del cliente, 2026-08-07)
 *
 * El alcance es la UNION de los alcances de todos los roles del usuario.
 * El codigo viejo hacia `return` con el primer rol que encontraba, asi que un
 * coordinador que ademas entrena perdia de vista sus propias disciplinas.
 * Aqui no hay salida temprana: cada camino aporta y se suman.
 *
 * Los caminos, uno por rol:
 *   Propietario / Admin  -> todo (global = true, no se consulta nada)
 *   Coordinador          -> colegio_coordinador, y con ellos sus disciplinas
 *   Entrenador           -> entrenador_asignacion activa -> disciplina
 *   Asistente / Respaldo -> entrenador_auxiliar -> el titular -> sus disciplinas
 *   Representante        -> sus ninos -> nino_asignacion activa -> disciplina
 */
export interface Alcance {
  /** True para Propietario y Admin: ven todo y no se les filtra nada. */
  global: boolean;
  /** col_id visibles. Vacio y global=false significa "no ve ningun colegio". */
  colegios: number[];
  /** colacthor_id visibles (disciplinas). */
  disciplinas: number[];
}

/**
 * Una sola consulta para los cuatro caminos. Cada CTE resuelve un origen y el
 * UNION los suma; con un solo viaje a la base (~12 ms desde us-east4) no vale
 * la pena consultar rol por rol.
 *
 * Las disciplinas del coordinador salen de sus colegios, no al reves: un
 * coordinador ve todo lo que se imparte en su colegio, lo de un entrenador
 * concreto por si acaso tambien.
 *
 * Cada camino esta condicionado a que el usuario TENGA ese rol ($3 a $6). No
 * basta con que exista la fila de pertenencia: si a alguien se le quita el rol
 * de coordinador y su fila de colegio_coordinador sigue ahi, sin esta guarda
 * conservaria el alcance de un rol que ya no tiene.
 */
const SQL_ALCANCE = `
  WITH col_coordinador AS (
      SELECT cc.col_id
      FROM public.colegio_coordinador cc
      WHERE cc.usu_id = $1 AND $3::boolean
  ),
  disc_coordinador AS (
      SELECT cah.colacthor_id
      FROM public.colegio_actividad_horario cah
      JOIN col_coordinador c ON c.col_id = cah.col_id
  ),
  disc_entrenador AS (
      SELECT ea.colacthor_id
      FROM public.entrenador_asignacion ea
      WHERE ea.ent_id = $1
        AND $4::boolean
        AND ea.est_id = $2
        AND ea.entasig_fecha_fin IS NULL
  ),
  disc_auxiliar AS (
      SELECT ea.colacthor_id
      FROM public.entrenador_auxiliar aux
      JOIN public.entrenador_asignacion ea ON ea.ent_id = aux.ent_id
      WHERE aux.usu_id = $1
        AND $5::boolean
        AND aux.est_id = $2
        AND ea.est_id = $2
        AND ea.entasig_fecha_fin IS NULL
  ),
  disc_representante AS (
      SELECT na.colacthor_id
      FROM public.padre p
      JOIN public.nino_padre np ON np.padre_id = p.padre_id
      JOIN public.nino_asignacion na ON na.nino_id = np.nino_id
      WHERE p.usu_id = $1
        AND $6::boolean
        AND na.est_id = $2
  ),
  disciplinas AS (
      SELECT colacthor_id FROM disc_coordinador
      UNION SELECT colacthor_id FROM disc_entrenador
      UNION SELECT colacthor_id FROM disc_auxiliar
      UNION SELECT colacthor_id FROM disc_representante
  ),
  colegios AS (
      SELECT col_id FROM col_coordinador
      UNION
      SELECT cah.col_id
      FROM public.colegio_actividad_horario cah
      JOIN disciplinas d ON d.colacthor_id = cah.colacthor_id
  )
  SELECT
      COALESCE((SELECT array_agg(col_id ORDER BY col_id) FROM colegios), '{}')                AS colegios,
      COALESCE((SELECT array_agg(colacthor_id ORDER BY colacthor_id) FROM disciplinas), '{}') AS disciplinas
`;

export async function alcanceDe(usuario: UsuarioConRoles): Promise<Alcance> {
  const esGlobal = usuario.roles.some((r) => ROLES_GLOBALES.includes(r.rol_id));

  if (esGlobal) {
    return { global: true, colegios: [], disciplinas: [] };
  }

  const tiene = (rolId: number): boolean => usuario.roles.some((r) => r.rol_id === rolId);

  const { rows } = await getPool().query<{ colegios: number[]; disciplinas: number[] }>(
    SQL_ALCANCE,
    [
      usuario.usu_id,
      ESTADO.ACTIVO,
      tiene(ROL.COORDINADOR),
      tiene(ROL.ENTRENADOR),
      ROLES_AUXILIARES.some((r) => tiene(r)),
      tiene(ROL.REPRESENTANTE),
    ],
  );

  return {
    global: false,
    colegios: rows[0]?.colegios ?? [],
    disciplinas: rows[0]?.disciplinas ?? [],
  };
}

/** Atajo legible para los servicios: ¿este colegio cae dentro del alcance? */
export function alcanzaColegio(alcance: Alcance, colId: number): boolean {
  return alcance.global || alcance.colegios.includes(colId);
}

/** Atajo legible para los servicios: ¿esta disciplina cae dentro del alcance? */
export function alcanzaDisciplina(alcance: Alcance, colacthorId: number): boolean {
  return alcance.global || alcance.disciplinas.includes(colacthorId);
}
