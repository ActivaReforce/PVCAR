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

/**
 * Exige **alguno** de varios permisos.
 *
 * Lo pide Asistencias: el catalogo de estados y el reloj del servidor los
 * necesitan las dos pantallas, la de alumnos y la de entrenadores, y sus
 * permisos son distintos (`asistencias_estudiantes:ver` lo tienen seis roles,
 * `asistencias_entrenadores:ver` solo tres). Con `requirePermission` a secas
 * habria que elegir uno y dejar fuera a la mitad.
 */
export function requireAlgunPermiso(...pares: Array<[modulo: string, accion: string]>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(401, 'No autenticado');
    }
    const ok = pares.some(([modulo, accion]) =>
      req.user!.permisos.some((p) => p.modulo === modulo && p.accion === accion),
    );
    if (!ok) {
      throw new ApiError(403, `Sin permiso: ${pares.map((p) => p.join(':')).join(' o ')}`);
    }
    next();
  };
}
