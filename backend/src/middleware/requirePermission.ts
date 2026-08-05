import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error.js';

/**
 * Exige que req.user tenga permiso (modulo, accion).
 * Va siempre despues de requireAuth, que es quien carga los permisos desde
 * rol_permiso. Mueve al servidor la decision que hoy toma usePermissions.ts
 * en el navegador, donde el usuario podia cambiarla.
 */
export function requirePermission(modulo: string, accion: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(401, 'No autenticado');
    }
    const ok = req.user.permisos.some((p) => p.modulo === modulo && p.accion === accion);
    if (!ok) {
      throw new ApiError(403, `Sin permiso: ${modulo}:${accion}`);
    }
    next();
  };
}
