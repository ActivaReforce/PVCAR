import { z } from 'zod';
import { paginacionSchema } from '../../lib/paginacion.js';

/**
 * Validacion de entrada del modulo de Colegios.
 *
 * El formulario viejo validaba en el navegador con zod y despues escribia
 * directo en la tabla con la anon key: la validacion era una cortesia, no una
 * puerta. Aqui es la puerta.
 */

const nombre = z
  .string()
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres')
  .max(160);

const direccion = z
  .string()
  .trim()
  .min(3, 'La direccion debe tener al menos 3 caracteres')
  .max(255);

/** Los datos del contacto del colegio son opcionales: no todos los tienen. */
const textoOpcional = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

const correoOpcional = z
  .union([z.string().trim().toLowerCase().email('Correo invalido').max(160), z.literal('')])
  .optional();

const telefonoOpcional = z
  .string()
  .trim()
  .max(30)
  .regex(/^[0-9+()\s-]*$/, 'El telefono solo admite numeros y los signos + ( ) -')
  .optional()
  .or(z.literal(''));

/** Ruta del objeto en el bucket usufoto. null borra la foto actual. */
const foto = z.string().trim().max(255).nullable().optional();

/** Ids de usuario que coordinan el colegio. Lista completa, no incremental. */
const coordinadores = z
  .array(z.number().int().positive())
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length, 'Hay coordinadores repetidos');

export const listarColegiosSchema = paginacionSchema.extend({
  buscar: z.string().trim().max(160).optional(),
  orden: z.enum(['nombre', 'creacion', 'disciplinas', 'estudiantes']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

export type ListarColegiosQuery = z.infer<typeof listarColegiosSchema>;

export const crearColegioSchema = z.object({
  col_nombre: nombre,
  col_direccion: direccion,
  col_rep_nombre: textoOpcional(160),
  col_rep_telefono: telefonoOpcional,
  col_rep_email: correoOpcional,
  col_rep_foto: foto,
  coordinadores: coordinadores.optional(),
});

export type CrearColegioInput = z.infer<typeof crearColegioSchema>;

export const actualizarColegioSchema = z
  .object({
    col_nombre: nombre.optional(),
    col_direccion: direccion.optional(),
    col_rep_nombre: textoOpcional(160),
    col_rep_telefono: telefonoOpcional,
    col_rep_email: correoOpcional,
    col_rep_foto: foto,
    coordinadores: coordinadores.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'No hay nada que actualizar');

export type ActualizarColegioInput = z.infer<typeof actualizarColegioSchema>;

export const coordinadoresSchema = z.object({ coordinadores });

/**
 * Igual que en Usuarios: borrar exige escribir el nombre, y se comprueba en el
 * servidor. El cliente lo pidio asi el 2026-08-07 — un clic de mas no puede
 * llevarse un colegio con su historial.
 */
export const eliminarColegioSchema = z.object({
  confirmacion: z.string().trim().min(1, 'Escribe el nombre del colegio para confirmar'),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
