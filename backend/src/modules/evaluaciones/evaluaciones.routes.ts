import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import {
  actualizarEvaluacionSchema,
  crearEvaluacionSchema,
  disciplinasSchema,
  eliminarEvaluacionSchema,
  idParamSchema,
  intentosSchema,
  listarEvaluacionesSchema,
  listarPendientesSchema,
  parametrosSchema,
} from './evaluaciones.schemas.js';
import * as service from './evaluaciones.service.js';

/**
 * Rutas de Evaluaciones.
 *
 * El reparto de permisos sale del catalogo real de `rol_permiso`:
 *
 *   ver      -> los seis roles que entran al modulo
 *   crear    -> Propietario y Coordinador: dar de alta una plantilla
 *   editar   -> los anteriores **y el Entrenador**, porque editar es lo que
 *               hace falta para poner notas a sus alumnos
 *   eliminar -> solo Propietario
 *
 * Por eso **evaluar a un alumno pide `editar`, no `crear`**: si pidiera `crear`,
 * ningun entrenador podria evaluar, que es justo su trabajo.
 */

export const evaluacionesRouter = Router();

evaluacionesRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

// ---------------------------------------------------------------------------
// Catalogos y lista. Las rutas fijas van antes de /:id.

evaluacionesRouter.get(
  '/',
  requirePermission('evaluaciones', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listarEvaluacionesSchema.parse(req.query);
      res.json({ data: await service.listar(actor(req), query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

evaluacionesRouter.get(
  '/metodos',
  requirePermission('evaluaciones', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.metodos(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

evaluacionesRouter.get(
  '/categorias',
  requirePermission('evaluaciones', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.categorias(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Evaluar alumnos. Van antes de /:id para que 'pendientes' no se lea como un id.

evaluacionesRouter.get(
  '/pendientes',
  requirePermission('evaluaciones', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listarPendientesSchema.parse(req.query);
      res.json({ data: await service.pendientes(actor(req), query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

evaluacionesRouter.get(
  '/pendientes/:id',
  requirePermission('evaluaciones', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.fichaDeAlumno(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Los intentos completos de un alumno. El puntaje lo calcula el servidor. */
evaluacionesRouter.put(
  '/pendientes/:id/intentos',
  requirePermission('evaluaciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const input = intentosSchema.parse(req.body);
      res.json({ data: await service.guardarIntentos(actor(req), id, input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Borra la evaluacion de un alumno y lo devuelve a pendiente. */
evaluacionesRouter.delete(
  '/pendientes/:id',
  requirePermission('evaluaciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.borrarEvaluacionDeAlumno(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// La plantilla

evaluacionesRouter.get(
  '/:id',
  requirePermission('evaluaciones', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.ficha(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

evaluacionesRouter.get(
  '/:id/disciplinas',
  requirePermission('evaluaciones', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.disciplinas(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

evaluacionesRouter.get(
  '/:id/impacto',
  requirePermission('evaluaciones', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.impacto(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

evaluacionesRouter.post(
  '/',
  requirePermission('evaluaciones', 'crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = crearEvaluacionSchema.parse(req.body);
      res.status(201).json({ data: await service.crear(actor(req), input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

evaluacionesRouter.patch(
  '/:id',
  requirePermission('evaluaciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const input = actualizarEvaluacionSchema.parse(req.body);
      res.json({ data: await service.actualizar(actor(req), id, input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** La lista completa de parametros que debe tener la evaluacion. */
evaluacionesRouter.put(
  '/:id/parametros',
  requirePermission('evaluaciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { parametros } = parametrosSchema.parse(req.body);
      res.json({ data: await service.guardarParametros(actor(req), id, parametros), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** La lista completa de disciplinas vinculadas. Crea y desactiva pendientes. */
evaluacionesRouter.put(
  '/:id/disciplinas',
  requirePermission('evaluaciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { colacthor_ids } = disciplinasSchema.parse(req.body);
      res.json({
        data: await service.sincronizarDisciplinas(actor(req), id, colacthor_ids),
        error: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

evaluacionesRouter.post(
  '/:id/baja',
  requirePermission('evaluaciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.darDeBaja(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

evaluacionesRouter.post(
  '/:id/reactivar',
  requirePermission('evaluaciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.reactivar(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Borrado permanente y en cascada. Exige escribir el titulo. */
evaluacionesRouter.delete(
  '/:id',
  requirePermission('evaluaciones', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { confirmacion } = eliminarEvaluacionSchema.parse(req.body);
      res.json({ data: await service.eliminar(actor(req), id, confirmacion), error: null });
    } catch (err) {
      next(err);
    }
  },
);
