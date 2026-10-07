import { z } from 'zod';
import { paginacionSchema } from '../../lib/paginacion.js';
import { TIPOS_DOCUMENTO, type TipoDocumento } from './inscripciones.documentos.js';

export { TIPOS_DOCUMENTO, type TipoDocumento };

/**
 * Validacion de Inscripciones (Fase 14B).
 *
 * El formulario es **publico**: todo lo que llega aqui lo escribio alguien
 * sin sesion. Por eso los limites son estrictos y no hay campo libre que no
 * tenga tope.
 *
 * Los campos son los de las fichas del cliente (Contratos/, 2026-10-05):
 * matricula (secciones A-D), datos medicos e imagen. Se guardan en jsonb
 * (`inscripcion.ins_representante`, `inscripcion_nino.insnino_datos`) como
 * copia fiel de lo enviado; al aprobar pasan a padre, nino y nino_contacto.
 */

const texto = (min: number, max: number, mensaje: string) =>
  z.string().trim().min(min, mensaje).max(max);

/** Vacío, ausente o null valen igual: se guarda null. */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const correo = z.string().trim().toLowerCase().email('Correo inválido').max(160);

/**
 * Cedula ecuatoriana: exactamente 10 numeros (decision del cliente,
 * 2026-10-05). Es la contrasena inicial del representante.
 */
const cedulaRepresentante = z
  .string()
  .trim()
  .regex(/^\d{10}$/, 'La cédula debe tener 10 números');

/** Solo numeros (decision del cliente, 2026-10-05). */
const telefono = z
  .string()
  .trim()
  .regex(/^\d{7,15}$/, 'El teléfono solo lleva números (entre 7 y 15)');

/** AAAA-MM-DD, en el pasado y con una edad que tenga sentido (2 a 20 anos). */
const fechaNacimiento = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .refine((v) => {
    const fecha = new Date(`${v}T12:00:00Z`);
    if (Number.isNaN(fecha.getTime())) return false;
    const anos = (Date.now() - fecha.getTime()) / (365.25 * 24 * 3600 * 1000);
    return anos >= 2 && anos <= 20;
  }, 'La fecha de nacimiento no corresponde a un alumno');

export const PARENTESCOS = ['Padre', 'Madre', 'Tutor legal', 'Otro familiar'] as const;

/** Cédula o RUC para la factura: 10 o 13 dígitos en Ecuador; se admite pasaporte. */
const identificacionFactura = z
  .string()
  .trim()
  .toUpperCase()
  .min(6, 'La cédula o RUC de la factura debe tener al menos 6 caracteres')
  .max(20)
  .regex(/^[0-9A-Z-]+$/, 'Solo números, letras y guiones');

/**
 * Ficha de matrícula, sección A. La cédula y el correo de arriba son los de
 * la cuenta (la cédula es la contraseña inicial); los de factura pueden ser
 * de otra persona o empresa.
 */
export const representanteSchema = z.object({
  nombre: texto(3, 160, 'Escribe el nombre completo'),
  cedula: cedulaRepresentante,
  correo,
  telefono,
  factura: z.object({
    nombre: texto(3, 160, 'Escribe el nombre para la factura'),
    identificacion: identificacionFactura,
    correo,
    direccion: texto(5, 300, 'Escribe la dirección para la factura'),
  }),
});

export type RepresentanteFormulario = z.infer<typeof representanteSchema>;

const persona = {
  nombre: texto(3, 160, 'Escribe el nombre completo'),
  relacion: texto(2, 60, 'Indica la relación con el menor'),
  telefono,
};

