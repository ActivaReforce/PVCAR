import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import {
  actualizarEncuestaSchema,
  crearEncuestaSchema,
  eliminarEncuestaSchema,
  idParamSchema,
  listarEncuestasSchema,
  preguntasSchema,
  responderSchema,
} from './encuestas.schemas.js';
import * as service from './encuestas.service.js';

/**
 * Rutas de Encuestas.
 *
 * **Dos mitades con puertas distintas**, y esa es la parte que importa:
 *
 *   `/encuestas/mias/*`  lo usa el **representante**, que NO tiene
 *                        `encuestas:ver`. La puerta es tener el rol 4 y su
 *                        ficha de `padre`, y la comprueba el servicio.
 *   el resto             lo usa quien gestiona, con `encuestas:ver`.
 *
 * Igual que en Asistencias, en `rol_permiso` el modulo `encuestas` solo tiene
 * la accion `ver` —nadie tiene `crear` ni `editar`—, asi que `ver` habilita
 * tambien la gestion. Queda anotado en `docs/fase14-encuestas-representantes.md`
 * como decision a confirmar.
 *
 * Las rutas de `/mias` van **antes** de `/:id` para que "mias" no se lea como
 * un id.
 */

export const encuestasRouter = Router();

encuestasRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

// ---------------------------------------------------------------------------
// El lado del representante

/** Las publicadas, con si ya las respondio. Es lo que alimenta el aviso. */
encuestasRouter.get(
  '/mias',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.mias(actor(req)), error: null });
    } catch (err) {
      next(err);
    }
  },
);

encuestasRouter.get(
  '/mias/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.paraResponder(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

encuestasRouter.post(
  '/mias/:id/responder',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const input = responderSchema.parse(req.body);
      res.status(201).json({ data: await service.responder(actor(req), id, input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Gestion

encuestasRouter.get(
  '/',
  requirePermission('encuestas', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listarEncuestasSchema.parse(req.query);
      res.json({ data: await service.listar(actor(req), query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

encuestasRouter.get(
  '/tipos',
  requirePermission('encuestas', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.tipos(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

encuestasRouter.post(
  '/',
  requirePermission('encuestas', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = crearEncuestaSchema.parse(req.body);
      res.status(201).json({ data: await service.crear(actor(req), input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

encuestasRouter.get(
  '/:id',
  requirePermission('encuestas', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.ficha(id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

encuestasRouter.get(
  '/:id/resultados',
  requirePermission('encuestas', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.resultados(id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

encuestasRouter.get(
  '/:id/impacto',
  requirePermission('encuestas', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.impacto(id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

encuestasRouter.patch(
  '/:id',
  requirePermission('encuestas', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const input = actualizarEncuestaSchema.parse(req.body);
      res.json({ data: await service.actualizar(actor(req), id, input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** La lista completa de preguntas. El orden es la posicion en el array. */
encuestasRouter.put(
  '/:id/preguntas',
  requirePermission('encuestas', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { preguntas } = preguntasSchema.parse(req.body);
      res.json({ data: await service.guardarPreguntas(actor(req), id, preguntas), error: null });
    } catch (err) {
      next(err);
    }
  },
);

encuestasRouter.post(
  '/:id/finalizar',
  requirePermission('encuestas', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.finalizar(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

encuestasRouter.post(
  '/:id/borrador',
  requirePermission('encuestas', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.volverABorrador(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

encuestasRouter.post(
  '/:id/publicar',
  requirePermission('encuestas', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.publicar(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Borrado permanente y en cascada. Exige escribir el titulo. */
encuestasRouter.delete(
  '/:id',
  requirePermission('encuestas', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { confirmacion } = eliminarEncuestaSchema.parse(req.body);
      res.json({ data: await service.eliminar(actor(req), id, confirmacion), error: null });
    } catch (err) {
      next(err);
    }
  },
);
