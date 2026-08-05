import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import {
  findUsuarioByAuthUserId,
  type Permiso,
  type UsuarioConRoles,
} from '../modules/auth/auth.repository.js';

/** Datos de usuario resueltos desde el token + DB, adjuntos a req.user. */
export interface AuthUser {
  authUserId: string; // auth.users.id (uuid)
  email?: string;
  usuario: UsuarioConRoles;
  /** Union de los permisos de todos sus roles. Lo lee requirePermission. */
  permisos: Permiso[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Extrae el token de 'Authorization: Bearer <token>' o lanza 401. */
export function readBearer(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Token de autorizacion ausente');
  }
  return header.slice('Bearer '.length);
}

/**
 * Valida el token de Supabase Auth y resuelve el usuario de dominio.
 *
 * No usa JWT secret: delega la validacion a Supabase Auth via getUser(token),
 * que verifica firma y expiracion contra el proyecto. Cuesta un viaje de red
 * por request; con Railway y Supabase en la misma costa son ~12 ms.
 *
 * Tres formas de fallar, y las tres importan:
 *   401 — token ausente, invalido o expirado.
 *   403 — el token es bueno pero no hay usuario de dominio enlazado. Pasa si
 *         alguien tiene cuenta en Auth sin fila en public.usuario.
 *   403 — el usuario existe pero est_id <> 1 (inactivo). Reemplaza el chequeo
 *         que hoy vive en el AuthContext del frontend, donde era evitable.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readBearer(req);
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);

    if (error || !data.user) {
      throw new ApiError(401, 'Token invalido o expirado');
    }

    const usuario = await findUsuarioByAuthUserId(data.user.id);
    if (!usuario) {
      throw new ApiError(403, 'La cuenta no esta enlazada a ningun usuario del sistema');
    }
    if (usuario.est_id !== 1) {
      throw new ApiError(403, 'Usuario inactivo o no autorizado');
    }

    req.user = {
      authUserId: data.user.id,
      email: data.user.email,
      usuario,
      permisos: usuario.permisos,
    };
    next();
  } catch (err) {
    next(err);
  }
}
