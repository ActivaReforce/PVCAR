import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { readBearer, requireAuth } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import { changePasswordSchema, forgotPasswordSchema, loginSchema } from './auth.schemas.js';
import * as service from './auth.service.js';

/**
 * Limite propio para los endpoints que manejan contrasenas.
 * El limite general del API (120/min) no sirve contra fuerza bruta: 120
 * intentos de contrasena por minuto son muchos.
 *
 * La clave es IP + correo, no solo una de las dos:
 *   - Solo IP: un colegio entero sale por la misma IP y los errores de uno
 *     dejarian fuera a sus companeros.
 *   - Solo correo: cualquiera podria bloquear la cuenta de otro a proposito
 *     gastandole el cupo desde fuera.
 * Los intentos correctos no gastan cupo: al que acierta no se le castiga.
 */
const credencialesLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    // En change-password el limiter va despues de requireAuth y ya hay
    // usuario resuelto; en login y forgot-password solo hay correo en el body.
    if (req.user) {
      return `${req.ip ?? 'sin-ip'}|${req.user.authUserId}`;
    }
    const body = req.body as { email?: unknown } | undefined;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    return `${req.ip ?? 'sin-ip'}|${email}`;
  },
  message: {
    data: null,
    error: { message: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' },
  },
});

export const authRouter = Router();

/** POST /api/v1/auth/login — devuelve sesion + usuario + roles + permisos. */
authRouter.post(
  '/login',
  credencialesLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await service.login(email, password);
      res.json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /api/v1/auth/logout — revoca todas las sesiones del usuario. */
authRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.logout(readBearer(req));
    res.json({ data: { ok: true }, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/forgot-password — manda el correo de recuperacion.
 * Responde 202 siempre, exista o no el correo. Ver auth.service.
 */
authRouter.post(
  '/forgot-password',
  credencialesLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      await service.forgotPassword(email);
      res.status(202).json({
        data: { mensaje: 'Si el correo esta registrado, recibiras un enlace para cambiar tu contrasena.' },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /api/v1/auth/change-password — exige la contrasena actual. */
authRouter.post(
  '/change-password',
  requireAuth,
  credencialesLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'No autenticado');
      }
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      await service.changePassword(
        req.user.authUserId,
        req.user.usuario.usu_correo,
        currentPassword,
        newPassword,
      );
      res.json({ data: { ok: true }, error: null });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/me — usuario de dominio, roles y permisos del token.
 * Router aparte porque no cuelga de /auth. Es la fuente de verdad del
 * AuthContext al recargar la pagina: el navegador guarda la sesion, nunca
 * los permisos.
 */
export const meRouter = Router();

meRouter.get('/me', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    next(new ApiError(401, 'No autenticado'));
    return;
  }
  res.json({ data: req.user.usuario, error: null });
});
