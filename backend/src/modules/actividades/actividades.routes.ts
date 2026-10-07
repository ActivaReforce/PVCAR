import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import {
  actualizarActividadSchema,
  crearActividadSchema,
  eliminarActividadSchema,
  idParamSchema,
  listarActividadesSchema,
} from './actividades.schemas.js';
import * as service from './actividades.service.js';

export const actividadesRouter = Router();

actividadesRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

/** GET /api/v1/actividades — catalogo paginado, con busqueda y filtro. */
actividadesRouter.get(
  '/',
  requirePermission('actividades', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listarActividadesSchema.parse(req.query);
      res.json({ data: await service.listar(query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/v1/actividades/categorias — va antes de /:id. */
actividadesRouter.get(
  '/categorias',
  requirePermission('actividades', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.categorias(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

actividadesRouter.get(
  '/:id',
  requirePermission('actividades', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.obtener(id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

actividadesRouter.get(
  '/:id/impacto',
  requirePermission('actividades', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.impacto(id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

actividadesRouter.post(
  '/',
  requirePermission('actividades', 'crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = crearActividadSchema.parse(req.body);
      res.status(201).json({ data: await service.crear(actor(req), input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

actividadesRouter.patch(
  '/:id',
  requirePermission('actividades', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const input = actualizarActividadSchema.parse(req.body);
      res.json({ data: await service.actualizar(actor(req), id, input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** DELETE /api/v1/actividades/:id — permanente. Exige escribir el nombre. */
actividadesRouter.delete(
  '/:id',
  requirePermission('actividades', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { confirmacion } = eliminarActividadSchema.parse(req.body);
      res.json({ data: await service.eliminar(actor(req), id, confirmacion), error: null });
    } catch (err) {
      next(err);
    }
  },
);
