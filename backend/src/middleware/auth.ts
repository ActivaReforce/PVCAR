import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error.js';
import { getSupabaseAdmin } from '../config/supabase.js';

/** Datos de usuario resueltos desde el token + DB, adjuntos a req.user. */
export interface AuthUser {
  authUserId: string; // auth.users.id (uuid)
  email?: string;
  // Se completan en Fase 3/4 al resolver el usuario de dominio + roles/permisos.
  usuarioId?: number;
  roles?: string[];
  permisos?: Array<{ modulo: string; accion: string }>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Valida el token de Supabase Auth (Authorization: Bearer <token>).
 * No usa JWT secret: delega la validacion a Supabase Auth via getUser(token),
 * que verifica firma y expiracion contra el proyecto.
 * Fase 4: resolver usuario de dominio + cargar roles y permisos desde la DB.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Token de autorizacion ausente');
    }

    const token = header.slice('Bearer '.length);
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);

    if (error || !data.user) {
      throw new ApiError(401, 'Token invalido o expirado');
    }

    req.user = {
      authUserId: data.user.id,
      email: data.user.email,
    };
    next();
  } catch (err) {
    next(err);
  }
}
