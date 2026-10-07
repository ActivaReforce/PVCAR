import { z } from 'zod';

/**
 * Entrada del Tablero.
 *
 * Solo dos cosas: qué tablero se quiere ver y de qué periodo. Ninguna de las
 * dos existía en el sistema viejo — el tablero lo elegía el primer rol que
 * encontrara el código, y el periodo era "todo el histórico" sin decirlo.
 */

/** Los cuatro tableros. El id no es el `rol_id`: varios roles comparten tablero. */
export const TABLERO = {
  GENERAL: 'general',
  COORDINADOR: 'coordinador',
  ENTRENADOR: 'entrenador',
  REPRESENTANTE: 'representante',
} as const;

export type TableroId = (typeof TABLERO)[keyof typeof TABLERO];

const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser AAAA-MM-DD')
  .refine((texto) => {
    const d = new Date(`${texto}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
  }, 'Esa fecha no existe');

/**
 * El rango se limita a dos años. No es una restriccion de negocio: es que un
 * tablero es una foto de un periodo razonable, y sin tope alguien pediria
 * desde 1900 y el agregado recorreria la tabla entera cada minuto.
 */
export const tableroSchema = z
  .object({
    rol: z
      .enum([TABLERO.GENERAL, TABLERO.COORDINADOR, TABLERO.ENTRENADOR, TABLERO.REPRESENTANTE])
      .optional(),
    desde: fecha.optional(),
    hasta: fecha.optional(),
  })
  .refine((q) => !q.desde || !q.hasta || q.desde <= q.hasta, {
    path: ['desde'],
    message: 'La fecha inicial no puede ser posterior a la final',
  })
  .refine((q) => {
    if (!q.desde || !q.hasta) return true;
    return (Date.parse(q.hasta) - Date.parse(q.desde)) / 86_400_000 <= 730;
  }, 'El periodo no puede pasar de dos años');

export type TableroQuery = z.infer<typeof tableroSchema>;