export const ninoSchema = z
  .object({
    nombre: texto(3, 160, 'Escribe el nombre completo del alumno'),
    fecha_nacimiento: fechaNacimiento,
    col_id: z.number().int().positive(),
    /** "Curso" en la ficha. */
    catninograd_id: z.number().int().positive(),
    parentesco: z.enum(PARENTESCOS),
    disciplinas: z
      .array(z.number().int().positive())
      .min(1, 'Elige al menos una disciplina')
      .max(10)
      .refine((ids) => new Set(ids).size === ids.length, 'Disciplina repetida'),
    /** Ficha, sección C. */
    emergencia: z.object(persona),
    /**
     * Ficha, sección D: una sola persona autorizada. Puede ser el propio
     * representante (el formulario la llena con sus datos) o nadie: no es
     * obligatoria (decisión del cliente, 2026-10-05).
     */
    retiro: z
      .object({ ...persona, cedula: identificacionFactura })
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    modalidad_salida: z.enum(['escolar', 'privado']),
    detalle_retiro: textoOpcional(500),
    /** Ficha de datos médicos. */
    salud: z.object({
      tiene: z.boolean(),
      detalle: textoOpcional(1000),
      /** Obligatoria, conteste Sí o No (decisión del cliente, 2026-10-05). */
      autoriza: z.literal(true, {
        errorMap: () => ({ message: 'Hay que autorizar el tratamiento de la información de salud' }),
      }),
    }),
    /** Ficha de uso de imagen: tres permisos opcionales e independientes. */
    imagen: z.object({
      familias: z.boolean(),
      redes: z.boolean(),
      promocional: z.boolean(),
    }),
  })
  .refine((n) => !n.salud.tiene || (n.salud.detalle !== null && n.salud.detalle.length > 0), {
    message: 'Si hay alguna condición de salud, especifícala',
    path: ['salud', 'detalle'],
  })
  // Si contestó No, lo que hubiera escrito en "Especifique" no se guarda.
  .transform((n) => ({
    ...n,
    salud: { ...n.salud, detalle: n.salud.tiene ? n.salud.detalle : null },
  }));

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
    .max(Math.ceil((BYTES_MAX_COMPROBANTE * 4) / 3) + 4, 'El comprobante pesa más de 2 MB')
    .regex(/^[A-Za-z0-9+/]+=*$/, 'Comprobante ilegible'),
});

export const envioSchema = z.object({
  representante: representanteSchema,
  ninos: z.array(ninoSchema).min(1, 'Agrega al menos un alumno').max(8),
  /**
   * Las versiones que el representante tuvo delante (doc_id de cada tipo).
   * Si cambiaron mientras llenaba el formulario, se rechaza: no puede
   * aceptar un texto que no leyó.
   */
  documentos: z.object(
    Object.fromEntries(TIPOS_DOCUMENTO.map((t) => [t, z.number().int().positive()])) as Record<
      TipoDocumento,
      z.ZodNumber
    >,
  ),
  /**
   * Una casilla por documento. En la autorización de datos es su propia
   * casilla; en los demás, "He leído y acepto". Todas en true.
   */
  acepta: z.object(
    Object.fromEntries(TIPOS_DOCUMENTO.map((t) => [t, z.literal(true)])) as Record<
      TipoDocumento,
      z.ZodLiteral<true>
    >,
  ),
  comprobante: comprobanteSchema,
});

export type EnvioInscripcion = z.infer<typeof envioSchema>;

const SECCION: Record<string, string> = {
  representante: 'Tus datos',
  factura: 'Facturación',
  emergencia: 'Contacto de emergencia',
  retiro: 'Retiro del menor',
  salud: 'Información de salud',
  imagen: 'Uso de imagen',
  comprobante: 'Pago',
  documentos: 'Documentos',
  acepta: 'Documentos',
};

const CAMPO: Record<string, string> = {
  nombre: 'nombre',
  cedula: 'cédula',
  correo: 'correo',
  telefono: 'teléfono',
  direccion: 'dirección',
  identificacion: 'cédula o RUC',
  relacion: 'relación con el menor',
  fecha_nacimiento: 'fecha de nacimiento',
  catninograd_id: 'curso',
  col_id: 'colegio',
  parentesco: 'parentesco',
  disciplinas: 'disciplinas',
  modalidad_salida: 'modalidad de salida',
  detalle_retiro: 'detalle del recorrido',
  detalle: 'especifique',
  autoriza: 'autorización',
  base64: 'imagen del comprobante',
  mime: 'tipo de imagen',
};

