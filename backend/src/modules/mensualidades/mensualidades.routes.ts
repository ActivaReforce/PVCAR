import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import { claveValida, unaVez } from '../../lib/unaVez.js';
import * as service from './mensualidades.service.js';
import {
  cobroColegioSchema,
  colIdParamSchema,
  configSchema,
  idParamSchema,
  listarPagosSchema,
  mesQuerySchema,
  pagarSchema,
  rechazarPagoSchema,
} from './mensualidades.schemas.js';

/**
 * Mensualidades (migración 0041).
 *
 * - `/mias`, `POST /pagos` y `DELETE /pagos/:id`: el representante, con su
 *   sesión, sobre sus hijos. No piden casilla: pagar es cosa de la familia y
 *   el alcance ya lo da su cuenta (solo sus hijos, solo sus pagos).
 * - El resto, solo el personal (Propietario y Admin) con la casilla de
 *   Inscripciones: ver, aprobar (editar) y rechazar (eliminar), como las
 *   inscripciones.
 */
export const mensualidadesRouter = Router();

mensualidadesRouter.use(requireAuth);

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

const personal = (req: Request, _res: Response, next: NextFunction) => {
  try {
    service.exigirPersonal(actor(req));
    next();
  } catch (err) {
    next(err);
  }
};

mensualidadesRouter.get('/mias', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await service.misMensualidades(actor(req)), error: null });
  } catch (err) {
    next(err);
  }
});

mensualidadesRouter.post('/pagos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = pagarSchema.parse(req.body);
    const navegador = req.get('user-agent')?.slice(0, 300) ?? null;
    // Como la inscripción: si se corta la conexión, el reintento no duplica (lib/unaVez.ts).
    const hecho = await unaVez(claveValida(req.get('idempotency-key')), () =>
      service.pagar(actor(req), input, { ip: req.ip ?? null, navegador }),
    );
    res.status(201).json({ data: hecho, error: null });
  } catch (err) {
    next(err);
  }
});

/** Volver a intentar un pago rechazado: se borra, con su motivo. */
mensualidadesRouter.delete('/pagos/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await service.descartarRechazado(actor(req), id);
    res.json({ data: { menpag_id: id }, error: null });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Personal

mensualidadesRouter.get(
  '/pagos',
  personal,
  requirePermission('inscripciones', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.listarPagos(listarPagosSchema.parse(req.query)), error: null });
    } catch (err) {
      next(err);
    }
  },
);

mensualidadesRouter.get(
  '/pagos/:id',
  personal,
  requirePermission('inscripciones', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.verPago(id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

mensualidadesRouter.post(
  '/pagos/:id/aprobar',
  personal,
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      await service.aprobarPago(actor(req), id);
      res.json({ data: { menpag_id: id }, error: null });
    } catch (err) {
      next(err);
    }
  },
);

mensualidadesRouter.post(
  '/pagos/:id/rechazar',
  personal,
  requirePermission('inscripciones', 'eliminar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { motivo } = rechazarPagoSchema.parse(req.body);
      await service.rechazarPago(actor(req), id, motivo);
      res.json({ data: { menpag_id: id }, error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** El estado de un mes (?mes=YYYY-MM, por defecto el actual), por colegio. */
mensualidadesRouter.get(
  '/mes',
  personal,
  requirePermission('inscripciones', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { mes, colegio } = mesQuerySchema.parse(req.query);
      res.json({ data: await service.estadoDelMes(mes, colegio), error: null });
    } catch (err) {
      next(err);
    }
  },
);

mensualidadesRouter.get(
  '/config',
  personal,
  requirePermission('inscripciones', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.config(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

mensualidadesRouter.put(
  '/config',
  personal,
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = configSchema.parse(req.body);
      await service.guardarConfig(actor(req), input);
      res.json({ data: input, error: null });
    } catch (err) {
      next(err);
    }
  },
);

mensualidadesRouter.put(
  '/config/colegios/:colId',
  personal,
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { colId } = colIdParamSchema.parse(req.params);
      const { meses, desde } = cobroColegioSchema.parse(req.body);
      await service.guardarCobroColegio(actor(req), colId, meses, desde);
      res.json({ data: { col_id: colId, meses, desde }, error: null });
    } catch (err) {
      next(err);
    }
  },
);
