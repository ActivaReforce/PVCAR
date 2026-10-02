import { z } from 'zod';

/**
 * Entrada de Data anterior.
 *
 * Los ids que llegan aquí son del esquema `archivo`, no de `public`: el
 * frontend los saca de `GET /historico/opciones`, nunca de las listas del resto
 * del sistema.
 */

const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser AAAA-MM-DD')
  .refine((texto) => {
    const d = new Date(`${texto}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
  }, 'Esa fecha no existe');

const id = z.coerce.number().int().positive().optional();

const rangoValido = (f: { desde?: string; hasta?: string }) => !f.desde || !f.hasta || f.desde <= f.hasta;
const errorRango = { path: ['desde'], message: 'La fecha inicial no puede ser posterior a la final' };

export const filtrosSchema = z
  .object({
    buscar: z.string().trim().max(160).optional(),
    colegio: id,
    actividad: id,
    entrenador: id,
    estado: id,
    asistencia: id,
    rol: id,
    desde: fecha.optional(),
    hasta: fecha.optional(),
  })
  .refine(rangoValido, errorRango);

export type FiltrosQuery = z.infer<typeof filtrosSchema>;

/** El orden se valida contra las columnas del conjunto en el servicio. */
const orden = z.object({
  orden: z.string().trim().max(60).optional(),
  dir: z.enum(['asc', 'desc']).default('asc'),
});

export const consultaSchema = filtrosSchema.and(orden).and(
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
);

export type ConsultaQuery = z.infer<typeof consultaSchema>;

export const exportacionSchema = filtrosSchema.and(orden);

export type ExportacionBody = z.infer<typeof exportacionSchema>;

export const resumenSchema = z
  .object({ colegio: id, desde: fecha.optional(), hasta: fecha.optional() })
  .refine(rangoValido, errorRango);

export const idParamSchema = z.object({ id: z.string().trim().min(1).max(60) });
