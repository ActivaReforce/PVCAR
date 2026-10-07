import { z } from 'zod';
import { paginacionSchema } from '../../lib/paginacion.js';
import { METODO } from './evaluaciones.scoring.js';

/**
 * Validacion de entrada de Evaluaciones.
 *
 * El modulo con mas reglas de negocio del sistema. Casi todo lo que aqui se
 * valida estaba antes en el navegador o en ningun sitio: en produccion hay 5
 * evaluaciones, 1 261 pendientes y **un solo intento registrado**, asi que el
 * modulo se ha usado poquisimo y sus huecos nunca se han notado.
 */

const titulo = z.string().trim().min(3, 'El titulo debe tener al menos 3 caracteres').max(160);
const textoOpcional = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

const operador = z.enum(['<', '<=', '>', '>='], {
  errorMap: () => ({ message: 'El operador debe ser <, <=, > o >=' }),
});

const bandera = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1');

// ---------------------------------------------------------------------------
// Parametros

/**
 * Los umbrales de un parametro por tiempo.
 *
 * El CHECK `evaluacion_tiempo_rangos_check` del esquema ya exige que los dos
 * operadores apunten en sentidos contrarios y que los tiempos esten en el orden
 * que toca. Se repite aqui para que el error salga como un 400 legible en vez
 * de como una violacion de restriccion, que en pantalla es ruido.
 */
export const rangoTiempoSchema = z
  .object({
    evatieran_op_cero: operador,
    evatieran_tiempo_cero: z.number().int().positive(),
    evatieran_op_full: operador,
    evatieran_tiempo_full: z.number().int().positive(),
  })
  .refine(
    (r) => r.evatieran_tiempo_cero !== r.evatieran_tiempo_full,
    'Los dos umbrales no pueden ser el mismo tiempo',
  )
  .refine((r) => {
    const ceroEsMenor = r.evatieran_op_cero === '<' || r.evatieran_op_cero === '<=';
    const fullEsMayor = r.evatieran_op_full === '>' || r.evatieran_op_full === '>=';

    // Menos tiempo = 0 puntos  ->  el umbral completo tiene que estar por encima.
    if (ceroEsMenor && fullEsMayor) return r.evatieran_tiempo_full > r.evatieran_tiempo_cero;
    // Mas tiempo = 0 puntos  ->  el umbral completo tiene que estar por debajo.
    if (!ceroEsMenor && !fullEsMayor) return r.evatieran_tiempo_full < r.evatieran_tiempo_cero;
    return false;
  }, 'Los umbrales son incoherentes: uno tiene que dar 0 puntos y el otro el puntaje completo, en sentidos contrarios');

/**
 * Un parametro.
 *
 * El `superRefine` obliga a que cada metodo traiga lo suyo. En el sistema viejo
 * se podia guardar un parametro por tiempo **sin umbrales** —y de hecho no hay
 * ni uno configurado en produccion— o uno por escala sin maximo, y el fallo no
 * aparecia hasta que alguien intentaba evaluar y sacaba 0 puntos sin motivo.
 */
export const parametroSchema = z
  .object({
    /** Presente al editar, ausente al crear. Sirve para conservar los intentos. */
    evaparam_id: z.number().int().positive().optional(),
    evaparam_nombre: z.string().trim().min(2, 'El nombre es muy corto').max(160),
    evaparam_nota: textoOpcional(500),
    evatipometo_id: z
      .number()
      .int()
      .refine(
        (v) => (Object.values(METODO) as number[]).includes(v),
        'Metodo de evaluacion desconocido',
      ),
    evaparam_intentos: z.number().int().min(1).max(20),
    evaparam_puntaje: z.number().int().min(1).max(1000),
    evaparam_escala_min: z.number().int().min(0).max(1000).nullable().optional(),
    evaparam_escala_max: z.number().int().min(0).max(1000).nullable().optional(),
    rango: rangoTiempoSchema.nullable().optional(),
  })
  .superRefine((p, ctx) => {
    if (p.evatipometo_id === METODO.TIEMPO && !p.rango) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rango'],
        message: `"${p.evaparam_nombre}" es por tiempo: necesita sus dos umbrales`,
      });
    }
    if (p.evatipometo_id !== METODO.TIEMPO && p.rango) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rango'],
        message: 'Solo los parametros por tiempo llevan umbrales',
      });
    }

    if (p.evatipometo_id === METODO.ESCALA) {
      const min = p.evaparam_escala_min ?? 0;
      if (p.evaparam_escala_max === null || p.evaparam_escala_max === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['evaparam_escala_max'],
          message: `"${p.evaparam_nombre}" es por escala: necesita un maximo`,
        });
      } else if (p.evaparam_escala_max <= min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['evaparam_escala_max'],
          message: 'El maximo de la escala tiene que ser mayor que el minimo',
        });
      }
    }
  });

