import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/** Error de dominio con status HTTP explicito. */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ data: null, error: { message: 'Recurso no encontrado' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      data: null,
      error: { message: 'Validacion fallida', details: err.flatten() },
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      data: null,
      error: { message: err.message, details: err.details },
    });
    return;
  }

  // Errores de body-parser (cuerpo demasiado grande, JSON mal formado). Traen
  // su propio status 4xx; sin esto caian al 500 de abajo como fallo interno.
  const { status, type } = (err ?? {}) as { status?: unknown; type?: unknown };
  if (typeof type === 'string' && typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({
      data: null,
      error: {
        message: status === 413 ? 'El contenido enviado es demasiado grande' : 'Peticion mal formada',
      },
    });
    return;
  }

  console.error('Error no manejado:', err);
  res.status(500).json({ data: null, error: { message: 'Error interno del servidor' } });
}
