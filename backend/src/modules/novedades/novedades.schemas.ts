import { z } from 'zod';

export const TIPOS = ['general', 'personal', 'alumno'] as const;

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listarSchema = z.object({
  tipo: z.enum(TIPOS).optional(),
  autor: z.coerce.number().int().positive().optional(),
  persona: z.coerce.number().int().positive().optional(),
  alumno: z.coerce.number().int().positive().optional(),
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  buscar: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type FiltrosListar = z.infer<typeof listarSchema>;

const texto = z
  .string()
  .trim()
  .min(1, 'Escribe algo')
  .max(1000, 'Máximo 1000 caracteres');

export const crearSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('general'),
    texto,
  }),
  z.object({
    tipo: z.literal('personal'),
    texto,
    usu_ids: z
      .array(z.number().int().positive())
      .min(1, 'Elige al menos a una persona')
      .max(50)
      .transform((xs) => [...new Set(xs)]),
  }),
  z.object({
    tipo: z.literal('alumno'),
    texto,
    nino_ids: z
      .array(z.number().int().positive())
      .min(1, 'Elige al menos a un alumno')
      .max(50)
      .transform((xs) => [...new Set(xs)]),
  }),
]);

export type CrearInput = z.infer<typeof crearSchema>;

export const buscarSchema = z.object({
  buscar: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
