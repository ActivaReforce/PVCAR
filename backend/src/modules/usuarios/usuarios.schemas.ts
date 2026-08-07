import { z } from 'zod';
import { paginacionSchema } from '../../lib/paginacion.js';

/**
 * Validacion de entrada del modulo de usuarios.
 * Regla del plan: ningun endpoint sin zod y sin chequeo de permisos.
 */

const nombre = z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120);

/**
 * El correo se normaliza aqui, no en la consulta: la tabla tiene un indice
 * unico sobre lower(trim(usu_correo)) y Supabase Auth guarda el correo en
 * minusculas. Sin normalizar, 'Juan@x.com' crearia un choque que solo
 * aparece al hacer el insert.
 */
const correo = z
  .string()
  .trim()
  .toLowerCase()
  .email('Correo invalido')
  .max(160);

const telefono = z
  .string()
  .trim()
  .max(30)
  .regex(/^[0-9+()\s-]*$/, 'El telefono solo admite numeros y los signos + ( ) -')
  .optional()
  .or(z.literal(''));

/**
 * 8 caracteres minimo. El sistema viejo no exigia nada y quedaron 7 cuentas
 * con contrasenas de 4 a 6 caracteres (Anexo A); esas se arrastran, pero las
 * nuevas no nacen asi.
 */
const password = z.string().min(8, 'La contrasena debe tener al menos 8 caracteres').max(72);

const roles = z
  .array(z.number().int().positive())
  .min(1, 'Debe seleccionar al menos un rol')
  .max(7)
  .refine((r) => new Set(r).size === r.length, 'Hay roles repetidos');

const cedula = z.string().trim().max(20).optional().or(z.literal(''));
const sectorResidencia = z.string().trim().max(160).optional().or(z.literal(''));

/** Ruta del objeto en el bucket usufoto. null borra la foto actual. */
const foto = z.string().trim().max(255).nullable().optional();

export const listarUsuariosSchema = paginacionSchema.extend({
  buscar: z.string().trim().max(120).optional(),
  rol: z.coerce.number().int().positive().optional(),
  estado: z.coerce.number().int().positive().optional(),
  orden: z.enum(['nombre', 'correo', 'creacion', 'estado']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

export type ListarUsuariosQuery = z.infer<typeof listarUsuariosSchema>;

export const crearUsuarioSchema = z.object({
  usu_nombre: nombre,
  usu_correo: correo,
  usu_telefono: telefono,
  password,
  roles,
  ent_cedula: cedula,
  padre_sector_residencia: sectorResidencia,
  usu_foto: foto,
});

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

/**
 * En la edicion todo es opcional menos lo que se manda. `roles` ausente
 * significa "no toques los roles"; `roles: []` no existe, lo rechaza el min(1).
 */
export const actualizarUsuarioSchema = z
  .object({
    usu_nombre: nombre.optional(),
    usu_correo: correo.optional(),
    usu_telefono: telefono,
    password: password.optional(),
    roles: roles.optional(),
    ent_cedula: cedula,
    padre_sector_residencia: sectorResidencia,
    usu_foto: foto,
  })
  .refine((v) => Object.keys(v).length > 0, 'No hay nada que actualizar');

export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;

/**
 * Borrado permanente. El cliente pidio (2026-08-07) que confirmar no sea un
 * clic: hay que escribir el nombre exacto. La comparacion se hace en el
 * servidor, porque si vive en el modal se la salta cualquiera.
 */
export const eliminarUsuarioSchema = z.object({
  confirmacion: z.string().trim().min(1, 'Escribe el nombre del usuario para confirmar'),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
