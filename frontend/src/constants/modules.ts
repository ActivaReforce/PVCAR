
export const MODULES = [
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
  // Existe en los datos reales de rol_permiso aunque el sistema viejo no lo
  // declaraba aqui: sin el, la matriz de Permisos lo pintaba sin nombre.
  'reporte_estudiante',
  'perfil',
  'permisos',
] as const;

export type Module = typeof MODULES[number];

export const MODULE_LABELS: Record<Module, string> = {
  dashboard: 'Tablero',
  usuarios: 'Usuarios',
  colegios: 'Colegios',
  actividades: 'Actividades',
  disciplinas: 'Disciplinas',
  entrenadores: 'Entrenadores',
  estudiantes: 'Estudiantes',
  evaluaciones: 'Evaluaciones',
  asistencias_estudiantes: 'Asistencias Estudiantes',
  asistencias_entrenadores: 'Asistencias Entrenadores',
  encuestas: 'Encuestas',
  reportes: 'Reportes',
  reporte_estudiante: 'Reporte del Estudiante',
  perfil: 'Perfil',
  permisos: 'Permisos',
};

// Helper to map a pathname to a module key
export const pathToModule = (pathname: string): Module | null => {
  // Normalize and handle dynamic segments
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/usuarios')) return 'usuarios';
  if (pathname.startsWith('/colegios')) return 'colegios';
  if (pathname.startsWith('/actividades')) return 'actividades';
  if (pathname.startsWith('/disciplinas')) return 'disciplinas';
  if (pathname.startsWith('/entrenadores')) return 'entrenadores';
  if (pathname.startsWith('/estudiantes')) return 'estudiantes';
  if (pathname.startsWith('/evaluaciones')) return 'evaluaciones';
  if (pathname.startsWith('/asistencias')) return 'asistencias_estudiantes';
  if (pathname.startsWith('/attendance/coaches')) return 'asistencias_entrenadores';
  if (pathname.startsWith('/encuestas')) return 'encuestas';
  if (pathname.startsWith('/reportes')) return 'reportes';
  if (pathname.startsWith('/perfil')) return 'perfil';
  if (pathname.startsWith('/permisos')) return 'permisos';
  return null;
};
