import { z } from 'zod';
import { paginacionSchema } from '../../lib/paginacion.js';

/**
 * Validacion de entrada de Estudiantes.
 *
 * Es el modulo con mas volumen —796 ninos y 1672 inscripciones— y el primero
 * con paginacion de verdad: el sistema viejo se traia los 796 con sus padres,
 * su colegio y su grado anidados, y contaba activos e inactivos con .filter()
 * en JavaScript.
 */

const nombre = z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(160);

const textoOpcional = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

/**
 * 6 a 20 anos: es el rango real de los datos (min 6, max 20). No se deja 0 ni
 * 99 porque un dedazo en la edad se arrastra a los reportes por categoria.
 */
const edad = z.number().int().min(4).max(25).nullable().optional();

const cedula = z
  .string()
  .trim()
  .max(20)
  .regex(/^[0-9-]*$/, 'La cedula solo admite numeros y guiones')
  .optional()
  .or(z.literal(''));

/** Ruta del objeto en el bucket usufoto. null borra la foto actual. */
const foto = z.string().trim().max(255).nullable().optional();

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

export const listarEstudiantesSchema = paginacionSchema.extend({
  buscar: z.string().trim().max(160).optional(),
  colegio: listaDeIds,
  /** Inscritos en esta disciplina. Excluyente con sinAsignar. */
  disciplina: z.coerce.number().int().positive().optional(),
  /** Solo los que no tienen ninguna inscripcion activa. */
  sinAsignar: bandera,
  grado: z.coerce.number().int().positive().optional(),
  estado: z.coerce.number().int().positive().optional(),
  orden: z.enum(['nombre', 'colegio', 'grado', 'edad', 'creacion']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

export type ListarEstudiantesQuery = z.infer<typeof listarEstudiantesSchema>;

export const crearEstudianteSchema = z.object({
  nino_nombre: nombre,
  col_id: z.number().int().positive(),
  catninograd_id: z.number().int().positive().nullable().optional(),
  nino_edad: edad,
  nino_cedula: cedula,
  nino_toma_transporte: z.boolean().optional(),
  nino_info_salud: textoOpcional(1000),
  nino_otra_info: textoOpcional(1000),
  nino_foto: foto,
  /** Se puede inscribir de una vez, en disciplinas de su colegio. */
  disciplinas: z.array(z.number().int().positive()).max(20).optional(),
});

export type CrearEstudianteInput = z.infer<typeof crearEstudianteSchema>;

export const actualizarEstudianteSchema = z
  .object({
    nino_nombre: nombre.optional(),
    col_id: z.number().int().positive().optional(),
    catninograd_id: z.number().int().positive().nullable().optional(),
    nino_edad: edad,
    nino_cedula: cedula,
    nino_toma_transporte: z.boolean().optional(),
    nino_info_salud: textoOpcional(1000),
    nino_otra_info: textoOpcional(1000),
    nino_foto: foto,
  })
  .refine((v) => Object.keys(v).length > 0, 'No hay nada que actualizar');

export type ActualizarEstudianteInput = z.infer<typeof actualizarEstudianteSchema>;

/**
 * Inscripciones: llega la lista completa de disciplinas activas que debe
 * tener. El backend calcula la diferencia — inscribe lo que falta, da de baja
 * lo que sobra — en una transaccion.
 */
export const inscripcionesSchema = z.object({
  colacthor_ids: z
    .array(z.number().int().positive())
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, 'Hay disciplinas repetidas'),
});

export const representanteSchema = z.object({
  usu_id: z.number().int().positive(),
});

export const eliminarEstudianteSchema = z.object({
  confirmacion: z.string().trim().min(1, 'Escribe el nombre del estudiante para confirmar'),
});

export const historialSchema = z.object({ historial: bandera });

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const dosIdsParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  segundoId: z.coerce.number().int().positive(),
});
