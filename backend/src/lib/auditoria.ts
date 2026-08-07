import type { PoolClient } from 'pg';
import { getPool } from '../config/db.js';
import type { AuthUser } from '../middleware/auth.js';

/**
 * Registro de acciones sensibles en public.auditoria (migracion 0006).
 *
 * Se escribe a mano desde los servicios, no por trigger: interesa el hecho de
 * negocio ("se elimino al usuario 42, arrastrando 47 asistencias"), no el
 * diff fila a fila que un trigger sabria contar.
 *
 * Acepta un client de transaccion: el registro de un borrado tiene que
 * confirmarse o deshacerse junto con el borrado. Si se pasa el pool, la
 * escritura es independiente.
 */
export type AccionAuditada =
  | 'crear'
  | 'editar'
  | 'baja'
  | 'reactivar'
  | 'eliminar'
  | 'roles'
  | 'permisos';

export interface RegistroAuditoria {
  actor: AuthUser;
  accion: AccionAuditada;
  entidad: string;
  entidadId: number | string;
  detalle?: Record<string, unknown>;
}

export async function auditar(
  registro: RegistroAuditoria,
  client?: PoolClient,
): Promise<void> {
  const ejecutor = client ?? getPool();
  await ejecutor.query(
    `INSERT INTO public.auditoria
         (aud_actor_id, aud_actor_correo, aud_accion, aud_entidad, aud_entidad_id, aud_detalle)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      registro.actor.usuario.usu_id,
      registro.actor.usuario.usu_correo,
      registro.accion,
      registro.entidad,
      String(registro.entidadId),
      JSON.stringify(registro.detalle ?? {}),
    ],
  );
}
