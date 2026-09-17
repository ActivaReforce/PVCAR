import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import type { Alcance } from '../../lib/alcance.js';
import { ESTADO, ROL } from '../../lib/constants.js';
import { contieneSinTildes } from '../../lib/sql.js';

/**
 * Consultas de Representantes.
 *
 * ---------------------------------------------------------------------------
 * Este módulo no da de alta personas
 *
 * Un representante **es** un usuario con el rol 4 y su ficha de `padre` la crea
 * Usuarios al concederle el rol, junto con su sector de residencia. Aquí no se
 * duplica nada de eso: esta pantalla existe para lo que no tenía sitio en
 * ningún lado —**ver quiénes son y de qué niños responden**— y para atar y
 * soltar esos vínculos desde el lado del representante.
 *
 * Hasta ahora los vínculos solo se podían tocar desde la ficha de cada alumno,
 * uno a uno, y no había ninguna pantalla donde ver la lista de representantes.
 *
 * ---------------------------------------------------------------------------
 * El alcance
 *
 * Un representante no pertenece a un colegio: pertenece a sus hijos. Así que el
 * alcance va **por los niños**: se ve a quien representa a algún alumno de tus
 * colegios o de tus disciplinas. Los globales lo ven todo, y los que todavía no
 * tienen ningún hijo atado solo los ven los globales — si no, nadie podría
 * llegar a atarles el primero.
 */

export interface RepresentanteListado {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  usu_telefono: string | null;
  usu_foto: string | null;
  est_id: number;
  padre_id: number | null;
  padre_sector_residencia: string | null;
  hijos: number;
  encuestasRespondidas: number;
}

export interface HijoListado {
  ninopadre_id: number;
  nino_id: number;
  nino_nombre: string;
  nino_foto: string | null;
  col_nombre: string;
  catninograd_nombre: string | null;
  est_id: number;
  disciplinas: number;
}

export interface AlumnoDisponible {
  nino_id: number;
  nino_nombre: string;
  col_nombre: string;
  catninograd_nombre: string | null;
  representantes: number;
}

const F_ALCANCE = `(
    $1::boolean
    OR EXISTS (
        SELECT 1
        FROM public.nino_padre np
        JOIN public.nino n ON n.nino_id = np.nino_id
        WHERE np.padre_id = p.padre_id
          AND (n.col_id = ANY($2::int[])
               OR EXISTS (SELECT 1 FROM public.nino_asignacion na
                           WHERE na.nino_id = n.nino_id
                             AND na.est_id = ${ESTADO.ACTIVO}
                             AND na.colacthor_id = ANY($3::int[])))
    )
)`;

const DESDE = `
    FROM public.usuario u
    JOIN public.usuario_rol ur ON ur.usu_id = u.usu_id AND ur.rol_id = ${ROL.REPRESENTANTE}
    LEFT JOIN public.padre p ON p.usu_id = u.usu_id
`;

export async function listarRepresentantes(
  alcance: Alcance,
  buscar: string | null,
  estado: number | null,
): Promise<RepresentanteListado[]> {
  const { rows } = await getPool().query<RepresentanteListado>(
    `SELECT u.usu_id,
            u.usu_nombre,
            u.usu_correo,
            u.usu_telefono,
            u.usu_foto,
            u.est_id,
            p.padre_id,
            p.padre_sector_residencia,
            COALESCE((SELECT count(*) FROM public.nino_padre np
                       WHERE np.padre_id = p.padre_id), 0)::int AS hijos,
            COALESCE((SELECT count(*) FROM public.encuesta_respondida er
                       WHERE er.padre_id = p.padre_id), 0)::int AS "encuestasRespondidas"
     ${DESDE}
     WHERE ${F_ALCANCE}
       AND ($4::text IS NULL OR ${contieneSinTildes('u.usu_nombre', '$4')}
                             OR ${contieneSinTildes('u.usu_correo', '$4')})
       AND ($5::int IS NULL OR u.est_id = $5)
     ORDER BY u.usu_nombre`,
    [alcance.global, alcance.colegios, alcance.disciplinas, buscar, estado],
  );
  return rows;
}

export interface ConteosRepresentantes {
  total: number;
  activos: number;
  sinHijos: number;
  sinFicha: number;
}

/**
 * Los conteos van **sin los filtros de pantalla**, a propósito: si se contaran
 * con el filtro puesto, marcar "Activos" pondría "sin hijos: 0". Es la lección
 * de la Fase 6.
 *
 * `sinFicha` son los que tienen el rol pero no fila en `padre`. No debería
 * pasar —Usuarios la crea al conceder el rol— pero si pasa hay que verlo, no
 * esconderlo: sin ficha no se les puede atar un hijo ni pueden responder nada.
 */
export async function contarRepresentantes(alcance: Alcance): Promise<ConteosRepresentantes> {
  const { rows } = await getPool().query<ConteosRepresentantes>(
    `SELECT count(*)::int                                                 AS total,
            count(*) FILTER (WHERE u.est_id = ${ESTADO.ACTIVO})::int       AS activos,
            count(*) FILTER (WHERE NOT EXISTS (
                SELECT 1 FROM public.nino_padre np WHERE np.padre_id = p.padre_id))::int AS "sinHijos",
            count(*) FILTER (WHERE p.padre_id IS NULL)::int                AS "sinFicha"
     ${DESDE}
     WHERE ${F_ALCANCE}`,
    [alcance.global, alcance.colegios, alcance.disciplinas],
  );
  return rows[0] ?? { total: 0, activos: 0, sinHijos: 0, sinFicha: 0 };
}

