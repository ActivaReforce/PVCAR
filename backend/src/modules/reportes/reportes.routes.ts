import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import { consultaSchema, filtrosSchema, idParamSchema } from './reportes.schemas.js';
import * as service from './reportes.service.js';

/**
 * Rutas de Reportes.
 *
 * `ver` para consultar, **`crear` para exportar**, que es el reparto que ya
 * tiene el catálogo de permisos: seis roles pueden mirar un informe en
 * pantalla y solo Propietario, Coordinador y Admin pueden bajarse el Excel.
 * Encima de eso, cada reporte exige además el `ver` de su módulo de origen.
 */

export const reportesRouter = Router();

reportesRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

/** Qué reportes puede abrir quien pregunta, con sus columnas. */
reportesRouter.get(
  '/',
  requirePermission('reportes', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: service.catalogo(actor(req)), error: null });
    } catch (err) {
      next(err);
    }
  },
);

reportesRouter.get(
  '/:modulo',
  requirePermission('reportes', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { modulo } = idParamSchema.parse(req.params);
      const query = consultaSchema.parse(req.query);
      res.json({ data: await service.ejecutar(actor(req), modulo, query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * La exportación.
 *
 * Es un POST y no un GET a propósito: los filtros van en el cuerpo y no
 * quedan escritos en los logs del servidor, que con el reporte de alumnos
 * incluiría el texto buscado —a menudo el nombre de un menor.
 *
 * Las cabeceras se escriben **antes** de empezar a generar, porque el archivo
 * sale en streaming y ya no hay vuelta atrás. Si algo falla después de la
 * primera fila, la descarga se corta: por eso los permisos, la definición y el
 * rango se comprueban antes de tocar la respuesta.
 */
reportesRouter.post(
  '/:modulo/export',
  requirePermission('reportes', 'crear'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { modulo } = idParamSchema.parse(req.params);
      const filtros = filtrosSchema.parse(req.body ?? {});
      const sello = new Date().toISOString().slice(0, 10);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${modulo}-${sello}.xlsx"`);
      res.setHeader('Cache-Control', 'no-store');

      await service.exportar(actor(req), modulo, filtros, res);
    } catch (err) {
      /**
       * Si ya se mandaron cabeceras no se puede responder un JSON de error: lo
       * único honesto es cortar la conexión para que el navegador no guarde un
       * xlsx a medias que parecería válido.
       */
      if (res.headersSent) {
        res.destroy();
        return;
      }
      next(err);
    }
  },
);
