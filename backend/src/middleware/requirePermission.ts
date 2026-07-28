import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error.js';

/**
 * Exige que req.user tenga permiso (modulo, accion).
 * STUB Fase 2: la carga real de permisos desde rol_permiso llega en Fase 4.
 * Mueve al servidor la logica que hoy vive en usePermissions.ts del front.
 */
export function requirePermission(modulo: string, accion: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(401, 'No autenticado');
    }
    const permisos = req.user.permisos ?? [];
    const ok = permisos.some((p) => p.modulo === modulo && p.accion === accion);
    if (!ok) {
      throw new ApiError(403, `Sin permiso: ${modulo}:${accion}`);
    }
    next();
  };
}