export async function obtenerRepresentante(usuId: number): Promise<RepresentanteListado | null> {
  const { rows } = await getPool().query<RepresentanteListado>(
    `SELECT u.usu_id,
            u.usu_nombre,
            u.usu_correo,
            u.usu_telefono,
            u.usu_foto,
            u.est_id,
            p.padre_id,
            p.padre_sector_residencia,
            COALESCE((SELECT count(*) FROM public.nino_padre np
                       WHERE np.padre_id = p.padre_id), 0)::int AS hijos,
            COALESCE((SELECT count(*) FROM public.encuesta_respondida er
                       WHERE er.padre_id = p.padre_id), 0)::int AS "encuestasRespondidas"
     ${DESDE}
     WHERE u.usu_id = $1`,
    [usuId],
  );
  return rows[0] ?? null;
}

export async function listarHijos(padreId: number): Promise<HijoListado[]> {
  const { rows } = await getPool().query<HijoListado>(
    `SELECT np.ninopadre_id,
            n.nino_id,
            n.nino_nombre,
            n.nino_foto,
            c.col_nombre,
            g.catninograd_nombre,
            n.est_id,
            (SELECT count(*) FROM public.nino_asignacion na
              WHERE na.nino_id = n.nino_id AND na.est_id = ${ESTADO.ACTIVO})::int AS disciplinas
       FROM public.nino_padre np
       JOIN public.nino n ON n.nino_id = np.nino_id
       JOIN public.colegio c ON c.col_id = n.col_id
       LEFT JOIN public.categoria_nino_grado g ON g.catninograd_id = n.catninograd_id
      WHERE np.padre_id = $1
      ORDER BY n.nino_nombre`,
    [padreId],
  );
  return rows;
}

/** Alumnos del alcance a los que todavía no representa. */
export async function listarDisponibles(
  padreId: number | null,
  alcance: Alcance,
  buscar: string | null,
): Promise<AlumnoDisponible[]> {
  const { rows } = await getPool().query<AlumnoDisponible>(
    `SELECT n.nino_id,
            n.nino_nombre,
            c.col_nombre,
            g.catninograd_nombre,
            (SELECT count(*) FROM public.nino_padre np2 WHERE np2.nino_id = n.nino_id)::int AS representantes
       FROM public.nino n
       JOIN public.colegio c ON c.col_id = n.col_id
       LEFT JOIN public.categoria_nino_grado g ON g.catninograd_id = n.catninograd_id
      WHERE n.est_id = ${ESTADO.ACTIVO}
        AND ($1::boolean
             OR n.col_id = ANY($2::int[])
             OR EXISTS (SELECT 1 FROM public.nino_asignacion na
                         WHERE na.nino_id = n.nino_id
                           AND na.est_id = ${ESTADO.ACTIVO}
                           AND na.colacthor_id = ANY($3::int[])))
        AND ($4::int IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.nino_padre np WHERE np.nino_id = n.nino_id AND np.padre_id = $4))
        AND ($5::text IS NULL OR ${contieneSinTildes('n.nino_nombre', '$5')})
      ORDER BY c.col_nombre, n.nino_nombre
      LIMIT 200`,
    [alcance.global, alcance.colegios, alcance.disciplinas, padreId, buscar],
  );
  return rows;
}

/** Crea la ficha de `padre` si no la hubiera. Devuelve su id. */
export async function asegurarFicha(client: PoolClient, usuId: number): Promise<number> {
  const { rows } = await client.query<{ padre_id: number }>(
    `INSERT INTO public.padre (usu_id)
     VALUES ($1)
     ON CONFLICT (usu_id) DO UPDATE SET padre_fecha_modificacion = now()
     RETURNING padre_id`,
    [usuId],
  );
  return rows[0]!.padre_id;
}

export async function hijosActuales(client: PoolClient, padreId: number): Promise<number[]> {
  const { rows } = await client.query<{ nino_id: number }>(
    `SELECT nino_id FROM public.nino_padre WHERE padre_id = $1`,
    [padreId],
  );
  return rows.map((r) => r.nino_id);
}

export async function atar(
  client: PoolClient,
  padreId: number,
  ninoId: number,
): Promise<void> {
  await client.query(
    `INSERT INTO public.nino_padre (nino_id, padre_id)
     VALUES ($1, $2)
     ON CONFLICT (nino_id, padre_id) DO NOTHING`,
    [ninoId, padreId],
  );
}

export async function soltar(
  client: PoolClient,
  padreId: number,
  ninoId: number,
): Promise<void> {
  await client.query(`DELETE FROM public.nino_padre WHERE padre_id = $1 AND nino_id = $2`, [
    padreId,
    ninoId,
  ]);
}

export async function actualizarSector(
  client: PoolClient,
  padreId: number,
  sector: string | null,
): Promise<void> {
  await client.query(
    `UPDATE public.padre
        SET padre_sector_residencia = $2, padre_fecha_modificacion = now()
      WHERE padre_id = $1`,
    [padreId, sector],
  );
}

/** ¿Este niño cae dentro del alcance de quien pregunta? */
export async function ninoEnAlcance(
  client: PoolClient,
  ninoId: number,
  alcance: Alcance,
): Promise<boolean> {
  if (alcance.global) return true;
  const { rows } = await client.query<{ ok: boolean }>(
    `SELECT (n.col_id = ANY($2::int[])
             OR EXISTS (SELECT 1 FROM public.nino_asignacion na
                         WHERE na.nino_id = n.nino_id
                           AND na.est_id = ${ESTADO.ACTIVO}
                           AND na.colacthor_id = ANY($3::int[]))) AS ok
       FROM public.nino n WHERE n.nino_id = $1`,
    [ninoId, alcance.colegios, alcance.disciplinas],
  );
  return rows[0]?.ok === true;
}
