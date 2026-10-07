import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import * as service from './inscripciones.service.js';
import {
  borradorDocumentoSchema,
  colIdParamSchema,
  cotizacionSchema,
  envioSchema,
  abrirSchema,
  aprobarSchema,
  cuentaBancariaSchema,
  identificarSchema,
  maxDisciplinasSchema,
  idParamSchema,
  listarSchema,
  membreteSchema,
  precioSchema,
  problemasDeEnvio,
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

/** Frena a quien prueba cédulas en lote para saber quién tiene cuenta. */
const identificarLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    data: null,
    error: { message: 'Demasiadas consultas desde esta conexión. Intenta en una hora.' },
  },
});

/**
 * El formulario público también lo usa quien ya tiene cuenta (§9): si llega
 * con su token, se le reconoce; si no, sigue como anónimo. Un token que no
 * vale da 401, igual que en el resto del API.
 */
function sesionOpcional(req: Request, res: Response, next: NextFunction): void {
  if (!req.headers.authorization) return next();
  void requireAuth(req, res, next);
}

export const inscripcionPublicaRouter = Router();

/** "Ya inscribí antes": dice si esa cédula tiene cuenta. No enseña ningún dato. */
inscripcionPublicaRouter.post(
  '/identificar',
  identificarLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cedula } = identificarSchema.parse(req.body);
      res.json({ data: await service.identificar(cedula), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Con la sesión iniciada: sus datos y sus hijos, para no volver a llenar nada. */
inscripcionPublicaRouter.get(
  '/mis-datos',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new ApiError(401, 'No autenticado');
      res.json({ data: await service.misDatos(req.user), error: null });
    } catch (err) {
      next(err);
    }
  },
);

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

/** Cuanto se paga con lo elegido. Solo lee: no guarda nada. */
inscripcionPublicaRouter.post(
  '/cotizacion',
  sesionOpcional,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ninos } = cotizacionSchema.parse(req.body);
      res.json({ data: await service.cotizar(ninos, req.user ?? null), error: null });
    } catch (err) {
      next(err);
    }
  },
);

