import { z } from 'zod';
import { paginacionSchema } from '../../lib/paginacion.js';
import { comprobanteSchema } from '../inscripciones/inscripciones.schemas.js';

/** Validación de Mensualidades (migración 0041). */

const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, 'Mes inválido');

export const pagarSchema = z.object({
  cuotas: z
    .array(z.object({ nino_id: z.number().int().positive(), mes }))
    .min(1, 'Elige al menos un mes para pagar')
    .max(60),
  /** Lo que vio en pantalla: si cambió mientras pagaba, se le avisa. */
  total: z.number().min(0),
  comprobante: comprobanteSchema,
});
export type PagarInput = z.infer<typeof pagarSchema>;

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const colIdParamSchema = z.object({ colId: z.coerce.number().int().positive() });

export const listarPagosSchema = paginacionSchema.extend({
  estado: z.enum(['pendiente', 'aprobado']).optional(),
  colegio: z.coerce.number().int().positive().optional(),
  buscar: z.string().trim().max(100).optional().transform((v) => v || undefined),
});
export type ListarPagosQuery = z.infer<typeof listarPagosSchema>;

export const rechazarPagoSchema = z.object({
  motivo: z.string().trim().min(1, 'Escribe el motivo').max(500),
});

export const cobroColegioSchema = z.object({
  meses: z.array(z.number().int().min(1).max(12)).max(12).transform((m) => [...new Set(m)].sort((a, b) => a - b)),
  desde: mes.nullable(),
  dia_limite: z.number().int().min(1).max(28),
  dia_corte: z.number().int().min(1).max(28),
});

export const mesQuerySchema = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes inválido').optional(),
  colegio: z.coerce.number().int().positive().optional(),
});
