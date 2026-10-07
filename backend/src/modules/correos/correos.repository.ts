import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';

/**
 * Tipos de envío con fila en correo_config. Crece con Novedades y ausencias.
 *
 * inscripciones        — aprobada: al representante, con copias.
 * inscripciones_aviso  — nueva: a la lista fija `para` del equipo.
 */
export const TIPOS_CORREO = ['inscripciones', 'inscripciones_aviso'] as const;
export type TipoCorreo = (typeof TIPOS_CORREO)[number];

export interface ConfigCorreo {
  tipo: TipoCorreo;
  nombre: string;
  usuario: string;
  /** Destinatarios fijos. Solo los avisos internos; vacio en el resto. */
  para: string[];
  cc: string[];
  responder_a: string | null;
}

export async function obtenerConfig(
  tipo: TipoCorreo,
  client?: PoolClient,
): Promise<ConfigCorreo | null> {
  const { rows } = await (client ?? getPool()).query<ConfigCorreo>(
    `SELECT corcfg_tipo AS tipo, corcfg_nombre AS nombre, corcfg_usuario AS usuario,
            corcfg_para AS para, corcfg_cc AS cc, corcfg_responder_a AS responder_a
       FROM public.correo_config
      WHERE corcfg_tipo = $1`,
    [tipo],
  );
  return rows[0] ?? null;
}

export async function guardarConfig(client: PoolClient, c: ConfigCorreo): Promise<boolean> {
  const { rowCount } = await client.query(
    `UPDATE public.correo_config
        SET corcfg_nombre = $2, corcfg_usuario = $3, corcfg_para = $4, corcfg_cc = $5,
            corcfg_responder_a = $6, corcfg_fecha_modificacion = now()
      WHERE corcfg_tipo = $1`,
    [c.tipo, c.nombre, c.usuario, c.para, c.cc, c.responder_a],
  );
  return (rowCount ?? 0) > 0;
}
