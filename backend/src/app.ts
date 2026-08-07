import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { allowedOrigins, env } from './config/env.js';
import { ApiError, errorHandler, notFoundHandler } from './middleware/error.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter, meRouter } from './modules/auth/auth.routes.js';
import { usuariosRouter } from './modules/usuarios/usuarios.routes.js';
import { permisosRouter } from './modules/permisos/permisos.routes.js';
import { perfilRouter } from './modules/perfil/perfil.routes.js';

export function createApp(): Application {
  const app = express();

  // Railway corre detras de proxy: sin esto el rate limit ve una sola IP.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Sin origin: curl, health checks del propio Railway.
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        // ApiError, no Error: un Error pelado cae al catch-all del errorHandler
        // y devuelve 500 con ruido en los logs. Un origen no permitido es 403.
        callback(new ApiError(403, `Origen no permitido por CORS: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // Rutas versionadas.
  const api = express.Router();

  api.use(healthRouter);

  // El rate limit va despues de /health para no gastar cupo en los checks de Railway.
  api.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.NODE_ENV === 'production' ? 120 : 1000,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { data: null, error: { message: 'Demasiadas peticiones, intenta en un minuto' } },
    }),
  );

  // Autenticacion. Sus endpoints con contrasena traen su propio rate limit,
  // mas estricto que el general (ver auth.routes.ts).
  api.use('/auth', authRouter);
  api.use(meRouter);

  // Modulos de negocio (Fase 6 en adelante).
  api.use('/usuarios', usuariosRouter);
  api.use('/permisos', permisosRouter);
  api.use('/perfil', perfilRouter);

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
