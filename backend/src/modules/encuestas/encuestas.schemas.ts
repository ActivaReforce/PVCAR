import { z } from 'zod';

/**
 * Validacion de entrada de Encuestas.
 *
 * El modulo se estrena vacio —**0 filas en produccion**, comprobado en los tres
 * respaldos— asi que aqui no hay que respetar ninguna deriva heredada: las
 * reglas se escriben como deberian ser.
 */

/** Los seis tipos de `encuesta_tipo_respuesta`. */
export const TIPO = {
  TEXTO_CORTO: 1,
  TEXTO_LARGO: 2,
  ESCALA: 3,
  FECHA: 4,
  HORA: 5,
  SI_NO: 6,
} as const;

export type TipoId = (typeof TIPO)[keyof typeof TIPO];

/**
 * Una pregunta.
 *
 * El `superRefine` es la misma regla que el CHECK `ck_pregunta_escala` de la
 * migracion 0012: los limites solo van con el tipo Escala, y con el tipo Escala
 * son obligatorios. Dos capas — esta da un mensaje util y la de la base impide
 * que nadie se la salte.
 */
export const preguntaSchema = z
  .object({
    /** Presente al editar una pregunta que ya existe. */
    encupreg_id: z.number().int().positive().optional(),
    encupreg_pregunta: z.string().trim().min(3, 'La pregunta es muy corta').max(500),
    encupreg_nota: z.string().trim().max(500).optional().or(z.literal('')),
    encutiporesp_id: z
      .number()
      .int()
      .refine((v) => (Object.values(TIPO) as number[]).includes(v), 'Tipo de respuesta desconocido'),
    encupreg_escala_min: z.number().int().min(0).max(100).nullable().optional(),
    encupreg_escala_max: z.number().int().min(1).max(100).nullable().optional(),
  })
  .superRefine((p, ctx) => {
    const tieneLimites =
      p.encupreg_escala_min !== null &&
      p.encupreg_escala_min !== undefined &&
      p.encupreg_escala_max !== null &&
      p.encupreg_escala_max !== undefined;

    if (p.encutiporesp_id === TIPO.ESCALA) {
      if (!tieneLimites) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['encupreg_escala_max'],
          message: `"${p.encupreg_pregunta}" es de escala: necesita minimo y maximo`,
        });
      } else if (p.encupreg_escala_max! <= p.encupreg_escala_min!) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['encupreg_escala_max'],
          message: 'El maximo de la escala tiene que ser mayor que el minimo',
        });
      }
    } else if (tieneLimites) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['encupreg_escala_min'],
        message: 'Solo las preguntas de escala llevan minimo y maximo',
      });
    }
  });

export type PreguntaInput = z.infer<typeof preguntaSchema>;

const titulo = z.string().trim().min(3, 'El titulo debe tener al menos 3 caracteres').max(200);

export const listarEncuestasSchema = z.object({
  buscar: z.string().trim().max(160).optional(),
  estado: z.coerce.number().int().positive().optional(),
});

export const crearEncuestaSchema = z.object({
  encu_titulo: titulo,
  encu_descripcion: z.string().trim().max(1000).optional().or(z.literal('')),
  preguntas: z.array(preguntaSchema).max(50).optional(),
});

export const actualizarEncuestaSchema = z
  .object({
    encu_titulo: titulo.optional(),
    encu_descripcion: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  .refine((v) => Object.keys(v).length > 0, 'No hay nada que actualizar');

/**
 * La lista completa de preguntas, **en el orden en que llegan**.
 *
 * El orden no viaja como un campo: es la posicion en el array. Asi no puede
 * llegar un orden repetido —lo impide el indice unico `uq_pregunta_orden`— ni
 * un hueco en la numeracion, que es justo lo que pasaba cuando el navegador
 * calculaba el orden al reordenar.
 */
export const preguntasSchema = z.object({
  preguntas: z
    .array(preguntaSchema)
    .min(1, 'Una encuesta necesita al menos una pregunta')
    .max(50),
});

export const eliminarEncuestaSchema = z.object({
  confirmacion: z.string().trim().min(1, 'Escribe el titulo de la encuesta para confirmar'),
});

/**
 * Las respuestas de un representante.
 *
 * Una por pregunta, y cada una con **el campo que corresponde a su tipo**. Que
 * el valor case con el tipo lo comprueba el servicio, que es quien conoce las
 * preguntas.
 */
export const responderSchema = z.object({
  respuestas: z
    .array(
      z.object({
        encupreg_id: z.number().int().positive(),
        texto: z.string().trim().max(2000).nullable().optional(),
        numero: z.number().nullable().optional(),
        fecha: z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser AAAA-MM-DD')
          .nullable()
          .optional(),
        hora: z
          .string()
          .trim()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe ser HH:MM')
          .nullable()
          .optional(),
        sino: z.boolean().nullable().optional(),
      }),
    )
    .min(1, 'No hay nada que responder')
    .max(50)
    .refine(
      (rs) => new Set(rs.map((r) => r.encupreg_id)).size === rs.length,
      'Hay una pregunta respondida dos veces',
    ),
});

export type ResponderInput = z.infer<typeof responderSchema>;

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
