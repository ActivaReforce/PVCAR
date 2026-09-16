import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import {
  actualizarDisciplinaSchema,
  crearDisciplinasSchema,
  eliminarDisciplinaSchema,
  idParamSchema,
  listarDisciplinasSchema,
} from './disciplinas.schemas.js';
import * as service from './disciplinas.service.js';

export const disciplinasRouter = Router();

disciplinasRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

/** GET /api/v1/disciplinas — pagina + conteos, filtrada por alcance. */
disciplinasRouter.get(
  '/',
  requirePermission('disciplinas', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listarDisciplinasSchema.parse(req.query);
      res.json({ data: await service.listar(actor(req), query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/v1/disciplinas/dias — catalogo. Va antes de /:id. */
disciplinasRouter.get(
  '/dias',
  requirePermission('disciplinas', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.dias(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

disciplinasRouter.get(
  '/:id',
  requirePermission('disciplinas', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.obtener(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/v1/disciplinas/:id/previo-baja — que se va a cerrar con la baja. */
disciplinasRouter.get(
  '/:id/previo-baja',
  requirePermission('disciplinas', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.previoBaja(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

disciplinasRouter.get(
  '/:id/impacto',
  requirePermission('disciplinas', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.impacto(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/disciplinas — alta por lote.
 *
 * Un colegio, una actividad y varias franjas: asi se crea de verdad ("karate
 * en Quitumbe, lunes y miercoles de 15:00 a 16:00"). Todo en una transaccion.
 */
disciplinasRouter.post(
  '/',
  requirePermission('disciplinas', 'crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = crearDisciplinasSchema.parse(req.body);
      res.status(201).json({ data: await service.crear(actor(req), input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

disciplinasRouter.patch(
  '/:id',
  requirePermission('disciplinas', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const input = actualizarDisciplinaSchema.parse(req.body);
      res.json({ data: await service.actualizar(actor(req), id, input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Baja y reactivacion. Son operaciones de negocio con efectos propios —la baja
 * cierra inscripciones y asignaciones— asi que van como subrecurso y se
 * auditan como tales, no como un PATCH de est_id.
 */
disciplinasRouter.post(
  '/:id/baja',
  requirePermission('disciplinas', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.darDeBaja(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

disciplinasRouter.post(
  '/:id/reactivar',
  requirePermission('disciplinas', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.reactivar(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** DELETE — permanente, solo si nunca se uso. Exige escribir la actividad. */
disciplinasRouter.delete(
  '/:id',
  requirePermission('disciplinas', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { confirmacion } = eliminarDisciplinaSchema.parse(req.body);
      res.json({ data: await service.eliminar(actor(req), id, confirmacion), error: null });
    } catch (err) {
      next(err);
    }
  },
);
