import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import * as service from './inscripciones.service.js';
import {
  envioSchema,
  idParamSchema,
  listarSchema,
  publicarDocumentoSchema,
  rechazarSchema,
} from './inscripciones.schemas.js';

/**
 * Dos routers:
 *
 * - `/inscripcion` — **publico, sin sesion.** El formulario que llega por el
 *   correo masivo. Es la unica escritura del API que no pide autenticacion.
 * - `/inscripciones` — el modulo interno. Solo Propietario (migracion 0014):
 *   ver la lista, aprobar (`editar`) y rechazar (`eliminar`).
 */

// ---------------------------------------------------------------------------
// Publico

/**
 * Sin captcha por decision del cliente (institucion pequena, formulario
 * largo). Este limite no lo nota quien se inscribe de verdad y frena a un
 * script: 10 envios por hora desde la misma IP. Un colegio entero detras de
 * una IP podria toparlo solo si diez familias envian en la misma hora.
 */
const envioLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    data: null,
    error: { message: 'Se recibieron demasiadas inscripciones desde esta conexión. Intenta en una hora.' },
  },
});

export const inscripcionPublicaRouter = Router();

inscripcionPublicaRouter.get(
  '/formulario',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.formulario(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

inscripcionPublicaRouter.post(
  '/',
  envioLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = envioSchema.parse(req.body);
      const navegador = req.get('user-agent')?.slice(0, 300) ?? null;
      const recibido = await service.enviar(input, { ip: req.ip ?? null, navegador });
      res.status(201).json({ data: recibido, error: null });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Modulo interno

export const inscripcionesRouter = Router();

inscripcionesRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

inscripcionesRouter.get(
  '/',
  requirePermission('inscripciones', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listarSchema.parse(req.query);
      res.json({ data: await service.listar(query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

inscripcionesRouter.get(
  '/documentos',
  requirePermission('inscripciones', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.documentos(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

inscripcionesRouter.get(
  '/documentos/:id',
  requirePermission('inscripciones', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.documento(id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Publicar una version nueva. Las anteriores no se tocan nunca. */
inscripcionesRouter.post(
  '/documentos',
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = publicarDocumentoSchema.parse(req.body);
      res.status(201).json({ data: await service.publicarDocumento(actor(req), input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

inscripcionesRouter.get(
  '/:id',
  requirePermission('inscripciones', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.detalle(id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

inscripcionesRouter.post(
  '/:id/aprobar',
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.aprobar(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Rechazar: borrado permanente. El cuerpo lleva el nombre escrito a mano. */
inscripcionesRouter.delete(
  '/:id',
  requirePermission('inscripciones', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { confirmacion } = rechazarSchema.parse(req.body);
      await service.rechazar(actor(req), id, confirmacion);
      res.json({ data: { ins_id: id }, error: null });
    } catch (err) {
      next(err);
    }
  },
);
