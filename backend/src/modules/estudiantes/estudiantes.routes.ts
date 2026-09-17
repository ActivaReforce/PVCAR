import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { firmarSubidaFoto } from '../../lib/storage.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import {
  actualizarEstudianteSchema,
  crearEstudianteSchema,
  dosIdsParamSchema,
  eliminarEstudianteSchema,
  historialSchema,
  idParamSchema,
  inscripcionesSchema,
  listarEstudiantesSchema,
  representanteSchema,
} from './estudiantes.schemas.js';
import * as service from './estudiantes.service.js';

const fotoSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

export const estudiantesRouter = Router();

estudiantesRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

/** GET /api/v1/estudiantes — pagina + conteos, filtrada por alcance. */
estudiantesRouter.get(
  '/',
  requirePermission('estudiantes', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listarEstudiantesSchema.parse(req.query);
      res.json({ data: await service.listar(actor(req), query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Catalogos y auxiliares van antes de /:id. */
estudiantesRouter.get(
  '/grados',
  requirePermission('estudiantes', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.grados(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

estudiantesRouter.get(
  '/candidatos-representante',
  requirePermission('estudiantes', 'editar'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.candidatosARepresentante(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

estudiantesRouter.post(
  '/foto',
  requirePermission('estudiantes', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { mimeType } = fotoSchema.parse(req.body);
      res.json({ data: await firmarSubidaFoto(mimeType, 'estudiantes'), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/v1/estudiantes/:id — ficha con inscripciones y representantes. */
estudiantesRouter.get(
  '/:id',
  requirePermission('estudiantes', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { historial } = historialSchema.parse(req.query);
      res.json({ data: await service.ficha(actor(req), id, historial), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Disciplinas de su colegio en las que todavia no esta inscrito. */
estudiantesRouter.get(
  '/:id/disponibles',
  requirePermission('estudiantes', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.disponibles(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

estudiantesRouter.get(
  '/:id/impacto',
  requirePermission('estudiantes', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.impacto(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

estudiantesRouter.post(
  '/',
  requirePermission('estudiantes', 'crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = crearEstudianteSchema.parse(req.body);
      res.status(201).json({ data: await service.crear(actor(req), input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

estudiantesRouter.patch(
  '/:id',
  requirePermission('estudiantes', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const input = actualizarEstudianteSchema.parse(req.body);
      res.json({ data: await service.actualizar(actor(req), id, input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/v1/estudiantes/:id/inscripciones — la lista completa de disciplinas
 * activas. El backend inscribe lo que falta y da de baja lo que sobra, en una
 * transaccion.
 */
estudiantesRouter.put(
  '/:id/inscripciones',
  requirePermission('estudiantes', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { colacthor_ids } = inscripcionesSchema.parse(req.body);
      res.json({
        data: await service.sincronizarInscripciones(actor(req), id, colacthor_ids),
        error: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

estudiantesRouter.post(
  '/:id/baja',
  requirePermission('estudiantes', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.darDeBaja(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

estudiantesRouter.post(
  '/:id/reactivar',
  requirePermission('estudiantes', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.reactivar(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** DELETE — permanente y en cascada. Exige escribir el nombre. */
estudiantesRouter.delete(
  '/:id',
  requirePermission('estudiantes', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { confirmacion } = eliminarEstudianteSchema.parse(req.body);
      res.json({ data: await service.eliminar(actor(req), id, confirmacion), error: null });
    } catch (err) {
      next(err);
    }
  },
);

estudiantesRouter.post(
  '/:id/representantes',
  requirePermission('estudiantes', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { usu_id } = representanteSchema.parse(req.body);
      res
        .status(201)
        .json({ data: await service.atarRepresentante(actor(req), id, usu_id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

estudiantesRouter.delete(
  '/:id/representantes/:segundoId',
  requirePermission('estudiantes', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, segundoId } = dosIdsParamSchema.parse(req.params);
      res.json({
        data: await service.soltarRepresentante(actor(req), id, segundoId),
        error: null,
      });
    } catch (err) {
      next(err);
    }
  },
);
