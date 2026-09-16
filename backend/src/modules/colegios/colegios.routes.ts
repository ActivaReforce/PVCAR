import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { firmarSubidaFoto } from '../../lib/storage.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import {
  actualizarColegioSchema,
  coordinadoresSchema,
  crearColegioSchema,
  eliminarColegioSchema,
  idParamSchema,
  listarColegiosSchema,
} from './colegios.schemas.js';
import * as service from './colegios.service.js';

const fotoSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

export const colegiosRouter = Router();

colegiosRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

/** GET /api/v1/colegios — pagina filtrada por alcance, con sus conteos. */
colegiosRouter.get(
  '/',
  requirePermission('colegios', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listarColegiosSchema.parse(req.query);
      res.json({ data: await service.listar(actor(req), query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/colegios/coordinadores — candidatos para el selector.
 *
 * Va antes de /:id, o Express intenta leer "coordinadores" como id. Pide
 * `colegios.editar` y no `usuarios.ver`: quien edita un colegio necesita la
 * lista, y no tiene por que poder abrir el modulo de Usuarios.
 */
colegiosRouter.get(
  '/coordinadores',
  requirePermission('colegios', 'editar'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.candidatos(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /api/v1/colegios/foto — URL firmada para la foto del contacto. */
colegiosRouter.post(
  '/foto',
  requirePermission('colegios', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { mimeType } = fotoSchema.parse(req.body);
      res.json({ data: await firmarSubidaFoto(mimeType, 'colegios'), error: null });
    } catch (err) {
      next(err);
    }
  },
);

colegiosRouter.get(
  '/:id',
  requirePermission('colegios', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.obtener(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/v1/colegios/:id/impacto — que se destruye y que lo impide. */
colegiosRouter.get(
  '/:id/impacto',
  requirePermission('colegios', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.impacto(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

colegiosRouter.post(
  '/',
  requirePermission('colegios', 'crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = crearColegioSchema.parse(req.body);
      res.status(201).json({ data: await service.crear(actor(req), input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

colegiosRouter.patch(
  '/:id',
  requirePermission('colegios', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const input = actualizarColegioSchema.parse(req.body);
      res.json({ data: await service.actualizar(actor(req), id, input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** PUT /api/v1/colegios/:id/coordinadores — reemplaza la lista completa. */
colegiosRouter.put(
  '/:id/coordinadores',
  requirePermission('colegios', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { coordinadores } = coordinadoresSchema.parse(req.body);
      res.json({
        data: await service.reemplazarCoordinadores(actor(req), id, coordinadores),
        error: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

/** DELETE /api/v1/colegios/:id — permanente. Exige escribir el nombre. */
colegiosRouter.delete(
  '/:id',
  requirePermission('colegios', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { confirmacion } = eliminarColegioSchema.parse(req.body);
      res.json({ data: await service.eliminar(actor(req), id, confirmacion), error: null });
    } catch (err) {
      next(err);
    }
  },
);
