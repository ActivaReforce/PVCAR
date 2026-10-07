import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import * as service from './permisos.service.js';

const rolParamSchema = z.object({ rolId: z.coerce.number().int().positive() });

const permisosBodySchema = z.object({
  permisos: z
    .array(
      z.object({
        modulo: z.string().trim().min(1).max(60),
        accion: z.string().trim().min(1).max(20),
      }),
    )
    .max(200),
});

export const permisosRouter = Router();

permisosRouter.use(requireAuth);

/** GET /api/v1/permisos — matriz completa: roles, modulos y acciones. */
permisosRouter.get(
  '/',
  requirePermission('permisos', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.matriz(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/v1/permisos/rol/:rolId — reemplaza los permisos de un rol.
 *
 * El permiso `permisos.editar` no existe en el catalogo: en los datos reales
 * el modulo `permisos` solo tiene la accion `ver`, y solo la tiene el
 * Propietario. Por eso la escritura se cierra con el rol global, comprobado en
 * el servicio, igual que hacia la RPC set_role_permissions.
 */
permisosRouter.put(
  '/rol/:rolId',
  requirePermission('permisos', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ApiError(401, 'No autenticado');
      const { rolId } = rolParamSchema.parse(req.params);
      const { permisos } = permisosBodySchema.parse(req.body);
      const guardados = await service.reemplazarPermisosDeRol(req.user, rolId, permisos);
      res.json({ data: guardados, error: null });
    } catch (err) {
      next(err);
    }
  },
);
