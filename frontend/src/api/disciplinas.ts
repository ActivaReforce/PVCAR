import { api } from '@/lib/api';

/**
 * Cliente de Disciplinas: el eje del modelo.
 *
 * Una disciplina es colegio + actividad + sus días, cada uno con su hora
 * (Disciplinas v2: "Fútbol lunes 15:00 y miércoles 16:00" es UNA). De ella
 * cuelgan inscripciones, asignaciones de entrenador, evaluaciones y
 * asistencias — las cuatro sin cascada, así que una disciplina usada no se
 * borra: se da de baja.
 */

export interface EntrenadorDeDisciplina {
  usu_id: number;
  usu_nombre: string;
}

/** Un día de la disciplina con su hora ("15:00"). */
export interface HorarioDisciplina {
  dia_id: number;
  dia_nombre: string;
  inicio: string;
  fin: string;
}

export interface Disciplina {
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_id: number;
  act_nombre: string;
  /** Color pastel de la actividad (lib/colores.ts) o null. */
  act_color: string | null;
  cat_nombre: string | null;
  /** Ordenados de lunes a domingo. */
  horarios: HorarioDisciplina[];
  /** "Lun y Mié 15:00–16:00". */
  horario_texto: string | null;
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
  inicio: string;
  fin: string;
}

export interface DatosNuevaDisciplina {
  col_id: number;
  act_id: number;
  horarios: Franja[];
}

/** `horarios` reemplaza la lista entera. */
export interface DatosDisciplina {
  col_id?: number;
  act_id?: number;
  horarios?: Franja[];
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

  /** Una disciplina con todos sus días. */
  crear: (datos: DatosNuevaDisciplina) => api.post<Disciplina>('/disciplinas', datos),

  actualizar: (id: number, datos: DatosDisciplina) =>
    api.patch<Disciplina>(`/disciplinas/${id}`, datos),

  previoBaja: (id: number) => api.get<PrevioBaja>(`/disciplinas/${id}/previo-baja`),

  darDeBaja: (id: number) => api.post<Disciplina>(`/disciplinas/${id}/baja`),

  reactivar: (id: number) => api.post<Disciplina>(`/disciplinas/${id}/reactivar`),

  impacto: (id: number) => api.get<ImpactoDisciplina>(`/disciplinas/${id}/impacto`),

  eliminar: (id: number, confirmacion: string) =>
    api.delete<ImpactoDisciplina>(`/disciplinas/${id}`, { confirmacion }),
};
