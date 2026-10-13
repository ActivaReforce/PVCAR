import { api } from '@/lib/api';

/**
 * Cliente de Novedades (punto 8 del Roadmap, 2026-10-09).
 */

export type TipoNovedad =
  | 'general'
  | 'personal'
  | 'representante'
  | 'alumno'
  /** Las escribe el sistema al guardar la asistencia (punto 9). */
  | 'ausencia'
  | 'correccion';

/** Los que se escriben a mano. */
export type TipoManual = Exclude<TipoNovedad, 'ausencia' | 'correccion'>;

/** La clase de una ausencia o corrección, tal como estaba al guardar. */
export interface DatosClase {
  colacthor_id: number;
  /** AAAA-MM-DD */
  fecha: string;
  colegio: string;
  actividad: string;
  dia: string;
  horario: string | null;
  estado: string;
  hora_tarde: string | null;
  razon: string | null;
}

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
  representantes: Array<{ nombre: string; correo: string | null; telefono: string | null }>;
}

export interface Novedad {
  nov_id: number;
  nov_tipo: TipoNovedad;
  nov_texto: string;
  nov_fecha_creacion: string;
  /** null para quien no tiene Eliminar en Novedades: el backend no lo manda. */
  autor: { usu_id: number; usu_nombre: string; usu_correo: string | null } | null;
  personas: MencionPersona[];
  alumnos: MencionAlumno[];
  /** Solo en ausencia y corrección. */
  datos: DatosClase | null;
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
  | { tipo: 'representante'; texto: string; usu_ids: number[] }
  | { tipo: 'alumno'; texto: string; nino_ids: number[] };

export interface PersonaMencionable {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string | null;
  rol: string | null;
}

export interface RepresentanteMencionable {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string | null;
  /** Sus hijos activos dentro del alcance, con su colegio (para agrupar). */
  hijos: Array<{ nombre: string; colegio: string | null }>;
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
  /** Solo Propietario y Admin: nuevas desde la última que vio. */
  aviso: () => api.get<{ nuevas: number }>('/novedades/aviso'),
  marcarVisto: (hasta: string) => api.post<{ nuevas: number }>('/novedades/aviso/visto', { hasta }),
  personal: (opts: { buscar?: string; limit?: number } = {}) =>
    api.get<PersonaMencionable[]>(`/novedades/personal-mencionable${queryStringImpl(opts)}`),
  representantes: (opts: { buscar?: string; limit?: number } = {}) =>
    api.get<RepresentanteMencionable[]>(
      `/novedades/representantes-mencionables${queryStringImpl(opts)}`,
    ),
  alumnos: (opts: { buscar?: string; limit?: number } = {}) =>
    api.get<AlumnoMencionable[]>(`/novedades/alumnos-mencionables${queryStringImpl(opts)}`),
};
