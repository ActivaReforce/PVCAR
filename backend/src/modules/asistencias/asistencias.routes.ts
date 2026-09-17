import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireAlgunPermiso, requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import {
  guardarAlumnosSchema,
  guardarEntrenadoresSchema,
  historialSchema,
  listaAlumnosSchema,
  listaEntrenadoresSchema,
} from './asistencias.schemas.js';
import * as service from './asistencias.service.js';

/**
 * Rutas de Asistencias.
 *
 * **Sobre los permisos.** En `rol_permiso` los dos modulos de asistencia solo
 * tienen la accion `ver`: nadie, en ningun rol, tiene `crear` ni `editar`
 * sobre ellos. Exigir `editar` para guardar dejaria el modulo inservible para
 * todo el mundo hasta que el cliente lo concediera desde Permisos.
 *
 * Asi que aqui `ver` habilita tambien el pase de lista, que es lo que la
 * pantalla siempre ha hecho, y lo que de verdad limita quien puede marcar a
 * quien es el **alcance** (lib/alcance.ts), que se comprueba en el servicio.
 * Queda anotado en `docs/fase11-asistencias.md` como decision a confirmar: si
 * el cliente quiere separar "consultar" de "pasar lista", se conceden las
 * acciones y se cambian estas dos lineas.
 */

export const asistenciasRouter = Router();

asistenciasRouter.use(requireAuth);

const VER_ALUMNOS: [string, string] = ['asistencias_estudiantes', 'ver'];
const VER_ENTRENADORES: [string, string] = ['asistencias_entrenadores', 'ver'];

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

/** Los cuatro estados. Catalogo fijo, lo usan las dos pantallas. */
asistenciasRouter.get(
  '/estados',
  requireAlgunPermiso(VER_ALUMNOS, VER_ENTRENADORES),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.estados(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * La fecha de hoy y la hora, en Ecuador y segun el servidor.
 *
 * Existe para que la pantalla no proponga la fecha del navegador: un telefono
 * con la zona horaria mal puesta abria la sesion del dia equivocado.
 */
asistenciasRouter.get(
  '/contexto',
  requireAlgunPermiso(VER_ALUMNOS, VER_ENTRENADORES),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await service.contexto(), error: null });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Alumnos

asistenciasRouter.get(
  '/alumnos',
  requirePermission(...VER_ALUMNOS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listaAlumnosSchema.parse(req.query);
      res.json({ data: await service.listaAlumnos(actor(req), query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** PUT y no POST: el lote es el estado completo de esa sesion ese dia. */
asistenciasRouter.put(
  '/alumnos',
  requirePermission(...VER_ALUMNOS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = guardarAlumnosSchema.parse(req.body);
      res.json({ data: await service.guardarAlumnos(actor(req), input), error: null });
    } catch (err) {
      next(err);
    }
  },
);

asistenciasRouter.get(
  '/historial',
  requirePermission(...VER_ALUMNOS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = historialSchema.parse(req.query);
      res.json({ data: await service.historial(actor(req), query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Entrenadores y auxiliares

asistenciasRouter.get(
  '/entrenadores',
  requirePermission(...VER_ENTRENADORES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listaEntrenadoresSchema.parse(req.query);
      res.json({ data: await service.listaEntrenadores(actor(req), query), error: null });
    } catch (err) {
      next(err);
    }
  },
);

asistenciasRouter.put(
  '/entrenadores',
  requirePermission(...VER_ENTRENADORES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = guardarEntrenadoresSchema.parse(req.body);
      res.json({ data: await service.guardarEntrenadores(actor(req), input), error: null });
    } catch (err) {
      next(err);
    }
  },
);
