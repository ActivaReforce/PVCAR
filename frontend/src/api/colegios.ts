import { api } from '@/lib/api';

/**
 * Cliente del modulo de Colegios. Los tipos los define el backend.
 *
 * En el sistema viejo esta pantalla hablaba directo con Supabase: traia la
 * tabla entera, buscaba y paginaba en el navegador, y los coordinadores se
 * guardaban borrando todos e insertando de nuevo sin transaccion.
 */

export interface CoordinadorResumen {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
}

export interface ColegioListado {
  col_id: number;
  col_nombre: string;
  col_direccion: string;
  col_rep_nombre: string | null;
  col_rep_telefono: string | null;
  col_rep_email: string | null;
  col_rep_foto: string | null;
  /** URL firmada, valida una hora. Es la unica que sirve para pintar. */
  col_rep_foto_url: string | null;
  col_fecha_creacion: string | null;
  coordinadores: CoordinadorResumen[];
  /** Contados en SQL: disciplinas activas y alumnos activos del colegio. */
  disciplinas: number;
  estudiantes: number;
}

export interface ColegioDetalle extends ColegioListado {
  col_fecha_modificacion: string | null;
}

export interface PaginaColegios {
  items: ColegioListado[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FiltrosColegios {
  page?: number;
  limit?: number;
  buscar?: string;
  orden?: 'nombre' | 'creacion' | 'disciplinas' | 'estudiantes';
  dir?: 'asc' | 'desc';
}

export interface ImpactoColegio {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

export interface DatosColegio {
  col_nombre?: string;
  col_direccion?: string;
  col_rep_nombre?: string;
  col_rep_telefono?: string;
  col_rep_email?: string;
  col_rep_foto?: string | null;
  coordinadores?: number[];
}

export interface SubidaFirmada {
  path: string;
  signedUrl: string;
  token: string;
}

function queryString(filtros: FiltrosColegios): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === '') continue;
    params.set(clave, String(valor));
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

export const colegiosApi = {
  listar: (filtros: FiltrosColegios) =>
    api.get<PaginaColegios>(`/colegios${queryString(filtros)}`),

  obtener: (id: number) => api.get<ColegioDetalle>(`/colegios/${id}`),

  /** Usuarios activos con rol de Coordinador: los unicos que pueden serlo. */
  candidatos: () => api.get<CoordinadorResumen[]>('/colegios/coordinadores'),

  crear: (datos: DatosColegio) => api.post<ColegioDetalle>('/colegios', datos),

  actualizar: (id: number, datos: DatosColegio) =>
    api.patch<ColegioDetalle>(`/colegios/${id}`, datos),

  coordinadores: (id: number, coordinadores: number[]) =>
    api.put<ColegioDetalle>(`/colegios/${id}/coordinadores`, { coordinadores }),

  impacto: (id: number) => api.get<ImpactoColegio>(`/colegios/${id}/impacto`),

  eliminar: (id: number, confirmacion: string) =>
    api.delete<ImpactoColegio>(`/colegios/${id}`, { confirmacion }),

  urlDeSubida: (mimeType: string) => api.post<SubidaFirmada>('/colegios/foto', { mimeType }),
};
