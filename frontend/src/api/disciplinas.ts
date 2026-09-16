import { api } from '@/lib/api';

/**
 * Cliente de Disciplinas: el eje del modelo.
 *
 * Una disciplina es colegio + actividad + día + franja horaria. De ella
 * cuelgan inscripciones, asignaciones de entrenador, evaluaciones y
 * asistencias — las cuatro sin cascada, así que una disciplina usada no se
 * borra: se da de baja.
 */

export interface EntrenadorDeDisciplina {
  usu_id: number;
  usu_nombre: string;
}

export interface Disciplina {
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_id: number;
  act_nombre: string;
  cat_nombre: string | null;
  dia_id: number;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  est_id: number;
  colacthor_fecha_creacion: string | null;
  entrenadores: EntrenadorDeDisciplina[];
  alumnos: number;
  evaluaciones: number;
}

export interface ConteosDisciplinas {
  total: number;
  activas: number;
  deBaja: number;
  sinEntrenador: number;
  /** Suma de inscripciones activas de todas las disciplinas del filtro. */
  alumnos: number;
}

export interface PaginaDisciplinas {
  items: Disciplina[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  conteos: ConteosDisciplinas;
}

export interface FiltrosDisciplinas {
  page?: number;
  limit?: number;
  buscar?: string;
  colegio?: number[];
  actividad?: number[];
  dia?: number;
  estado?: number;
  sinEntrenador?: boolean;
  orden?: 'horario' | 'colegio' | 'actividad' | 'creacion' | 'alumnos';
  dir?: 'asc' | 'desc';
}

export interface Franja {
  dia_id: number;
  colacthor_hora_inicio: string;
  colacthor_hora_fin: string;
}

export interface DatosLote {
  col_id: number;
  act_id: number;
  horarios: Franja[];
}

export interface DatosDisciplina {
  col_id?: number;
  act_id?: number;
  dia_id?: number;
  colacthor_hora_inicio?: string;
  colacthor_hora_fin?: string;
}

export interface PrevioBaja {
  inscripciones: number;
  asignaciones: number;
}

export interface ImpactoDisciplina {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

export interface Dia {
  dia_id: number;
  dia_nombre: string;
}

function queryString(filtros: FiltrosDisciplinas): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
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

export const disciplinasApi = {
  listar: (filtros: FiltrosDisciplinas) =>
    api.get<PaginaDisciplinas>(`/disciplinas${queryString(filtros)}`),

  dias: () => api.get<Dia[]>('/disciplinas/dias'),

  obtener: (id: number) => api.get<Disciplina>(`/disciplinas/${id}`),

  /** Alta por lote: un colegio, una actividad y varias franjas de una vez. */
  crear: (datos: DatosLote) => api.post<Disciplina[]>('/disciplinas', datos),

  actualizar: (id: number, datos: DatosDisciplina) =>
    api.patch<Disciplina>(`/disciplinas/${id}`, datos),

  previoBaja: (id: number) => api.get<PrevioBaja>(`/disciplinas/${id}/previo-baja`),

  darDeBaja: (id: number) => api.post<Disciplina>(`/disciplinas/${id}/baja`),

  reactivar: (id: number) => api.post<Disciplina>(`/disciplinas/${id}/reactivar`),

  impacto: (id: number) => api.get<ImpactoDisciplina>(`/disciplinas/${id}/impacto`),

  eliminar: (id: number, confirmacion: string) =>
    api.delete<ImpactoDisciplina>(`/disciplinas/${id}`, { confirmacion }),
};
