import { z } from 'zod';
import { paginacionSchema } from '../../lib/paginacion.js';

/**
 * Validacion de entrada de Disciplinas.
 *
 * Una disciplina es colegio + actividad + dia + franja horaria: el eje del
 * modelo. De ella cuelgan las inscripciones, las asignaciones de entrenador,
 * las evaluaciones y las asistencias.
 */

/**
 * Hora como HH:MM o HH:MM:SS. Postgres acepta las dos y devuelve HH:MM:SS;
 * el input del navegador manda HH:MM.
 */
const hora = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'La hora debe ser HH:MM');

const idPositivo = z.coerce.number().int().positive();

const franja = z
  .object({
    dia_id: z.number().int().min(1).max(7),
    colacthor_hora_inicio: hora,
    colacthor_hora_fin: hora,
  })
  .refine((f) => f.colacthor_hora_fin > f.colacthor_hora_inicio, {
    message: 'La hora de fin tiene que ser posterior a la de inicio',
    path: ['colacthor_hora_fin'],
  });

/**
 * Varios ids separados por coma (?colegio=11,14). La pantalla vieja dejaba
 * marcar varios colegios y se mantiene.
 */
const listaDeIds = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((valor) => {
    if (valor === undefined) return undefined;
    const texto = Array.isArray(valor) ? valor.join(',') : valor;
    const ids = texto
      .split(',')
      .map((t) => Number(t.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    return ids.length > 0 ? ids : undefined;
  });

export const listarDisciplinasSchema = paginacionSchema.extend({
  buscar: z.string().trim().max(160).optional(),
  colegio: listaDeIds,
  actividad: listaDeIds,
  dia: z.coerce.number().int().min(1).max(7).optional(),
  estado: z.coerce.number().int().positive().optional(),
  /** true = solo las que no tienen entrenador activo. */
  sinEntrenador: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  orden: z.enum(['horario', 'colegio', 'actividad', 'creacion', 'alumnos']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

export type ListarDisciplinasQuery = z.infer<typeof listarDisciplinasSchema>;

/**
 * Alta por lote: un colegio, una actividad y varias franjas de una vez.
 *
 * Es como se crea de verdad —"karate en Quitumbe, lunes y miercoles de 15:00
 * a 16:00"— y era lo unico que el formulario viejo hacia bien. Lo que no hacia
 * era comprobar que no existieran ya, ni meterlo todo en una transaccion.
 */
export const crearDisciplinasSchema = z.object({
  col_id: z.number().int().positive(),
  act_id: z.number().int().positive(),
  horarios: z.array(franja).min(1, 'Hay que indicar al menos un horario').max(14),
});

export type CrearDisciplinasInput = z.infer<typeof crearDisciplinasSchema>;

export const actualizarDisciplinaSchema = z
  .object({
    col_id: z.number().int().positive().optional(),
    act_id: z.number().int().positive().optional(),
    dia_id: z.number().int().min(1).max(7).optional(),
    colacthor_hora_inicio: hora.optional(),
    colacthor_hora_fin: hora.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'No hay nada que actualizar');

export type ActualizarDisciplinaInput = z.infer<typeof actualizarDisciplinaSchema>;

export const eliminarDisciplinaSchema = z.object({
  confirmacion: z.string().trim().min(1, 'Escribe el nombre de la disciplina para confirmar'),
});

export const idParamSchema = z.object({ id: idPositivo });
