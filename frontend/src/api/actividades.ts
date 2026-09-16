import { api } from '@/lib/api';

/**
 * Cliente del catalogo de Actividades.
 *
 * Una actividad es el "qué" (Karate, Ajedrez). El "dónde y cuándo" es la
 * disciplina, que vive en su propio módulo.
 */

export interface Categoria {
  cat_id: number;
  cat_nombre: string;
  cat_descripcion: string | null;
  actividades: number;
}

export interface Actividad {
  act_id: number;
  act_nombre: string;
  act_descripcion: string | null;
  cat_id: number | null;
  cat_nombre: string | null;
  act_indumentaria_tipo: string | null;
  act_espacio_trabajo: string | null;
  act_tipo_espacio: string | null;
  act_espacio_secundario: string | null;
  act_materiales_alumno: string[] | null;
  act_fecha_creacion: string | null;
  /** Disciplinas activas que la usan y en cuántos colegios. Contados en SQL. */
  disciplinas: number;
  colegios: number;
}

export interface PaginaActividades {
  items: Actividad[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FiltrosActividades {
  page?: number;
  limit?: number;
  buscar?: string;
  categoria?: number;
  orden?: 'nombre' | 'categoria' | 'disciplinas' | 'creacion';
  dir?: 'asc' | 'desc';
}

export interface DatosActividad {
  act_nombre?: string;
  act_descripcion?: string;
  cat_id?: number | null;
  act_indumentaria_tipo?: string;
  act_espacio_trabajo?: string;
  act_tipo_espacio?: string;
  act_espacio_secundario?: string;
  act_materiales_alumno?: string[];
}

export interface ImpactoActividad {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

function queryString(filtros: FiltrosActividades): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === '') continue;
    params.set(clave, String(valor));
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

export const actividadesApi = {
  listar: (filtros: FiltrosActividades) =>
    api.get<PaginaActividades>(`/actividades${queryString(filtros)}`),

  categorias: () => api.get<Categoria[]>('/actividades/categorias'),

  obtener: (id: number) => api.get<Actividad>(`/actividades/${id}`),

  crear: (datos: DatosActividad) => api.post<Actividad>('/actividades', datos),

  actualizar: (id: number, datos: DatosActividad) =>
    api.patch<Actividad>(`/actividades/${id}`, datos),

  impacto: (id: number) => api.get<ImpactoActividad>(`/actividades/${id}/impacto`),

  eliminar: (id: number, confirmacion: string) =>
    api.delete<ImpactoActividad>(`/actividades/${id}`, { confirmacion }),
};
