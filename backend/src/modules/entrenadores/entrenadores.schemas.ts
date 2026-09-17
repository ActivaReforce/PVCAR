import { z } from 'zod';
import { paginacionSchema } from '../../lib/paginacion.js';

/**
 * Validacion de entrada de Entrenadores.
 *
 * Este modulo no da de alta personas: un entrenador **es** un usuario con el
 * rol 3 y su ficha se crea desde Usuarios (entrenador.ent_id ES usuario.usu_id).
 * Aqui se decide **que imparte cada uno y quien lo respalda**, que es lo que
 * puebla el alcance de los roles 3, 6 y 7.
 *
 * Por eso el catalogo de permisos solo le da `ver` y `editar`: no hay crear ni
 * eliminar.
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

const bandera = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1');

export const listarEntrenadoresSchema = paginacionSchema.extend({
  buscar: z.string().trim().max(120).optional(),
  colegio: listaDeIds,
  /** Solo los que no tienen ninguna disciplina activa. */
  sinAsignar: bandera,
  /** Estado de la ficha de entrenador, no del usuario. */
  estado: z.coerce.number().int().positive().optional(),
  orden: z.enum(['nombre', 'disciplinas', 'alumnos', 'creacion']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

export type ListarEntrenadoresQuery = z.infer<typeof listarEntrenadoresSchema>;

/**
 * Asignar una disciplina.
 *
 * `reemplazar` existe porque cambiar de entrenador es una operacion real y
 * frecuente: sin ella habria que cerrar la asignacion del anterior en una
 * pantalla y abrir la del nuevo en otra, con la disciplina sin nadie entre
 * medias. Con ella las dos cosas ocurren en la misma transaccion.
 */
export const asignarSchema = z.object({
  colacthor_id: z.number().int().positive(),
  reemplazar: z.boolean().optional(),
  /** Por defecto hoy. Permite registrar una asignacion que empezo antes. */
  desde: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ser AAAA-MM-DD')
    .optional(),
});

export type AsignarInput = z.infer<typeof asignarSchema>;

export const atarAuxiliarSchema = z.object({
  usu_id: z.number().int().positive(),
});

export const historialSchema = z.object({
  historial: bandera,
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const dosIdsParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  segundoId: z.coerce.number().int().positive(),
});
