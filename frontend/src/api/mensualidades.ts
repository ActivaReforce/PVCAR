import { api, apiFetch } from '@/lib/api';

/** Mensualidades (backend/src/modules/mensualidades, migración 0041). */

export type EstadoMes = 'inscripcion' | 'pagado' | 'revision' | 'pendiente' | 'atrasado';

export interface MesDelHijo {
  /** 'YYYY-MM-01' */
  mes: string;
  estado: EstadoMes;
  disciplinas: string[];
  /** Las que pagó la inscripción ese mes. */
  inscripcion: string[];
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  menpag_id: number | null;
}

export interface PagoVista {
  menpag_id: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fecha: string;
  total: number;
  motivo: string | null;
  cuotas: Array<{ nombre: string; col_nombre: string; mes: string; total: number }>;
}

export interface MisMensualidades {
  cuenta_bancaria: string | null;
  colegios: Array<{
    col_id: number;
    col_nombre: string;
    dia_limite: number;
    hijos: Array<{ nino_id: number; nombre: string; meses: MesDelHijo[] }>;
  }>;
  pagos: PagoVista[];
}

export interface Pagar {
  cuotas: Array<{ nino_id: number; mes: string }>;
  total: number;
  comprobante: { mime: string; base64: string };
}

export interface CuotaDetalle {
  nino_id: number;
  nombre: string;
  col_id: number;
  col_nombre: string;
  mes: string;
  disciplinas: string[];
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
}

export interface PagoListado {
  menpag_id: number;
  estado: 'pendiente' | 'aprobado';
  fecha: string;
  usu_id: number | null;
  representante_nombre: string | null;
  representante_correo: string | null;
  representante_telefono: string | null;
  subtotal: number;
  iva: number;
  total: number;
  detalle: CuotaDetalle[];
  revisado_por: string | null;
  fecha_revision: string | null;
  meses: string[];
  alumnos: string[];
}

export interface ListaPagos {
  items: PagoListado[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  conteos: { pendientes: number };
}

export interface AlumnoDelMes {
  nino_id: number;
  nombre: string;
  representantes: string[];
  estado: EstadoMes;
  disciplinas: string[];
  inscripcion: string[];
  total: number;
}

export interface EstadoDelMes {
  mes: string;
  actual: string;
  colegios: Array<{
    col_id: number;
    col_nombre: string;
    cobra: boolean;
    alumnos: AlumnoDelMes[];
    totales: {
      pagados: number;
      inscripcion: number;
      revision: number;
      pendientes: number;
      atrasados: number;
      recaudado: number;
      en_revision: number;
      por_cobrar: number;
    };
  }>;
}

export interface CobroDelColegio {
  meses: number[];
  desde: string | null;
  dia_limite: number;
  dia_corte: number;
}

export interface ConfigMensualidades {
  recordatorio: boolean;
  colegios: Array<CobroDelColegio & { col_id: number; col_nombre: string }>;
}

export const mensualidadesApi = {
  mias: () => api.get<MisMensualidades>('/mensualidades/mias'),
  /** `clave`: la misma en los reintentos de un pago, para no duplicarlo (backend/lib/unaVez.ts). */
  pagar: (datos: Pagar, clave: string) =>
    apiFetch<{ menpag_id: number; total: number }>('/mensualidades/pagos', {
      method: 'POST',
      body: JSON.stringify(datos),
      headers: { 'Idempotency-Key': clave },
    }),
  descartar: (id: number) => api.delete<{ menpag_id: number }>(`/mensualidades/pagos/${id}`),

  listar: (f: { estado?: 'pendiente' | 'aprobado'; colegio?: number; buscar?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (f.estado) qs.set('estado', f.estado);
    if (f.colegio) qs.set('colegio', String(f.colegio));
    if (f.buscar) qs.set('buscar', f.buscar);
    if (f.page) qs.set('page', String(f.page));
    const sufijo = qs.toString();
    return api.get<ListaPagos>(`/mensualidades/pagos${sufijo ? `?${sufijo}` : ''}`);
  },
  ver: (id: number) => api.get<PagoListado & { comprobante_url: string | null }>(`/mensualidades/pagos/${id}`),
  aprobar: (id: number) => api.post<{ menpag_id: number }>(`/mensualidades/pagos/${id}/aprobar`),
  rechazar: (id: number, motivo: string) =>
    api.post<{ menpag_id: number }>(`/mensualidades/pagos/${id}/rechazar`, { motivo }),
  /** `mes`: 'YYYY-MM'. */
  mes: (mes?: string, colegio?: number) => {
    const qs = new URLSearchParams();
    if (mes) qs.set('mes', mes);
    if (colegio) qs.set('colegio', String(colegio));
    const sufijo = qs.toString();
    return api.get<EstadoDelMes>(`/mensualidades/mes${sufijo ? `?${sufijo}` : ''}`);
  },

  config: () => api.get<ConfigMensualidades>('/mensualidades/config'),
  guardarCobroColegio: (colId: number, c: CobroDelColegio) =>
    api.put<{ col_id: number }>(`/mensualidades/config/colegios/${colId}`, c),
};

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
export const NOMBRES_DE_MES = MESES;

/** '2026-11-01' → 'Noviembre 2026'. */
export const nombreDeMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

export const ETIQUETA_ESTADO: Record<EstadoMes, string> = {
  inscripcion: 'Pagado (Inscripción)',
  pagado: 'Pagado',
  revision: 'En revisión',
  pendiente: 'Pendiente',
  atrasado: 'Atrasado',
};
