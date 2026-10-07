import { z } from 'zod';

/**
 * Validacion de entrada de Asistencias.
 *
 * Es el modulo que mas se usa —13 202 registros de alumnos, 1 726 de
 * entrenadores y 283 de auxiliares— y el unico que se opera desde el telefono
 * en mitad de una cancha. Todo lo que aqui se valide mal se convierte en una
 * fila de historial que nadie va a volver a mirar hasta que un informe no
 * cuadre.
 *
 * Las tres reglas que se hacen cumplir aqui, y que el sistema viejo dejaba
 * enteras en el navegador:
 *
 *   1. La fecha va en AAAA-MM-DD y tiene que existir de verdad (el 31 de
 *      febrero se rechaza). Que caiga en el dia de la disciplina lo comprueba
 *      el servicio, que es quien conoce la disciplina.
 *   2. La hora de llegada va en HH:MM. El sistema viejo aceptaba lo que
 *      escribiera el usuario y le pegaba ':00' detras.
 *   3. Estado Tarde exige hora; estado Justificado exige motivo; los demas
 *      estados no admiten ni una cosa ni la otra. Se comprueba aqui por marca,
 *      no en el servicio, para que el error diga que fila esta mal.
 */

/** Los cuatro estados de `asistencia_estado`, que no cambian. */
export const ASISTENCIA = {
  PRESENTE: 1,
  AUSENTE: 2,
  TARDE: 3,
  JUSTIFICADO: 4,
} as const;

/**
 * Fecha AAAA-MM-DD que ademas existe.
 *
 * El regex solo mira la forma: '2026-02-31' la pasa y Postgres la rechazaria
 * con un 500 feo. El refine la construye y comprueba que vuelve igual.
 */
const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser AAAA-MM-DD')
  .refine((texto) => {
    const d = new Date(`${texto}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
  }, 'Esa fecha no existe');

/** Hora de llegada en HH:MM, 24 horas. Se guarda como HH:MM:00. */
const hora = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe ser HH:MM');

const estado = z
  .number()
  .int()
  .refine(
    (v) => (Object.values(ASISTENCIA) as number[]).includes(v),
    'Estado de asistencia desconocido',
  );

const motivo = z.string().trim().min(3, 'El motivo debe tener al menos 3 caracteres').max(500);

/**
 * Una marca: el estado de una persona en una sesion, con sus dos campos
 * condicionales.
 *
 * El `superRefine` es la regla de negocio 5 del Roadmap escrita una sola vez:
 * la comparten alumnos, entrenadores y auxiliares, y es la misma que el CHECK
 * de la migracion 0010 defiende en la base. Dos capas a proposito — esta da un
 * mensaje util, la de la base impide que nadie se la salte.
 */
function conCamposCondicionales<T extends z.ZodRawShape>(shape: T) {
  return z
    .object({
      asisest_id: estado,
      hora_tarde: hora.nullable().optional(),
      razon: motivo.nullable().optional(),
      ...shape,
    })
    .superRefine((marca, ctx) => {
      const tieneHora = marca.hora_tarde !== null && marca.hora_tarde !== undefined;
      const tieneRazon = marca.razon !== null && marca.razon !== undefined;

      if (marca.asisest_id === ASISTENCIA.TARDE && !tieneHora) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['hora_tarde'],
          message: 'Tarde exige la hora de llegada',
        });
      }
      if (marca.asisest_id !== ASISTENCIA.TARDE && tieneHora) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['hora_tarde'],
          message: 'La hora de llegada solo va con el estado Tarde',
        });
      }
      if (marca.asisest_id === ASISTENCIA.JUSTIFICADO && !tieneRazon) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['razon'],
          message: 'Justificado exige el motivo',
        });
      }
      if (marca.asisest_id !== ASISTENCIA.JUSTIFICADO && tieneRazon) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['razon'],
          message: 'El motivo solo va con el estado Justificado',
        });
      }
    });
}

// ---------------------------------------------------------------------------
// Alumnos

export const listaAlumnosSchema = z.object({
  disciplina: z.coerce.number().int().positive(),
  fecha,
});

export type ListaAlumnosQuery = z.infer<typeof listaAlumnosSchema>;

/**
 * Guardado por lote.
 *
 * El maximo de 200 marcas cubre de sobra la sesion mas grande que existe (42
 * alumnos) y evita que un cliente roto mande la tabla entera en una peticion.
 */
export const guardarAlumnosSchema = z.object({
  colacthor_id: z.number().int().positive(),
  fecha,
  marcas: z
    .array(conCamposCondicionales({ nino_id: z.number().int().positive() }))
    .min(1, 'No hay nada que guardar')
    .max(200)
    .refine(
      (marcas) => new Set(marcas.map((m) => m.nino_id)).size === marcas.length,
      'Hay un alumno repetido en el lote',
    ),
});

export type GuardarAlumnosInput = z.infer<typeof guardarAlumnosSchema>;

// ---------------------------------------------------------------------------
// Entrenadores y auxiliares

export const listaEntrenadoresSchema = z.object({
  colegio: z.coerce.number().int().positive(),
  fecha,
});

export type ListaEntrenadoresQuery = z.infer<typeof listaEntrenadoresSchema>;

/**
 * Entrenadores y auxiliares van en el mismo lote porque se marcan en la misma
 * pantalla y en el mismo gesto, aunque cada uno acabe en su tabla. `tipo`
 * decide en cual, y el id significa una cosa distinta en cada caso:
 * `entrenador.ent_id` (que es el `usu_id` del titular) o `usuario.usu_id` del
 * auxiliar.
 */
export const guardarEntrenadoresSchema = z.object({
  col_id: z.number().int().positive(),
  fecha,
  marcas: z
    .array(
      conCamposCondicionales({
        tipo: z.enum(['entrenador', 'auxiliar']),
        id: z.number().int().positive(),
      }),
    )
    .min(1, 'No hay nada que guardar')
    .max(200)
    .refine(
      (marcas) => new Set(marcas.map((m) => `${m.tipo}:${m.id}`)).size === marcas.length,
      'Hay una persona repetida en el lote',
    ),
});

export type GuardarEntrenadoresInput = z.infer<typeof guardarEntrenadoresSchema>;

// ---------------------------------------------------------------------------
// Historial

/**
 * Historial por disciplina y rango.
 *
 * Existe porque hoy no hay forma de ver una fecha pasada sin rehacer los
 * cuatro filtros en cascada. El rango se limita a 180 dias: es un resumen para
 * mirar en pantalla, no una exportacion.
 */
export const historialSchema = z
  .object({
    disciplina: z.coerce.number().int().positive(),
    desde: fecha,
    hasta: fecha,
  })
  .refine((q) => q.desde <= q.hasta, {
    path: ['desde'],
    message: 'La fecha inicial no puede ser posterior a la final',
  })
  .refine((q) => {
    const dias = (Date.parse(q.hasta) - Date.parse(q.desde)) / 86_400_000;
    return dias <= 180;
  }, 'El rango no puede pasar de 180 dias');

export type HistorialQuery = z.infer<typeof historialSchema>;
