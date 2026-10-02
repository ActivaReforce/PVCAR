import { api } from '@/lib/api';
import type { Grafica } from '@/api/reportes';

/**
 * Cliente de Data anterior: la plataforma vieja, de solo lectura.
 *
 * Los ids de colegio, actividad o entrenador que se usan aquí son los del
 * esquema `archivo` y salen de `/historico/opciones`. **No** son los de la
 * plataforma nueva: no se pueden mezclar con `useColegios` ni con nada del
 * resto del sistema.
 */

export type FiltroId =
  | 'buscar'
  | 'colegio'
  | 'actividad'
  | 'entrenador'
  | 'estado'
  | 'asistencia'
  | 'rol'
  | 'desde'
  | 'hasta';

export interface Opcion {
  id: number;
  nombre: string;
}

export interface ColumnaHistorico {
  clave: string;
  cabecera: string;
  ancho: number;
  numero?: boolean;
}

export type GrupoConjunto = 'Personas' | 'Estructura' | 'Asistencia' | 'Evaluaciones';

export interface ConjuntoDisponible {
  id: string;
  grupo: GrupoConjunto;
  titulo: string;
  descripcion: string;
  columnas: ColumnaHistorico[];
  /** Los filtros que admite, en el orden en que se enseñan. */
  filtros: FiltroId[];
  /** Los valores del filtro de estado, que cambian de un conjunto a otro. */
  estados: Opcion[];
  /** Sobre qué fecha se aplica el rango ("el día de la clase"...). */
  rangoSobre: string | null;
  filas: number;
}

export interface OpcionesHistorico {
  colegios: Opcion[];
  actividades: Opcion[];
  entrenadores: Opcion[];
  roles: Opcion[];
  asistencia: Opcion[];
  rango: { desde: string | null; hasta: string | null };
}

export interface FiltrosHistorico {
  buscar?: string;
  colegio?: number;
  actividad?: number;
  entrenador?: number;
  estado?: number;
  asistencia?: number;
  rol?: number;
  desde?: string;
  hasta?: string;
}

export interface Orden {
  orden?: string;
  dir: 'asc' | 'desc';
}

export interface PaginaHistorico {
  id: string;
  titulo: string;
  columnas: ColumnaHistorico[];
  filas: Array<Record<string, unknown>>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FiltrosResumen {
  colegio?: number;
  desde?: string;
  hasta?: string;
}

export interface Indicadores {
  alumnos: number;
  colegios: number;
  disciplinas: number;
  entrenadores: number;
  inscripciones: number;
  asistencias: number;
  pct_presencia: number | null;
  primera: string | null;
  ultima: string | null;
  asistencias_entrenadores: number;
  pct_presencia_entrenadores: number | null;
}

export interface ResumenHistorico {
  indicadores: Indicadores;
  graficas: Grafica[];
}

function queryString(filtros: object): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === '') continue;
    params.set(clave, String(valor));
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

export const historicoApi = {
  conjuntos: () => api.get<ConjuntoDisponible[]>('/historico/conjuntos'),

  opciones: () => api.get<OpcionesHistorico>('/historico/opciones'),

  resumen: (filtros: FiltrosResumen) =>
    api.get<ResumenHistorico>(`/historico/resumen${queryString(filtros)}`),

  consultar: (id: string, filtros: FiltrosHistorico, orden: Orden, page: number, limit: number) =>
    api.get<PaginaHistorico>(
      `/historico/conjuntos/${id}${queryString({ ...filtros, ...orden, page, limit })}`,
    ),

  /** Los filtros van en el cuerpo: no quedan escritos en los logs del servidor. */
  exportar: (id: string, filtros: FiltrosHistorico, orden: Orden) =>
    api.descargar(
      `/historico/conjuntos/${id}/export`,
      { ...filtros, ...orden },
      `data-anterior-${id}.xlsx`,
    ),

  exportarTodo: () => api.descargar('/historico/export', {}, 'data-anterior-completa.xlsx'),
};
