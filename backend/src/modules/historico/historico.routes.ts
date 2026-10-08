import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import { consultaSchema, exportacionSchema, idParamSchema, resumenSchema } from './historico.schemas.js';
import * as service from './historico.service.js';
import { hoyEc } from '../../lib/fecha.js';

/**
 * Rutas de Data anterior (esquema `archivo`).
 *
 * `reportes:ver` para mirar y `reportes:crear` para exportar, como el resto de
 * Reportes, y además rol global (Propietario o Admin): ver `historico.service.ts`.
 */

export const historicoRouter = Router();

historicoRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  service.exigirGlobal(req.user);
  return req.user;
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

historicoRouter.get(
  '/conjuntos',
  requirePermission('reportes', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      actor(req);
      res.json({ data: await service.catalogo(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

historicoRouter.get(
  '/opciones',
  requirePermission('reportes', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      actor(req);
      res.json({ data: await service.opciones(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

historicoRouter.get(
  '/resumen',
  requirePermission('reportes', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      actor(req);
      const filtros = resumenSchema.parse(req.query);
      res.json({ data: await service.resumen(filtros), error: null });
    } catch (err) {
      next(err);
    }
  },
);

historicoRouter.get(
  '/conjuntos/:id',
  requirePermission('reportes', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      actor(req);
      const { id } = idParamSchema.parse(req.params);
      const query = consultaSchema.parse(req.query);
      res.json({ data: await service.consultar(id, query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Si el error llega con las cabeceras ya mandadas, no se puede responder un
 * JSON: se corta la conexión para que el navegador no guarde un xlsx a medias
 * que parecería bueno. Mismo criterio que la exportación de Reportes.
 */
function cortarOSeguir(res: Response, next: NextFunction, err: unknown) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  next(err);
}

/** POST: los filtros van en el cuerpo y no quedan en los logs (llevan nombres de menores). */
historicoRouter.post(
  '/conjuntos/:id/export',
  requirePermission('reportes', 'crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quien = actor(req);
      const { id } = idParamSchema.parse(req.params);
      const body = exportacionSchema.parse(req.body ?? {});
      const sello = hoyEc();

      res.setHeader('Content-Type', XLSX);
      res.setHeader('Content-Disposition', `attachment; filename="data-anterior-${id}-${sello}.xlsx"`);
      res.setHeader('Cache-Control', 'no-store');
      await service.exportar(quien, id, body, res);
    } catch (err) {
      cortarOSeguir(res, next, err);
    }
  },
);

historicoRouter.post(
  '/export',
  requirePermission('reportes', 'crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quien = actor(req);
      const sello = hoyEc();

      res.setHeader('Content-Type', XLSX);
      res.setHeader('Content-Disposition', `attachment; filename="data-anterior-completa-${sello}.xlsx"`);
      res.setHeader('Cache-Control', 'no-store');
      await service.exportarTodo(quien, res);
    } catch (err) {
      cortarOSeguir(res, next, err);
    }
  },
);
