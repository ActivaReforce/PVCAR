import { getPool } from '../../config/db.js';
import { auditar } from '../../lib/auditoria.js';
import { ACCIONES, MODULOS, ROL, ROLES_GLOBALES } from '../../lib/constants.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';

/**
 * Matriz de permisos por rol.
 *
 * En el sistema viejo esto vive en la pantalla Permisos.tsx y se guarda con la
 * RPC set_role_permissions, que es SECURITY DEFINER. Esa funcion quedo
 * abierta a PUBLIC hasta 0005_grants.sql: con la anon key del bundle se podia
 * invocar. Ahora la escritura pasa por aqui, con sesion y con rol comprobado
 * en el servidor.
 */

export interface Permiso {
  modulo: string;
  accion: string;
}

export interface MatrizPermisos {
  modulos: readonly string[];
  acciones: readonly string[];
  roles: Array<{
    rol_id: number;
    rol_nombre: string;
    rol_titulo: string;
    permisos: Permiso[];
  }>;
}

export async function matriz(): Promise<MatrizPermisos> {
  const { rows } = await getPool().query<{
    rol_id: number;
    rol_nombre: string;
    rol_titulo: string;
    permisos: Permiso[];
  }>(
    `SELECT r.rol_id,
            r.rol_nombre,
            r.rol_titulo,
            COALESCE(p.permisos, '[]'::json) AS permisos
       FROM public.rol r
       LEFT JOIN LATERAL (
           SELECT json_agg(
                      jsonb_build_object('modulo', rp.modulo, 'accion', rp.accion)
                      ORDER BY rp.modulo, rp.accion
                  ) AS permisos
             FROM public.rol_permiso rp
            WHERE rp.rol_id = r.rol_id
       ) p ON TRUE
      ORDER BY r.rol_id`,
  );

  return { modulos: MODULOS, acciones: ACCIONES, roles: rows };
}

/**
 * Reemplaza los permisos de un rol por la lista que llega, por diferencia.
 *
 * Dos guardas que el sistema viejo no tenia:
 *   - solo un rol global (Propietario o Admin) puede tocar la matriz;
 *   - al Propietario no se le puede quitar `permisos.ver`. Es la llave de esta
 *     misma pantalla: sin ella nadie podria volver a repartir permisos y el
 *     sistema se cierra por dentro sin forma de abrirlo desde la aplicacion.
 */
export async function reemplazarPermisosDeRol(
  actor: AuthUser,
  rolId: number,
  permisos: Permiso[],
): Promise<Permiso[]> {
  const esGlobal = actor.usuario.roles.some((r) => ROLES_GLOBALES.includes(r.rol_id));
  if (!esGlobal) {
    throw new ApiError(403, 'Solo Propietario o Admin pueden cambiar los permisos de un rol');
  }

  const { rows: existeRol } = await getPool().query('SELECT 1 FROM public.rol WHERE rol_id = $1', [
    rolId,
  ]);
  if (existeRol.length === 0) {
    throw new ApiError(404, 'El rol no existe');
  }

  const desconocido = permisos.find(
    (p) => !MODULOS.includes(p.modulo as never) || !ACCIONES.includes(p.accion as never),
  );
  if (desconocido) {
    throw new ApiError(400, `Permiso desconocido: ${desconocido.modulo}:${desconocido.accion}`);
  }

  if (
    rolId === ROL.PROPIETARIO &&
    !permisos.some((p) => p.modulo === 'permisos' && p.accion === 'ver')
  ) {
    throw new ApiError(
      409,
      'El Propietario PVCAR no puede quedarse sin acceso a Permisos: nadie podria volver a repartirlos.',
    );
  }

  await enTransaccion(async (client) => {
    const { rows: actuales } = await client.query<Permiso>(
      'SELECT modulo, accion FROM public.rol_permiso WHERE rol_id = $1',
      [rolId],
    );

    const clave = (p: Permiso): string => `${p.modulo}:${p.accion}`;
    const deseados = new Set(permisos.map(clave));
    const previos = new Set(actuales.map(clave));

    const quitar = actuales.filter((p) => !deseados.has(clave(p)));
    const agregar = permisos.filter((p) => !previos.has(clave(p)));

    // Por diferencia y no borrando todo: si el insert fallara despues de un
    // delete completo, el rol se quedaria sin ningun permiso.
    for (const p of quitar) {
      await client.query(
        'DELETE FROM public.rol_permiso WHERE rol_id = $1 AND modulo = $2 AND accion = $3',
        [rolId, p.modulo, p.accion],
      );
    }
    for (const p of agregar) {
      await client.query(
        `INSERT INTO public.rol_permiso (rol_id, modulo, accion)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [rolId, p.modulo, p.accion],
      );
    }

    await auditar(
      {
        actor,
        accion: 'permisos',
        entidad: 'rol',
        entidadId: rolId,
        detalle: {
          agregados: agregar.map(clave),
          quitados: quitar.map(clave),
        },
      },
      client,
    );
  });

  const { rows } = await getPool().query<Permiso>(
    `SELECT modulo, accion FROM public.rol_permiso
      WHERE rol_id = $1 ORDER BY modulo, accion`,
    [rolId],
  );
  return rows;
}
