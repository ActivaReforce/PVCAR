import { Router, type Request, type Response } from 'express';
import { env } from '../../config/env.js';
import { pingDb } from '../../config/db.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  let db: 'ok' | 'down' | 'not_configured' = 'not_configured';

  if (env.DATABASE_URL) {
    try {
      db = (await pingDb()) ? 'ok' : 'down';
    } catch {
      db = 'down';
    }
  }

  const healthy = db !== 'down';
  res.status(healthy ? 200 : 503).json({
    data: {
      status: healthy ? 'ok' : 'degraded',
      db,
      env: env.NODE_ENV,
      uptime: Math.round(process.uptime()),
    },
    error: null,
  });
});
