import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import * as service from './novedades.service.js';
import { buscarSchema, crearSchema, idParamSchema, listarSchema } from './novedades.schemas.js';

/**
 * Rutas de Novedades (punto 8 del Roadmap, 2026-10-09).
 */
export const novedadesRouter = Router();

novedadesRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

novedadesRouter.get(
  '/',
  requirePermission('novedades', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filtros = listarSchema.parse(req.query);
      res.json({ data: await service.listar(actor(req), filtros), error: null });
    } catch (err) {
      next(err);
    }
  },
);

novedadesRouter.get(
  '/personal-mencionable',
  requirePermission('novedades', 'crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const opts = buscarSchema.parse(req.query);
      res.json({ data: await service.personalMencionable(actor(req), opts), error: null });
    } catch (err) {
      next(err);
    }
  },
);

novedadesRouter.get(
  '/alumnos-mencionables',
  requirePermission('novedades', 'crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const opts = buscarSchema.parse(req.query);
      res.json({ data: await service.alumnosMencionables(actor(req), opts), error: null });
    } catch (err) {
      next(err);
    }
  },
);

novedadesRouter.get(
  '/:id',
  requirePermission('novedades', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.obtener(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

novedadesRouter.post(
  '/',
  requirePermission('novedades', 'crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = crearSchema.parse(req.body);
      res.status(201).json({ data: await service.crear(actor(req), input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

novedadesRouter.delete(
  '/:id',
  requirePermission('novedades', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.eliminar(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);
