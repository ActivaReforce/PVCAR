import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { allowedOrigins, env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { healthRouter } from './modules/health/health.routes.js';

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
        callback(new Error(`Origen no permitido por CORS: ${origin}`));
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

  // Aqui se montan los modulos: api.use('/usuarios', usuariosRouter), etc.

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
