import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as service from './correos.service.js';
import { configCorreoSchema, tipoParamSchema } from './correos.schemas.js';

/**
 * Configuracion de correos (2026-10-07). Solo Propietario: la regla esta en
 * el servicio, no en el modal de Permisos.
 */
export const correosRouter = Router();

correosRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

/** GET /api/v1/correos/:tipo — remitente, copias, respuesta y el dominio fijo. */
correosRouter.get('/:tipo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tipo } = tipoParamSchema.parse(req.params);
    res.json({ data: await service.obtener(actor(req), tipo), error: null });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/v1/correos/:tipo */
correosRouter.put('/:tipo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tipo } = tipoParamSchema.parse(req.params);
    const input = configCorreoSchema.parse(req.body);
    res.json({ data: await service.guardar(actor(req), tipo, input), error: null });
  } catch (err) {
    next(err);
  }
});