export type ParametroInput = z.infer<typeof parametroSchema>;

// ---------------------------------------------------------------------------
// Evaluaciones

export const listarEvaluacionesSchema = paginacionSchema.extend({
  buscar: z.string().trim().max(160).optional(),
  categoria: z.string().trim().max(120).optional(),
  estado: z.coerce.number().int().positive().optional(),
  /** Solo las que no estan vinculadas a ninguna disciplina. */
  sinDisciplinas: bandera,
  orden: z.enum(['titulo', 'categoria', 'puntaje', 'creacion', 'pendientes']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

export type ListarEvaluacionesQuery = z.infer<typeof listarEvaluacionesSchema>;

export const crearEvaluacionSchema = z.object({
  eva_titulo: titulo,
  eva_descripcion: textoOpcional(1000),
  eva_categoria: textoOpcional(120),
  /** Se puede crear con sus parametros de una vez, que es el flujo de dos pasos. */
  parametros: z.array(parametroSchema).max(50).optional(),
});

export type CrearEvaluacionInput = z.infer<typeof crearEvaluacionSchema>;

export const actualizarEvaluacionSchema = z
  .object({
    eva_titulo: titulo.optional(),
    eva_descripcion: textoOpcional(1000),
    eva_categoria: textoOpcional(120),
  })
  .refine((v) => Object.keys(v).length > 0, 'No hay nada que actualizar');

export type ActualizarEvaluacionInput = z.infer<typeof actualizarEvaluacionSchema>;

/**
 * La lista completa de parametros que debe tener la evaluacion.
 *
 * Los que traen `evaparam_id` se actualizan, los que no, se crean, y los que
 * faltan se borran. El trigger `trigger_update_evaluacion_puntaje_total`
 * recalcula `eva_puntaje_total` solo, por eso nadie lo manda.
 */
export const parametrosSchema = z.object({
  parametros: z.array(parametroSchema).min(1, 'Una evaluacion necesita al menos un parametro').max(50),
});

export const disciplinasSchema = z.object({
  colacthor_ids: z
    .array(z.number().int().positive())
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, 'Hay disciplinas repetidas'),
});

export const eliminarEvaluacionSchema = z.object({
  confirmacion: z.string().trim().min(1, 'Escribe el titulo de la evaluacion para confirmar'),
});

// ---------------------------------------------------------------------------
// Evaluar alumnos

export const listarPendientesSchema = z.object({
  evaluacion: z.coerce.number().int().positive(),
  disciplina: z.coerce.number().int().positive(),
  /** 6 pendiente, 7 evaluado. Sin filtro salen los dos. */
  estado: z.coerce.number().int().positive().optional(),
  buscar: z.string().trim().max(160).optional(),
});

export type ListarPendientesQuery = z.infer<typeof listarPendientesSchema>;

/**
 * Los intentos de un alumno.
 *
 * Llega la lista completa de lo registrado; el backend puntua cada uno,
 * reemplaza los que hubiera y decide si el alumno queda evaluado o sigue
 * pendiente. El puntaje **no viaja**: lo calcula el servidor.
 */
export const intentosSchema = z.object({
  intentos: z
    .array(
      z.object({
        evaparam_id: z.number().int().positive(),
        evaint_intento: z.number().int().min(1).max(20),
        tiempo: z.number().int().min(0).max(86_400).nullable().optional(),
        logro: z.boolean().nullable().optional(),
        escala: z.number().int().min(0).max(1000).nullable().optional(),
        mobak: z.number().int().min(0).max(6).nullable().optional(),
      }),
    )
    .max(400)
    .refine(
      (intentos) =>
        new Set(intentos.map((i) => `${i.evaparam_id}:${i.evaint_intento}`)).size ===
        intentos.length,
      'Hay un intento repetido en el lote',
    ),
});

export type IntentosInput = z.infer<typeof intentosSchema>;

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
