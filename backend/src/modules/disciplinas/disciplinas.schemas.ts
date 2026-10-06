import { z } from 'zod';
import { paginacionSchema } from '../../lib/paginacion.js';

/**
 * Validacion de entrada de Disciplinas.
 *
 * Una disciplina es colegio + actividad + sus horarios (uno o varios dias,
 * cada uno con su hora; Disciplinas v2). Es el eje del modelo: de ella
 * cuelgan las inscripciones, las asignaciones de entrenador, las evaluaciones
 * y las asistencias.
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

/** HH:MM:SS -> HH:MM, para comparar y guardar siempre igual. */
const corta = (h: string) => h.slice(0, 5);

const franja = z
  .object({
    dia_id: z.number().int().min(1).max(7),
    inicio: hora.transform(corta),
    fin: hora.transform(corta),
  })
  .refine((f) => f.fin > f.inicio, {
    message: 'La hora de fin tiene que ser posterior a la de inicio',
    path: ['fin'],
  });

/** Los dias de una disciplina: al menos uno y sin repetir dia. */
const horarios = z
  .array(franja)
  .min(1, 'Hay que indicar al menos un día')
  .max(7)
  .refine((lista) => new Set(lista.map((f) => f.dia_id)).size === lista.length, {
    message: 'Un día no puede repetirse en la misma disciplina',
  });

export type Franja = z.infer<typeof franja>;

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
 * Alta: un colegio, una actividad y sus dias ("Fútbol en Quitumbe, lunes
 * 15:00-16:00 y miércoles 16:00-17:00"). Es UNA disciplina, no una por dia.
 */
export const crearDisciplinaSchema = z.object({
  col_id: z.number().int().positive(),
  act_id: z.number().int().positive(),
  horarios,
});

export type CrearDisciplinaInput = z.infer<typeof crearDisciplinaSchema>;

/** Edicion. `horarios` reemplaza la lista entera. */
export const actualizarDisciplinaSchema = z
  .object({
    col_id: z.number().int().positive().optional(),
    act_id: z.number().int().positive().optional(),
    horarios: horarios.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'No hay nada que actualizar');

export type ActualizarDisciplinaInput = z.infer<typeof actualizarDisciplinaSchema>;

export const eliminarDisciplinaSchema = z.object({
  confirmacion: z.string().trim().min(1, 'Escribe el nombre de la disciplina para confirmar'),
});

export const idParamSchema = z.object({ id: idPositivo });
