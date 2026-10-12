import { api } from '@/lib/api';

/**
 * Cliente de Novedades (punto 8 del Roadmap, 2026-10-09).
 */

export type TipoNovedad = 'general' | 'personal' | 'alumno';

export interface MencionPersona {
  id: number;
  nombre: string;
  correo: string | null;
}

export interface MencionAlumno {
  id: number;
  nombre: string;
  col_id: number | null;
  col_nombre: string | null;
  grado: string | null;
}

export interface Novedad {
  nov_id: number;
  nov_tipo: TipoNovedad;
  nov_texto: string;
  nov_fecha_creacion: string;
  autor: { usu_id: number; usu_nombre: string; usu_correo: string | null };
  personas: MencionPersona[];
  alumnos: MencionAlumno[];
}

export interface FiltrosListar {
  tipo?: TipoNovedad;
  autor?: number;
  persona?: number;
  alumno?: number;
  desde?: string;
  hasta?: string;
  buscar?: string;
  limit?: number;
  offset?: number;
}

export type CrearNovedadInput =
  | { tipo: 'general'; texto: string }
  | { tipo: 'personal'; texto: string; usu_ids: number[] }
  | { tipo: 'alumno'; texto: string; nino_ids: number[] };

export interface PersonaMencionable {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string | null;
  rol: string | null;
}

export interface AlumnoMencionable {
  nino_id: number;
  nino_nombre: string;
  col_nombre: string | null;
  grado: string | null;
}

function queryStringImpl(params: Record<string, string | number | undefined> | FiltrosListar): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    u.set(k, String(v));
  }
  const texto = u.toString();
  return texto ? `?${texto}` : '';
}

export const novedadesApi = {
  listar: (filtros: FiltrosListar) => api.get<Novedad[]>(`/novedades${queryStringImpl(filtros)}`),
  obtener: (id: number) => api.get<Novedad>(`/novedades/${id}`),
  crear: (input: CrearNovedadInput) => api.post<Novedad>('/novedades', input),
  eliminar: (id: number) => api.delete<{ eliminada: true }>(`/novedades/${id}`),
  personal: (opts: { buscar?: string; limit?: number } = {}) =>
    api.get<PersonaMencionable[]>(`/novedades/personal-mencionable${queryStringImpl(opts)}`),
  alumnos: (opts: { buscar?: string; limit?: number } = {}) =>
    api.get<AlumnoMencionable[]>(`/novedades/alumnos-mencionables${queryStringImpl(opts)}`),
};
