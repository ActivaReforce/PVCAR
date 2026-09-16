import { z } from 'zod';
import { paginacionSchema } from '../../lib/paginacion.js';

/**
 * Validacion de entrada del catalogo de Actividades.
 *
 * Una actividad es "Karate" o "Ajedrez": el que, sin colegio ni horario. El
 * donde y el cuando son la disciplina (colegio_actividad_horario), que es otro
 * modulo.
 */

const nombre = z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120);

const textoOpcional = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

/**
 * Los materiales viajan como lista, no como la cadena separada por comas que
 * escribia la pantalla vieja. La columna es text[] desde siempre; el navegador
 * hacia el split y el join, asi que "silla, mesa" y "silla,mesa" daban
 * resultados distintos segun quien escribiera.
 */
const materiales = z
  .array(z.string().trim().min(1).max(120))
  .max(30)
  .optional();

export const listarActividadesSchema = paginacionSchema.extend({
  buscar: z.string().trim().max(120).optional(),
  categoria: z.coerce.number().int().positive().optional(),
  orden: z.enum(['nombre', 'categoria', 'disciplinas', 'creacion']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

export type ListarActividadesQuery = z.infer<typeof listarActividadesSchema>;

export const crearActividadSchema = z.object({
  act_nombre: nombre,
  act_descripcion: textoOpcional(500),
  cat_id: z.number().int().positive().optional().nullable(),
  act_indumentaria_tipo: textoOpcional(120),
  act_espacio_trabajo: textoOpcional(120),
  act_tipo_espacio: textoOpcional(120),
  act_espacio_secundario: textoOpcional(120),
  act_materiales_alumno: materiales,
});

export type CrearActividadInput = z.infer<typeof crearActividadSchema>;

export const actualizarActividadSchema = z
  .object({
    act_nombre: nombre.optional(),
    act_descripcion: textoOpcional(500),
    cat_id: z.number().int().positive().nullable().optional(),
    act_indumentaria_tipo: textoOpcional(120),
    act_espacio_trabajo: textoOpcional(120),
    act_tipo_espacio: textoOpcional(120),
    act_espacio_secundario: textoOpcional(120),
    act_materiales_alumno: materiales,
  })
  .refine((v) => Object.keys(v).length > 0, 'No hay nada que actualizar');

export type ActualizarActividadInput = z.infer<typeof actualizarActividadSchema>;

export const eliminarActividadSchema = z.object({
  confirmacion: z.string().trim().min(1, 'Escribe el nombre de la actividad para confirmar'),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