/**
 * Lo que falló al validar un envío, en frases que entiende quien llena el
 * formulario: "Alumno 1 · Información de salud: falta la autorización".
 * Los mensajes propios ya están en castellano; los de zod por defecto (tipo
 * equivocado, campo que falta) se cambian por uno genérico con el campo.
 */
export function problemasDeEnvio(err: z.ZodError): string[] {
  const frases = err.issues.map((i) => {
    const partes: string[] = [];
    let campo: string | null = null;
    for (const [n, trozo] of i.path.entries()) {
      if (trozo === 'ninos' && typeof i.path[n + 1] === 'number') {
        partes.push(`Alumno ${(i.path[n + 1] as number) + 1}`);
      } else if (typeof trozo === 'string' && SECCION[trozo]) {
        partes.push(SECCION[trozo]!);
      } else if (typeof trozo === 'string' && CAMPO[trozo]) {
        campo = CAMPO[trozo]!;
      }
    }
    const propio = i.code === 'custom' || i.code === 'invalid_string' || i.code === 'too_small';
    const mensaje = propio && !/^(String|Number|Array|Expected|Required|Invalid)/.test(i.message)
      ? i.message
      : campo
        ? `revisa el campo "${campo}"`
        : 'hay un dato que falta o no es válido';
    const donde = partes.length > 0 ? `${[...new Set(partes)].join(' · ')}: ` : '';
    return `${donde}${mensaje}`;
  });
  return [...new Set(frases)];
}

// ---------------------------------------------------------------------------
// Modulo interno

export const listarSchema = paginacionSchema.extend({
  estado: z.enum(['pendiente', 'aprobada']).optional(),
  buscar: z.string().trim().max(160).optional(),
  /** Solo las que traen algún alumno de este colegio. */
  colegio: z.coerce.number().int().positive().optional(),
});

export type ListarInscripcionesQuery = z.infer<typeof listarSchema>;

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const rechazarSchema = z.object({
  /** El nombre del representante, escrito a mano: es un borrado permanente. */
  confirmacion: z.string().trim().min(1),
});

/** Guarda el borrador del tipo (lo crea o lo actualiza). Publicar es aparte. */
export const borradorDocumentoSchema = z.object({
  tipo: z.enum(TIPOS_DOCUMENTO),
  titulo: texto(3, 160, 'Escribe un título'),
  contenido: texto(20, 60_000, 'El texto es demasiado corto'),
});

export const abrirSchema = z.object({ abiertas: z.boolean() });

/** Texto libre con saltos de línea. Vacío lo borra. */
export const cuentaBancariaSchema = z.object({
  texto: z
    .string()
    .max(2000, 'Como mucho 2000 caracteres')
    .transform((v) => v.replace(/\r\n/g, '\n').trim())
    .transform((v) => (v.length > 0 ? v : null)),
});

/** Tope de disciplinas por alumno en el formulario público (1 a 10). */
export const maxDisciplinasSchema = z.object({ maximo: z.number().int().min(1).max(10) });

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
  /** Los datos del colegio que llevan la ficha y el contrato. */
  sede: texto(3, 160, 'Escribe el nombre de la sede'),
  sede_corta: texto(2, 80, 'Escribe el nombre corto de la sede'),
  institucion: texto(2, 80, 'Escribe cómo se nombra a la institución'),
  minimo_alumnos: z.number().int().min(1).max(200),
});

/** El membrete viaja en base64. 700 KB caben en el límite de 1 MB del cuerpo. */
export const BYTES_MAX_MEMBRETE = 700 * 1024;
export const membreteSchema = z.object({
  mime: z.enum(['image/jpeg', 'image/png']),
  base64: z
    .string()
    .min(100)
    .max(Math.ceil((BYTES_MAX_MEMBRETE * 4) / 3) + 4, 'El membrete pesa más de 700 KB')
    .regex(/^[A-Za-z0-9+/]+=*$/, 'Imagen ilegible'),
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