inscripcionPublicaRouter.post(
  '/',
  envioLimiter,
  sesionOpcional,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validado = envioSchema.safeParse(req.body);
      if (!validado.success) {
        throw new ApiError(400, 'Hay datos que revisar', { problemas: problemasDeEnvio(validado.error) });
      }
      const input = validado.data;
      const navegador = req.get('user-agent')?.slice(0, 300) ?? null;
      const recibido = await service.enviar(input, { ip: req.ip ?? null, navegador }, req.user ?? null);
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

/**
 * Quien no es Propietario ni Admin (un representante con permiso de ver)
 * solo puede pedir su lista y la ficha de las suyas. Todo lo demás
 * (documentos, valores de los colegios, configuración, abrir y cerrar,
 * aprobar, rechazar) es del personal, tenga el permiso que tenga.
 */
inscripcionesRouter.use((req: Request, _res: Response, next: NextFunction) => {
  try {
    if (service.esPersonal(actor(req))) return next();
    const lectura = req.method === 'GET' && (req.path === '/' || /^\/\d+$/.test(req.path));
    if (!lectura) throw new ApiError(403, 'Solo el personal de Activa Reforce puede hacer esto');
    next();
  } catch (err) {
    next(err);
  }
});

inscripcionesRouter.get(
  '/',
  requirePermission('inscripciones', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listarSchema.parse(req.query);
      res.json({ data: await service.listar(actor(req), query), error: null });
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

/** Guardar el borrador de un tipo (crea la version siguiente o la actualiza). */
inscripcionesRouter.post(
  '/documentos',
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = borradorDocumentoSchema.parse(req.body);
      res.json({ data: await service.guardarBorrador(actor(req), input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Publicar el borrador: desde aqui no cambia nunca. */
inscripcionesRouter.post(
  '/documentos/:id/publicar',
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      res.json({ data: await service.publicarDocumento(actor(req), id), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Descartar un borrador. Uno publicado no se borra. */
inscripcionesRouter.delete(
  '/documentos/:id',
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      await service.borrarBorrador(actor(req), id);
      res.json({ data: { doc_id: id }, error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Un paquete de ejemplo con lo guardado de los seis documentos, en PDF. */
inscripcionesRouter.post(
  '/documentos/ejemplo',
  requirePermission('inscripciones', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const pdf = await service.ejemploPaquete();
      res
        .status(200)
        .type('application/pdf')
        .set('Content-Disposition', 'inline; filename="inscripcion-ejemplo.pdf"')
        .send(pdf);
    } catch (err) {
      next(err);
    }
  },
);

/** Los documentos firmados de un representante (pantalla Representantes). */
inscripcionesRouter.get(
  '/representantes/:colId/documentos',
  requirePermission('inscripciones', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { colId: usuId } = colIdParamSchema.parse(req.params);
      res.json({ data: await service.documentosDeRepresentante(usuId), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /inscripciones/aviso — pendientes y si están abiertas, para el número
 * rojo del menú. Solo para quien aprueba; el menú solo repite la consulta
 * mientras están abiertas.
 */
inscripcionesRouter.get(
  '/aviso',
  requirePermission('inscripciones', 'editar'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.avisoDelMenu(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

inscripcionesRouter.get(
  '/estado',
  requirePermission('inscripciones', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.estado(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Interruptor general. Abiertas de verdad solo si además se cumplen las reglas (service.calcularEstado). */
inscripcionesRouter.put(
  '/estado',
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { abiertas } = abrirSchema.parse(req.body);
      res.json({ data: await service.abrirInscripciones(actor(req), abiertas), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Interruptor de un colegio. */
inscripcionesRouter.put(
  '/estado/colegios/:colId',
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { colId } = colIdParamSchema.parse(req.params);
      const { abiertas } = abrirSchema.parse(req.body);
      res.json({ data: await service.abrirColegio(actor(req), colId, abiertas), error: null });
    } catch (err) {
      next(err);
    }
  },
);

inscripcionesRouter.get(
  '/config',
  requirePermission('inscripciones', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.config(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Los datos de la cuenta a la que se transfiere el pago. */
inscripcionesRouter.put(
  '/config/cuenta-bancaria',
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { texto } = cuentaBancariaSchema.parse(req.body);
      await service.guardarCuentaBancaria(actor(req), texto);
      res.json({ data: { cuenta_bancaria: texto }, error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Cuántas disciplinas puede elegir cada alumno en el formulario público. */
inscripcionesRouter.put(
  '/config/max-disciplinas',
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { maximo } = maxDisciplinasSchema.parse(req.body);
      await service.guardarMaxDisciplinas(actor(req), maximo);
      res.json({ data: { max_disciplinas: maximo }, error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Membrete propio: PNG o JPEG en base64, hasta 700 KB. */
inscripcionesRouter.put(
  '/config/membrete',
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = membreteSchema.parse(req.body);
      await service.subirMembrete(actor(req), input);
      res.json({ data: { membrete_propio: true }, error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Vuelve al membrete de serie. */
inscripcionesRouter.delete(
  '/config/membrete',
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.restaurarMembrete(actor(req));
      res.json({ data: { membrete_propio: false }, error: null });
    } catch (err) {
      next(err);
    }
  },
);

inscripcionesRouter.get(
  '/precios',
  requirePermission('inscripciones', 'ver'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.precios(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

inscripcionesRouter.put(
  '/precios/:colId',
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { colId } = colIdParamSchema.parse(req.params);
      const input = precioSchema.parse(req.body);
      await service.guardarPrecio(actor(req), colId, input);
      res.json({ data: { col_id: colId }, error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** Quitar el precio: el colegio deja de ofrecerse en el formulario. */
inscripcionesRouter.delete(
  '/precios/:colId',
  requirePermission('inscripciones', 'editar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { colId } = colIdParamSchema.parse(req.params);
      await service.borrarPrecio(actor(req), colId);
      res.json({ data: { col_id: colId }, error: null });
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
      res.json({ data: await service.detalle(actor(req), id), error: null });
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
      const mismos = aprobarSchema.parse(req.body);
      res.json({ data: await service.aprobar(actor(req), id, mismos), error: null });
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
