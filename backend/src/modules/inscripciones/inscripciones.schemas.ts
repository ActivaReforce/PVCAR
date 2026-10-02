import { z } from 'zod';
import { paginacionSchema } from '../../lib/paginacion.js';

/**
 * Validacion de Inscripciones (Fase 14B).
 *
 * El formulario es **publico**: todo lo que llega aqui lo escribio alguien
 * sin sesion. Por eso los limites son estrictos y no hay campo libre que no
 * tenga tope.
 *
 * Los campos son provisionales: el cliente todavia no cerro la lista exacta.
 * Se guardan en jsonb (`inscripcion.ins_representante`,
 * `inscripcion_nino.insnino_datos`), asi que cambiar la lista no pide
 * migracion; solo hay que tocar este archivo y el paso de aprobar.
 */

const texto = (min: number, max: number, mensaje: string) =>
  z.string().trim().min(min, mensaje).max(max);

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const correo = z.string().trim().toLowerCase().email('Correo invalido').max(160);

/**
 * Cedula o pasaporte. Es la contrasena inicial del representante, y Supabase
 * Auth pide al menos 6 caracteres: por eso el minimo es 6 y no 10.
 */
const cedulaRepresentante = z
  .string()
  .trim()
  .toUpperCase()
  .min(6, 'La cedula o pasaporte debe tener al menos 6 caracteres')
  .max(20)
  .regex(/^[0-9A-Z-]+$/, 'Solo numeros, letras y guiones');

const cedulaNino = z
  .string()
  .trim()
  .toUpperCase()
  .max(20)
  .regex(/^[0-9A-Z-]*$/, 'Solo numeros, letras y guiones')
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const telefono = z
  .string()
  .trim()
  .min(7, 'Telefono demasiado corto')
  .max(20)
  .regex(/^[0-9+\s()-]+$/, 'Telefono invalido');

/** AAAA-MM-DD, en el pasado y con una edad que tenga sentido (2 a 20 anos). */
const fechaNacimiento = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida')
  .refine((v) => {
    const fecha = new Date(`${v}T12:00:00Z`);
    if (Number.isNaN(fecha.getTime())) return false;
    const anos = (Date.now() - fecha.getTime()) / (365.25 * 24 * 3600 * 1000);
    return anos >= 2 && anos <= 20;
  }, 'La fecha de nacimiento no corresponde a un alumno');

export const PARENTESCOS = ['Padre', 'Madre', 'Tutor legal', 'Otro familiar'] as const;

export const representanteSchema = z.object({
  nombre: texto(3, 160, 'Escribe el nombre completo'),
  cedula: cedulaRepresentante,
  correo,
  telefono,
  sector_residencia: textoOpcional(160),
});

export type RepresentanteFormulario = z.infer<typeof representanteSchema>;

export const ninoSchema = z.object({
  nombre: texto(3, 160, 'Escribe el nombre completo del alumno'),
  fecha_nacimiento: fechaNacimiento,
  cedula: cedulaNino,
  col_id: z.number().int().positive(),
  catninograd_id: z.number().int().positive().nullable(),
  parentesco: z.enum(PARENTESCOS),
  toma_transporte: z.boolean(),
  info_salud: textoOpcional(1000),
  otra_info: textoOpcional(1000),
  disciplinas: z
    .array(z.number().int().positive())
    .min(1, 'Elige al menos una disciplina')
    .max(10)
    .refine((ids) => new Set(ids).size === ids.length, 'Disciplina repetida'),
});

export type NinoFormulario = z.infer<typeof ninoSchema>;

/**
 * El comprobante viaja en base64 dentro del JSON. El navegador lo comprime
 * antes; el tope de 2 MB es el del bucket. 2 MB en base64 son ~2,7 MB de
 * texto, por eso esta ruta lleva su propio limite de cuerpo (ver app.ts).
 */
const BYTES_MAX_COMPROBANTE = 2 * 1024 * 1024;

export const comprobanteSchema = z.object({
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  base64: z
    .string()
    .min(100, 'Falta el comprobante')
    .max(Math.ceil((BYTES_MAX_COMPROBANTE * 4) / 3) + 4, 'El comprobante pesa mas de 2 MB')
    .regex(/^[A-Za-z0-9+/]+=*$/, 'Comprobante ilegible'),
});

export const envioSchema = z.object({
  representante: representanteSchema,
  ninos: z.array(ninoSchema).min(1, 'Agrega al menos un alumno').max(8),
  /**
   * Las versiones que el representante tuvo delante. Si cambiaron mientras
   * llenaba el formulario, se rechaza: no puede aceptar un texto que no leyo.
   */
  documentos: z.object({
    contrato: z.number().int().positive(),
    terminos: z.number().int().positive(),
    privacidad: z.number().int().positive(),
  }),
  /** Las tres casillas. Tienen que venir en true; el schema no acepta otra cosa. */
  acepta: z.object({
    contrato: z.literal(true),
    terminos: z.literal(true),
    privacidad: z.literal(true),
  }),
  comprobante: comprobanteSchema,
});

export type EnvioInscripcion = z.infer<typeof envioSchema>;

// ---------------------------------------------------------------------------
// Modulo interno

export const listarSchema = paginacionSchema.extend({
  estado: z.enum(['pendiente', 'aprobada']).optional(),
  buscar: z.string().trim().max(160).optional(),
});

export type ListarInscripcionesQuery = z.infer<typeof listarSchema>;

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const rechazarSchema = z.object({
  /** El nombre del representante, escrito a mano: es un borrado permanente. */
  confirmacion: z.string().trim().min(1),
});

export const TIPOS_DOCUMENTO = ['contrato', 'terminos', 'privacidad'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

/** Guarda el borrador del tipo (lo crea o lo actualiza). Publicar es aparte. */
export const borradorDocumentoSchema = z.object({
  tipo: z.enum(TIPOS_DOCUMENTO),
  titulo: texto(3, 160, 'Escribe un titulo'),
  contenido: texto(20, 60_000, 'El texto es demasiado corto'),
});

export const colIdParamSchema = z.object({ colId: z.coerce.number().int().positive() });

/** Dolares con dos decimales como mucho; descuento en porcentaje. */
export const precioSchema = z.object({
  precio: z
    .number()
    .positive('El precio debe ser mayor que cero')
    .max(10_000)
    // Con tolerancia: 28.3 * 100 da 2830.0000000000005 en coma flotante.
    .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, 'Como mucho dos decimales'),
  descuento_hermano: z.number().min(0).max(100),
  descuento_solo_primera: z.boolean(),
});

/** Lo que el formulario manda para saber cuanto se paga antes de subir el comprobante. */
export const cotizacionSchema = z.object({
  ninos: z
    .array(
      z.object({
        col_id: z.number().int().positive(),
        disciplinas: z.array(z.number().int().positive()).min(1).max(10),
      }),
    )
    .min(1)
    .max(8),
});
