import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import * as service from './representantes.service.js';

/**
 * Rutas de Representantes.
 *
 * **Los permisos son prestados, y a propósito.** No hay un módulo
 * `representantes` en `rol_permiso` —nunca existió esta pantalla— y no se
 * inventa uno: ver representantes es ver personas (`usuarios:ver`) y atarles
 * hijos es tocar la ficha de un alumno (`estudiantes:editar`), que es
 * exactamente el permiso que ya pide el endpoint gemelo en Estudiantes.
 *
 * Si algún día el cliente quiere separarlo, se añade el módulo al catálogo de
 * permisos y se cambian estas cinco líneas.
 */

export const representantesRouter = Router();

representantesRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

representantesRouter.get(
  '/',
  requirePermission('usuarios', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = service.listarSchema.parse(req.query);
      res.json({ data: await service.listar(actor(req), query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

representantesRouter.get(
  '/:id',
  requirePermission('usuarios', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = service.idParamSchema.parse(req.params);
      res.json({ data: await service.ficha(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Alumnos del alcance a los que todavia no representa. */
representantesRouter.get(
  '/:id/disponibles',
  requirePermission('estudiantes', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = service.idParamSchema.parse(req.params);
      const { buscar } = service.disponiblesSchema.parse(req.query);
      res.json({ data: await service.disponibles(actor(req), id, buscar), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** La lista completa de hijos que debe tener: ata lo que falta y suelta lo que sobra. */
representantesRouter.put(
  '/:id/hijos',
  requirePermission('estudiantes', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = service.idParamSchema.parse(req.params);
      const { nino_ids } = service.hijosSchema.parse(req.body);
      res.json({ data: await service.sincronizarHijos(actor(req), id, nino_ids), error: null });
    } catch (err) {
      next(err);
    }
  },
);

representantesRouter.patch(
  '/:id',
  requirePermission('usuarios', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = service.idParamSchema.parse(req.params);
      const { padre_sector_residencia } = service.sectorSchema.parse(req.body);
      res.json({
        data: await service.actualizarSector(actor(req), id, padre_sector_residencia),
        error: null,
      });
    } catch (err) {
      next(err);
    }
  },
);
