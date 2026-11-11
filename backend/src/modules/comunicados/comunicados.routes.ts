import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as repo from './comunicados.repository.js';
import * as service from './comunicados.service.js';
import {
  comunicadoSchema,
  contactoSchema,
  contarSchema,
  idParamSchema,
  idsSchema,
  importarSchema,
  listarContactosSchema,
  listarRepresentantesSchema,
  plantillaSchema,
  pruebaSchema,
  revisarImportacionSchema,
  segmentoSchema,
} from './comunicados.schemas.js';

/**
 * Comunicados (2026-11-11). Todo detrás de "solo el rol Propietario".
 * Diseño en docs/comunicados.md.
 */

export const comunicadosRouter = Router();

comunicadosRouter.use(requireAuth);
comunicadosRouter.use((req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, 'No autenticado');
    service.exigirPropietario(req.user);
    next();
  } catch (err) {
    next(err);
  }
});

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

type Manejador = (req: Request) => Promise<unknown>;

/** Envoltorio común: { data, error } y los errores al errorHandler. */
const r =
  (fn: Manejador) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ data: await fn(req), error: null });
    } catch (err) {
      next(err);
    }
  };

const idDe = (req: Request) => idParamSchema.parse(req.params).id;

// --- Opciones para los filtros (colegios, cursos, disciplinas) ---
comunicadosRouter.get('/opciones', r(() => repo.opciones()));

// --- Contactos ---
comunicadosRouter.get(
  '/contactos',
  r(async (req) => {
    const q = listarContactosSchema.parse(req.query);
    return service.listarContactos(q.buscar, q.segmento);
  }),
);
comunicadosRouter.post('/contactos', r((req) => service.crearContacto(actor(req), contactoSchema.parse(req.body))));
comunicadosRouter.put(
  '/contactos/:id',
  r((req) => service.editarContacto(actor(req), idDe(req), contactoSchema.parse(req.body))),
);
comunicadosRouter.post(
  '/contactos/borrar',
  r((req) => service.borrarContactos(actor(req), idsSchema.parse(req.body).ids)),
);
comunicadosRouter.post(
  '/contactos/importar/revisar',
  r(async (req) => {
    const { nombre, contenido } = revisarImportacionSchema.parse(req.body);
    return service.revisarImportacion(nombre, contenido);
  }),
);
comunicadosRouter.post(
  '/contactos/importar',
  r((req) => service.importar(actor(req), importarSchema.parse(req.body))),
);

// --- Segmentos ---
comunicadosRouter.get('/segmentos', r(() => repo.listarSegmentos()));
comunicadosRouter.post(
  '/segmentos',
  r((req) => service.crearSegmento(actor(req), segmentoSchema.parse(req.body).nombre)),
);
comunicadosRouter.put(
  '/segmentos/:id',
  r((req) => service.renombrarSegmento(actor(req), idDe(req), segmentoSchema.parse(req.body).nombre)),
);
comunicadosRouter.delete('/segmentos/:id', r((req) => service.borrarSegmento(actor(req), idDe(req))));
comunicadosRouter.post(
  '/segmentos/:id/anadir',
  r((req) => service.anadirASegmento(idDe(req), idsSchema.parse(req.body).ids)),
);
comunicadosRouter.post(
  '/segmentos/:id/quitar',
  r((req) => service.quitarDeSegmento(idDe(req), idsSchema.parse(req.body).ids)),
);

// --- Representantes (solo lectura) ---
comunicadosRouter.get(
  '/representantes',
  r(async (req) => {
    const q = listarRepresentantesSchema.parse(req.query);
    return repo.listarRepresentantes(
      { colegio: q.colegio ?? null, curso: q.curso ?? null, disciplina: q.disciplina ?? null },
      q.buscar && q.buscar.length > 0 ? q.buscar : null,
    );
  }),
);

// --- Plantillas ---
comunicadosRouter.get('/plantillas', r(() => repo.listarPlantillas()));
comunicadosRouter.post(
  '/plantillas',
  r(async (req) => {
    const p = plantillaSchema.parse(req.body);
    return service.crearPlantilla(actor(req), p.nombre, p.html);
  }),
);
comunicadosRouter.put(
  '/plantillas/:id',
  r(async (req) => {
    const p = plantillaSchema.parse(req.body);
    return service.editarPlantilla(actor(req), idDe(req), p.nombre, p.html);
  }),
);
comunicadosRouter.delete('/plantillas/:id', r((req) => service.borrarPlantilla(actor(req), idDe(req))));

// --- Comunicados ---
comunicadosRouter.post('/contar', r((req) => service.contar(contarSchema.parse(req.body).destinos)));
comunicadosRouter.post('/prueba', r((req) => service.prueba(pruebaSchema.parse(req.body))));
comunicadosRouter.get('/', r(() => service.listar()));
comunicadosRouter.post('/', r((req) => service.crear(actor(req), comunicadoSchema.parse(req.body))));
comunicadosRouter.get('/:id', r((req) => service.obtener(idDe(req))));
comunicadosRouter.put('/:id', r((req) => service.editar(idDe(req), comunicadoSchema.parse(req.body))));
comunicadosRouter.delete('/:id', r((req) => service.borrar(actor(req), idDe(req))));
comunicadosRouter.post('/:id/enviar', r((req) => service.enviar(actor(req), idDe(req))));
