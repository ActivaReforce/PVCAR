import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';

/** Tipos de envío con fila en correo_config. Crece con Novedades y ausencias. */
export const TIPOS_CORREO = ['inscripciones'] as const;
export type TipoCorreo = (typeof TIPOS_CORREO)[number];

export interface ConfigCorreo {
  tipo: TipoCorreo;
  nombre: string;
  usuario: string;
  cc: string[];
  responder_a: string | null;
}

export async function obtenerConfig(
  tipo: TipoCorreo,
  client?: PoolClient,
): Promise<ConfigCorreo | null> {
  const { rows } = await (client ?? getPool()).query<ConfigCorreo>(
    `SELECT corcfg_tipo AS tipo, corcfg_nombre AS nombre, corcfg_usuario AS usuario,
            corcfg_cc AS cc, corcfg_responder_a AS responder_a
       FROM public.correo_config
      WHERE corcfg_tipo = $1`,
    [tipo],
  );
  return rows[0] ?? null;
}

export async function guardarConfig(client: PoolClient, c: ConfigCorreo): Promise<boolean> {
  const { rowCount } = await client.query(
    `UPDATE public.correo_config
        SET corcfg_nombre = $2, corcfg_usuario = $3, corcfg_cc = $4,
            corcfg_responder_a = $5, corcfg_fecha_modificacion = now()
      WHERE corcfg_tipo = $1`,
    [c.tipo, c.nombre, c.usuario, c.cc, c.responder_a],
  );
  return (rowCount ?? 0) > 0;
}
