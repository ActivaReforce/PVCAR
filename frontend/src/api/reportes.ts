import { api } from '@/lib/api';

/**
 * Cliente de Reportes.
 *
 * Dos llamadas para los nueve reportes: una devuelve las filas paginadas y sus
 * columnas, y otra el xlsx ya generado. El sistema viejo tenía un par de
 * componentes por reporte —7 993 líneas en total— y cada uno armaba la hoja en
 * el navegador con SheetJS después de descargarse la tabla entera.
 */

export interface ColumnaReporte {
  clave: string;
  cabecera: string;
  ancho: number;
}

export interface ReporteDisponible {
  id: string;
  titulo: string;
  descripcion: string;
  /** Sin rango de fechas no se puede consultar. */
  exigeRango: boolean;
  columnas: ColumnaReporte[];
}

export interface PaginaReporte {
  id: string;
  titulo: string;
  columnas: ColumnaReporte[];
  filas: Array<Record<string, unknown>>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FiltrosReporte {
  buscar?: string;
  colegio?: number[];
  disciplina?: number;
  estado?: number;
  desde?: string;
  hasta?: string;
}

function queryString(filtros: object): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === '') continue;
    params.set(clave, Array.isArray(valor) ? valor.join(',') : String(valor));
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

export const reportesApi = {
  catalogo: () => api.get<ReporteDisponible[]>('/reportes'),

  consultar: (modulo: string, filtros: FiltrosReporte, page: number, limit: number) =>
    api.get<PaginaReporte>(`/reportes/${modulo}${queryString({ ...filtros, page, limit })}`),

  /** Los filtros van en el cuerpo: no quedan escritos en los logs del servidor. */
  exportar: (modulo: string, filtros: FiltrosReporte) =>
    api.descargar(`/reportes/${modulo}/export`, filtros, `${modulo}.xlsx`),
};
