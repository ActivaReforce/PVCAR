/**
 * Catalogos con nombre.
 *
 * En el sistema viejo el numero va suelto por todo el codigo: `rol_id === 3`
 * aparece 23 veces, `rol_id === 2` 19 veces y `est_id === 1` 29 veces, sin que
 * en ningun sitio este escrito que 3 es entrenador y 1 es activo. Cambiar un
 * catalogo obligaba a buscar y reemplazar por 300 archivos.
 *
 * Los ids son los de public.rol y public.estado y no cambian: vienen del
 * respaldo de la prod vieja y la carga del cutover los trae explicitos.
 */

export const ROL = {
  PROPIETARIO: 1,
  COORDINADOR: 2,
  ENTRENADOR: 3,
  REPRESENTANTE: 4,
  ADMIN: 5,
  ASISTENTE: 6,
  RESPALDO_ENTRENADOR: 7,
} as const;

export type RolId = (typeof ROL)[keyof typeof ROL];

/**
 * Roles que ven todo el sistema. Cualquier otro trabaja dentro de su alcance
 * (ver lib/alcance.ts). Es la unica lista que decide "esto lo ve todo el
 * mundo"; no repetirla en los modulos.
 */
export const ROLES_GLOBALES: readonly number[] = [ROL.PROPIETARIO, ROL.ADMIN];

/**
 * Roles que se apoyan en un entrenador titular: heredan su alcance a traves
 * de entrenador_auxiliar.
 */
export const ROLES_AUXILIARES: readonly number[] = [ROL.ASISTENTE, ROL.RESPALDO_ENTRENADOR];

export const ESTADO = {
  ACTIVO: 1,
  INACTIVO: 2,
  BORRADOR: 3,
  FINALIZADO: 4,
  PUBLICADO: 5,
  PENDIENTE: 6,
  EVALUADO: 7,
} as const;

export type EstadoId = (typeof ESTADO)[keyof typeof ESTADO];

/**
 * Modulos de rol_permiso. Mismo listado que el frontend, que lo usa para
 * pintar la matriz de permisos. `reporte_estudiante` existe en los datos
 * reales aunque el frontend viejo no lo declaraba en constants/modules.ts.
 */
export const MODULOS = [
  'dashboard',
  'usuarios',
  'colegios',
  'actividades',
  'disciplinas',
  'entrenadores',
  'estudiantes',
  'evaluaciones',
  'asistencias_estudiantes',
  'asistencias_entrenadores',
  'encuestas',
  'reportes',
  'reporte_estudiante',
  'perfil',
  'permisos',
] as const;

export type Modulo = (typeof MODULOS)[number];

export const ACCIONES = ['ver', 'crear', 'editar', 'eliminar'] as const;

export type Accion = (typeof ACCIONES)[number];
