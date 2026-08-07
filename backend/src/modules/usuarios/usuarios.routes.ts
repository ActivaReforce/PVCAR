import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { firmarSubidaFoto } from '../../lib/storage.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import {
  actualizarUsuarioSchema,
  crearUsuarioSchema,
  eliminarUsuarioSchema,
  idParamSchema,
  listarUsuariosSchema,
} from './usuarios.schemas.js';
import * as service from './usuarios.service.js';

const fotoSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

export const usuariosRouter = Router();

/** Todo el modulo exige sesion. Los permisos van endpoint por endpoint. */
usuariosRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

/** GET /api/v1/usuarios — pagina + conteos, ya filtrados por alcance. */
usuariosRouter.get(
  '/',
  requirePermission('usuarios', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listarUsuariosSchema.parse(req.query);
      res.json({ data: await service.listar(actor(req), query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/usuarios/roles — catalogo para el selector.
 * Va antes de /:id: si no, Express intenta leer "roles" como id.
 */
usuariosRouter.get(
  '/roles',
  requirePermission('usuarios', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.catalogoRoles(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/usuarios/foto — URL de subida firmada para la foto del
 * formulario. Misma mecanica que en Perfil: el navegador sube directo a
 * Storage y luego manda la ruta en el POST o el PATCH del usuario.
 */
usuariosRouter.post(
  '/foto',
  requirePermission('usuarios', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { mimeType } = fotoSchema.parse(req.body);
      res.json({ data: await firmarSubidaFoto(mimeType), error: null });
    } catch (err) {
      next(err);
    }
  },
);

usuariosRouter.get(
  '/:id',
  requirePermission('usuarios', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.obtener(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/v1/usuarios/:id/impacto — que se destruye y que lo impide. */
usuariosRouter.get(
  '/:id/impacto',
  requirePermission('usuarios', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.impacto(id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

usuariosRouter.post(
  '/',
  requirePermission('usuarios', 'crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = crearUsuarioSchema.parse(req.body);
      res.status(201).json({ data: await service.crear(actor(req), input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

usuariosRouter.patch(
  '/:id',
  requirePermission('usuarios', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const input = actualizarUsuarioSchema.parse(req.body);
      res.json({ data: await service.actualizar(actor(req), id, input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Baja y reactivacion son POST a un subrecurso, no un PATCH de est_id: son
 * operaciones de negocio con efectos propios (cierran las asignaciones del
 * entrenador) y se auditan como tales.
 */
usuariosRouter.post(
  '/:id/baja',
  requirePermission('usuarios', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.darDeBaja(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

usuariosRouter.post(
  '/:id/reactivar',
  requirePermission('usuarios', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.reactivar(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** DELETE /api/v1/usuarios/:id — permanente. Exige escribir el nombre. */
usuariosRouter.delete(
  '/:id',
  requirePermission('usuarios', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { confirmacion } = eliminarUsuarioSchema.parse(req.body);
      res.json({ data: await service.eliminar(actor(req), id, confirmacion), error: null });
    } catch (err) {
      next(err);
    }
  },
);
