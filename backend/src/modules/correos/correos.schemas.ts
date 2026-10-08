import { z } from 'zod';
import { TIPOS_CORREO } from './correos.repository.js';

export const tipoParamSchema = z.object({ tipo: z.enum(TIPOS_CORREO) });

const correo = z.string().trim().toLowerCase().email('Hay un correo mal escrito').max(254);

export const configCorreoSchema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre del remitente').max(80),
  /** Solo lo de antes de la arroba: el dominio lo pone el servidor. */
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/, 'Solo letras, números, punto, guion y guion bajo, sin @'),
  /** Solo cuenta en los avisos internos; en el resto se guarda vacio. */
  para: z
    .array(correo)
    .max(10, 'Como mucho 10 destinatarios')
    .default([])
    .transform((lista) => [...new Set(lista)]),
  cc: z
    .array(correo)
    .max(10, 'Como mucho 10 correos en copia')
    .transform((lista) => [...new Set(lista)]),
  responder_a: correo.nullable().or(z.literal('').transform(() => null)),
});

export type ConfigCorreoInput = z.infer<typeof configCorreoSchema>;
