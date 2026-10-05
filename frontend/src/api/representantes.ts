import { api } from '@/lib/api';

/**
 * Cliente de Representantes.
 *
 * Esta pantalla **no da de alta personas**: un representante es un usuario con
 * el rol 4 y su ficha la crea Usuarios al concederle el rol. Aquí se ve quién
 * es cada uno y se le atan o sueltan sus representados.
 */

export interface Representante {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  usu_telefono: string | null;
  usu_foto_url: string | null;
  est_id: number;
  padre_id: number | null;
  padre_factura_nombre: string | null;
  padre_factura_identificacion: string | null;
  padre_factura_correo: string | null;
  padre_factura_direccion: string | null;
  hijos: number;
  encuestasRespondidas: number;
}

export interface Hijo {
  ninopadre_id: number;
  nino_id: number;
  nino_nombre: string;
  nino_foto: string | null;
  col_nombre: string;
  catninograd_nombre: string | null;
  est_id: number;
  disciplinas: number;
}

export interface AlumnoDisponible {
  nino_id: number;
  nino_nombre: string;
  col_nombre: string;
  catninograd_nombre: string | null;
  representantes: number;
}

export interface ConteosRepresentantes {
  total: number;
  activos: number;
  sinHijos: number;
  /** Con el rol pero sin fila en `padre`. No debería pasar; si pasa, se ve. */
  sinFicha: number;
}

export interface ListaRepresentantes {
  representantes: Representante[];
  conteos: ConteosRepresentantes;
}

export interface FichaRepresentante {
  representante: Representante;
  hijos: Hijo[];
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

/** Ficha de matrícula, sección A. Vacío lo borra. */
export interface DatosFactura {
  padre_factura_nombre: string;
  padre_factura_identificacion: string;
  padre_factura_correo: string;
  padre_factura_direccion: string;
}

export const representantesApi = {
  listar: (filtros: { buscar?: string; estado?: number }) =>
    api.get<ListaRepresentantes>(`/representantes${queryString(filtros)}`),

  ficha: (usuId: number) => api.get<FichaRepresentante>(`/representantes/${usuId}`),

  disponibles: (usuId: number, buscar?: string) =>
    api.get<AlumnoDisponible[]>(`/representantes/${usuId}/disponibles${queryString({ buscar })}`),

  guardarHijos: (usuId: number, ninoIds: number[]) =>
    api.put<FichaRepresentante>(`/representantes/${usuId}/hijos`, { nino_ids: ninoIds }),

  actualizarFactura: (usuId: number, factura: DatosFactura) =>
    api.patch<FichaRepresentante>(`/representantes/${usuId}`, factura),
};
