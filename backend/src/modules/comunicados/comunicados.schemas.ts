import { z } from 'zod';
import { MARCADOR } from './comunicados.html.js';
import { MAX_FILAS } from './comunicados.importar.js';

/** Lo que admite Resend por broadcast en el plan gratis. */
export const MAX_DESTINATARIOS = 1000;

const id = z.coerce.number().int().positive();
export const idParamSchema = z.object({ id });

const correo = z.string().trim().toLowerCase().email('Correo mal escrito').max(254);
const nombre = z.string().trim().max(120).default('');

// ---------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------

export const listarContactosSchema = z.object({
  buscar: z.string().trim().max(100).optional(),
  segmento: id.optional(),
});

export const contactoSchema = z.object({
  nombre,
  correo,
  /** Ya avisado de que es representante y quiere tenerlo también como contacto. */
  forzar: z.boolean().default(false),
});
export type ContactoInput = z.infer<typeof contactoSchema>;

export const idsSchema = z.object({ ids: z.array(id).min(1).max(MAX_FILAS) });

export const revisarImportacionSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  /** El archivo en base64. ~4 MB de archivo como mucho. */
  contenido: z.string().min(1).max(6_000_000),
});

export const importarSchema = z.object({
  filas: z.array(z.object({ nombre, correo })).min(1).max(MAX_FILAS),
  /** Segmento existente al que añadirlos, o uno nuevo con este nombre. */
  segmento: id.nullable().default(null),
  segmentoNuevo: z.string().trim().min(1).max(80).nullable().default(null),
});
export type ImportarInput = z.infer<typeof importarSchema>;

// ---------------------------------------------------------------------------
// Segmentos
// ---------------------------------------------------------------------------

export const segmentoSchema = z.object({ nombre: z.string().trim().min(1, 'Escribe un nombre').max(80) });

// ---------------------------------------------------------------------------
// Representantes (solo lectura)
// ---------------------------------------------------------------------------

export const filtroRepresentantesSchema = z.object({
  colegio: id.nullable().default(null),
  curso: id.nullable().default(null),
  disciplina: id.nullable().default(null),
});
export type FiltroRepresentantes = z.infer<typeof filtroRepresentantesSchema>;

export const listarRepresentantesSchema = z.object({
  colegio: id.optional(),
  curso: id.optional(),
  disciplina: id.optional(),
  buscar: z.string().trim().max(100).optional(),
});

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

export const plantillaSchema = z.object({
  nombre: z.string().trim().min(1, 'Escribe un nombre').max(80),
  html: z
    .string()
    .max(300_000, 'La plantilla es demasiado grande')
    .refine((h) => h.includes(MARCADOR), `Falta el marcador ${MARCADOR}: es donde va el texto del comunicado`),
});

// ---------------------------------------------------------------------------
// Comunicados
// ---------------------------------------------------------------------------

export const destinoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('contactos') }),
  z.object({ tipo: z.literal('segmento'), segmento: id }),
  z.object({ tipo: z.literal('representantes') }).merge(filtroRepresentantesSchema),
]);
export type Destino = z.infer<typeof destinoSchema>;

export const destinosSchema = z.array(destinoSchema).max(10, 'Como mucho 10 grupos');

export const contarSchema = z.object({ destinos: destinosSchema });

export const comunicadoSchema = z.object({
  asunto: z.string().trim().max(200).default(''),
  cuerpo: z.string().max(400_000, 'El correo es demasiado grande. ¿Hay una imagen pegada? Usa un enlace.').default(''),
  modo: z.enum(['visual', 'html']).default('visual'),
  plantilla: id.nullable().default(null),
  destinos: destinosSchema.default([]),
});
export type ComunicadoInput = z.infer<typeof comunicadoSchema>;

export const pruebaSchema = z.object({
  asunto: z.string().trim().min(1, 'Escribe el asunto').max(200),
  cuerpo: z.string().max(400_000),
  plantilla: id.nullable().default(null),
  correo,
});
export type PruebaInput = z.infer<typeof pruebaSchema>;
