import { api } from '@/lib/api';

/**
 * Cliente de Entrenadores.
 *
 * Este módulo no da de alta personas: un entrenador **es** un usuario con el
 * rol 3 y su ficha se crea desde Usuarios. Aquí se decide qué imparte cada uno
 * y quién lo respalda — que es lo que puebla el alcance de los roles 3, 6 y 7.
 */

export interface ColegioResumen {
  col_id: number;
  col_nombre: string;
}

export interface Entrenador {
  ent_id: number;
  usu_nombre: string;
  usu_correo: string;
  usu_telefono: string | null;
  usu_foto: string | null;
  usu_foto_url: string | null;
  ent_cedula: string | null;
  /** Estado de la ficha de entrenador. */
  est_id: number;
  /** Estado del usuario. Puede estar de baja con la ficha activa. */
  usuario_est_id: number;
  /** false si perdió el rol 3 pero conserva la ficha. */
  tiene_rol: boolean;
  colegios: ColegioResumen[];
  disciplinas: number;
  alumnos: number;
  auxiliares: number;
}

export interface Asignacion {
  entasig_id: number;
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_nombre: string;
  dia_id: number;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  entasig_fecha_inicio: string;
  entasig_fecha_fin: string | null;
  est_id: number;
  disciplina_est_id: number;
  alumnos: number;
}

export interface Auxiliar {
  entaux_id: number;
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  rol_id: number | null;
  est_id: number | null;
  usuario_activo: boolean;
  tiene_rol_auxiliar: boolean;
}

export interface FichaEntrenador {
  entrenador: Entrenador;
  asignaciones: Asignacion[];
  auxiliares: Auxiliar[];
}

export interface ConteosEntrenadores {
  total: number;
  activos: number;
  inactivos: number;
  sinAsignar: number;
}

export interface PaginaEntrenadores {
  items: Entrenador[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  conteos: ConteosEntrenadores;
}

export interface FiltrosEntrenadores {
  page?: number;
  limit?: number;
  buscar?: string;
  colegio?: number[];
  sinAsignar?: boolean;
  estado?: number;
  orden?: 'nombre' | 'disciplinas' | 'alumnos' | 'creacion';
  dir?: 'asc' | 'desc';
}

export interface DisciplinaDisponible {
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_nombre: string;
  dia_id: number;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  alumnos: number;
  /** Quién la da ahora, si la da alguien. Asignarla exige `reemplazar`. */
  entrenador_actual: string | null;
}

export interface CandidatoAuxiliar {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  rol_id: number;
}

function queryString(filtros: Record<string, unknown> | FiltrosEntrenadores): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros as Record<string, unknown>)) {
    if (valor === undefined || valor === null || valor === '' || valor === false) continue;
    if (Array.isArray(valor)) {
      if (valor.length > 0) params.set(clave, valor.join(','));
      continue;
    }
    params.set(clave, String(valor));
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

export const entrenadoresApi = {
  listar: (filtros: FiltrosEntrenadores) =>
    api.get<PaginaEntrenadores>(`/entrenadores${queryString(filtros)}`),

  ficha: (id: number, historial = false) =>
    api.get<FichaEntrenador>(`/entrenadores/${id}${historial ? '?historial=true' : ''}`),

  disponibles: (id: number, colegio?: number[]) =>
    api.get<DisciplinaDisponible[]>(
      `/entrenadores/${id}/disponibles${queryString({ colegio })}`,
    ),

  asignar: (id: number, colacthor_id: number, reemplazar = false) =>
    api.post<Asignacion[]>(`/entrenadores/${id}/asignaciones`, { colacthor_id, reemplazar }),

  cerrar: (id: number, entasigId: number) =>
    api.delete<Asignacion[]>(`/entrenadores/${id}/asignaciones/${entasigId}`),

  candidatosAuxiliar: () => api.get<CandidatoAuxiliar[]>('/entrenadores/candidatos-auxiliar'),

  atarAuxiliar: (id: number, usu_id: number) =>
    api.post<Auxiliar[]>(`/entrenadores/${id}/auxiliares`, { usu_id }),

  soltarAuxiliar: (id: number, entauxId: number) =>
    api.delete<Auxiliar[]>(`/entrenadores/${id}/auxiliares/${entauxId}`),
};
