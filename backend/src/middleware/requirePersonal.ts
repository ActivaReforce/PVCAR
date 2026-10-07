import type { NextFunction, Request, Response } from 'express';
import { ROL } from '../lib/constants.js';
import { ApiError } from './error.js';

/**
 * Solo el personal de Activa Reforce: cualquier rol que no sea únicamente
 * Representante.
 *
 * Para los módulos que no filtran por alcance (Encuestas administra las de
 * todos los padres). Ahí el permiso "ver" daba acceso de administración: si
 * en la pantalla de Permisos se le marcaba al rol Representante, un padre
 * habría visto las respuestas de todos y podido borrar encuestas. El permiso
 * sigue decidiendo dentro del personal; esto solo deja fuera al padre.
 */
export function requirePersonal(req: Request, _res: Response, next: NextFunction): void {
  const roles = req.user?.usuario.roles.map((r) => r.rol_id) ?? [];
  if (roles.some((r) => r !== ROL.REPRESENTANTE)) {
    next();
    return;
  }
  next(new ApiError(403, 'Solo el personal de Activa Reforce puede hacer esto'));
}
