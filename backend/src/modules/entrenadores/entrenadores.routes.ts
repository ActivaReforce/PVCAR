import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import {
  asignarSchema,
  atarAuxiliarSchema,
  dosIdsParamSchema,
  historialSchema,
  idParamSchema,
  listarEntrenadoresSchema,
} from './entrenadores.schemas.js';
import * as service from './entrenadores.service.js';

export const entrenadoresRouter = Router();

entrenadoresRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

const colegiosQuerySchema = z.object({
  colegio: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((valor) => {
      if (valor === undefined) return null;
      const texto = Array.isArray(valor) ? valor.join(',') : valor;
      const ids = texto
        .split(',')
        .map((t) => Number(t.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
      return ids.length > 0 ? ids : null;
    }),
});

/** GET /api/v1/entrenadores — pagina + conteos, filtrada por alcance. */
entrenadoresRouter.get(
  '/',
  requirePermission('entrenadores', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listarEntrenadoresSchema.parse(req.query);
      res.json({ data: await service.listar(actor(req), query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/entrenadores/candidatos-auxiliar — usuarios activos con rol 6 o
 * 7 que no respalden ya a nadie. Va antes de /:id.
 */
entrenadoresRouter.get(
  '/candidatos-auxiliar',
  requirePermission('entrenadores', 'editar'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.candidatosAAuxiliar(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/entrenadores/:id — ficha: datos, asignaciones y auxiliares.
 * `?historial=true` añade las asignaciones cerradas y los auxiliares sueltos.
 */
entrenadoresRouter.get(
  '/:id',
  requirePermission('entrenadores', 'ver'),
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

/** GET /api/v1/entrenadores/:id/disponibles — disciplinas que puede tomar. */
entrenadoresRouter.get(
  '/:id/disponibles',
  requirePermission('entrenadores', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { colegio } = colegiosQuerySchema.parse(req.query);
      res.json({ data: await service.disponibles(actor(req), id, colegio), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /api/v1/entrenadores/:id/asignaciones — atar una disciplina. */
entrenadoresRouter.post(
  '/:id/asignaciones',
  requirePermission('entrenadores', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const input = asignarSchema.parse(req.body);
      res.status(201).json({ data: await service.asignar(actor(req), id, input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/v1/entrenadores/:id/asignaciones/:segundoId — la cierra con la
 * fecha de hoy. No borra la fila: es historia y las asistencias se leen contra
 * ella.
 */
entrenadoresRouter.delete(
  '/:id/asignaciones/:segundoId',
  requirePermission('entrenadores', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, segundoId } = dosIdsParamSchema.parse(req.params);
      res.json({ data: await service.cerrar(actor(req), id, segundoId), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /api/v1/entrenadores/:id/auxiliares — atar un asistente o respaldo. */
entrenadoresRouter.post(
  '/:id/auxiliares',
  requirePermission('entrenadores', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { usu_id } = atarAuxiliarSchema.parse(req.body);
      res.status(201).json({ data: await service.atarAuxiliar(actor(req), id, usu_id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

entrenadoresRouter.delete(
  '/:id/auxiliares/:segundoId',
  requirePermission('entrenadores', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, segundoId } = dosIdsParamSchema.parse(req.params);
      res.json({ data: await service.soltarAuxiliar(actor(req), id, segundoId), error: null });
    } catch (err) {
      next(err);
    }
  },
);
