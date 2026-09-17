import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import { tableroSchema } from './tablero.schemas.js';
import * as service from './tablero.service.js';

/**
 * Rutas del Tablero.
 *
 * Un solo endpoint. `?rol=` elige cuál de los tableros a los que la persona
 * tiene derecho quiere ver, y `?desde=&hasta=` el periodo de las cifras de
 * asistencia. Sin parámetros: el tablero de mayor alcance y los últimos 30
 * días.
 */

export const tableroRouter = Router();

tableroRouter.use(requireAuth);

tableroRouter.get(
  '/',
  requirePermission('dashboard', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ApiError(401, 'No autenticado');
      const query = tableroSchema.parse(req.query);
      res.json({ data: await service.tablero(req.user, query), error: null });
    } catch (err) {
      next(err);
    }
  },
);
