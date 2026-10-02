import { api } from '@/lib/api';

/**
 * Cliente de Inscripciones (Fase 14B).
 *
 * Dos lados: el formulario público, que no tiene sesión, y el módulo interno
 * del Propietario. Mientras una inscripción está pendiente no existe ni el
 * usuario ni el alumno: nacen al aprobar.
 */

export type TipoDocumento = 'contrato' | 'terminos' | 'privacidad';

export interface DocumentoLegal {
  doc_id: number;
  doc_tipo: TipoDocumento;
  doc_version: number;
  doc_titulo: string;
  doc_contenido: string;
  doc_fecha: string;
  /** null = borrador. */
  doc_publicado: string | null;
}

export interface DisciplinaOfertada {
  colacthor_id: number;
  col_id: number;
  actividad: string;
  categoria: string | null;
  dia: string;
  dia_id: number;
  hora_inicio: string;
  hora_fin: string;
}

export interface ColegioOfertado {
  col_id: number;
  col_nombre: string;
  precio: number;
  descuento_hermano: number;
  descuento_solo_primera: boolean;
  disciplinas: DisciplinaOfertada[];
}

export interface CobroAlumno {
  precio_disciplina: number;
  disciplinas: number;
  subtotal: number;
  descuento_pct: number;
  descuento_solo_primera: boolean;
  descuento: number;
  total: number;
  paga_completo: boolean;
}

export interface Cobro {
  alumnos: CobroAlumno[];
  total: number;
}

export interface Formulario {
  disponible: boolean;
  colegios: ColegioOfertado[];
  grados: Array<{ catninograd_id: number; catninograd_nombre: string }>;
  parentescos: string[];
  documentos: Partial<Record<TipoDocumento, DocumentoLegal>>;
}

export interface RepresentanteEnvio {
  nombre: string;
  cedula: string;
  correo: string;
  telefono: string;
  sector_residencia?: string;
}

export interface NinoEnvio {
  nombre: string;
  fecha_nacimiento: string;
  cedula?: string;
  col_id: number;
  catninograd_id: number | null;
  parentesco: string;
  toma_transporte: boolean;
  info_salud?: string;
  otra_info?: string;
  disciplinas: number[];
}

export interface Envio {
  representante: RepresentanteEnvio;
  ninos: NinoEnvio[];
  documentos: Record<TipoDocumento, number>;
  acepta: Record<TipoDocumento, true>;
  comprobante: { mime: string; base64: string };
}

export interface EnvioRecibido {
  ins_id: number;
  total: number;
  contratos: Array<{ alumno: string; url: string | null }>;
}

// ---------------------------------------------------------------------------
// Módulo interno

export type EstadoInscripcion = 'pendiente' | 'aprobada';

export interface InscripcionListada {
  ins_id: number;
  ins_estado: EstadoInscripcion;
  ins_fecha: string;
  representante_nombre: string;
  representante_correo: string;
  representante_cedula: string;
  representante_telefono: string;
  ninos: string[];
  total: number | null;
  usuario_existente: boolean;
}

export interface ListaInscripciones {
  items: InscripcionListada[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  conteos: { pendientes: number; aprobadas: number };
}

export interface UsuarioCoincidente {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  usu_cedula: string | null;
  est_id: number;
  es_representante: boolean;
  por_correo: boolean;
  por_cedula: boolean;
}

export interface NinoDetalle {
  insnino_id: number;
  datos: Omit<NinoEnvio, 'disciplinas'>;
  colegio: string | null;
  grado: string | null;
  disciplinas: Array<{ colacthor_id: number; descripcion: string; disponible: boolean }>;
  contrato_url: string | null;
  contrato_sha256: string;
  cobro: CobroAlumno | null;
  nino_id: number | null;
}

export interface InscripcionDetalle {
  ins_id: number;
  ins_estado: EstadoInscripcion;
  ins_fecha: string;
  ins_representante: RepresentanteEnvio;
  ins_ip: string | null;
  ins_navegador: string | null;
  usu_id: number | null;
  aprobada_por_nombre: string | null;
  ins_fecha_aprobacion: string | null;
  ins_total: number | null;
  versiones: Record<TipoDocumento, number>;
  comprobante_url: string | null;
  ninos: NinoDetalle[];
  coincidencias: UsuarioCoincidente[];
  bloqueos: string[];
}

export interface ResultadoAprobacion {
  usu_id: number;
  cuenta_nueva: boolean;
  ninos: number[];
  correo_enviado: boolean;
}

export interface VersionDocumento {
  doc_id: number;
  doc_tipo: TipoDocumento;
  doc_version: number;
  doc_titulo: string;
  doc_fecha: string;
  doc_publicado: string | null;
  aceptaciones: number;
}

export interface Documentos {
  vigentes: DocumentoLegal[];
  borradores: DocumentoLegal[];
  historial: VersionDocumento[];
  marcadores: Record<string, string>;
}

export interface PrecioColegio {
  col_id: number;
  col_nombre: string;
  disciplinas_activas: number;
  precio: number | null;
  descuento_hermano: number | null;
  descuento_solo_primera: boolean | null;
  fecha_modificacion: string | null;
}

export interface DatosPrecio {
  precio: number;
  descuento_hermano: number;
  descuento_solo_primera: boolean;
}

export const inscripcionesApi = {
  formulario: () => api.get<Formulario>('/inscripcion/formulario'),
  enviar: (envio: Envio) => api.post<EnvioRecibido>('/inscripcion', envio),
  cotizar: (ninos: Array<{ col_id: number; disciplinas: number[] }>) =>
    api.post<Cobro>('/inscripcion/cotizacion', { ninos }),

  listar: (filtros: { estado?: EstadoInscripcion; buscar?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (filtros.estado) qs.set('estado', filtros.estado);
    if (filtros.buscar) qs.set('buscar', filtros.buscar);
    if (filtros.page) qs.set('page', String(filtros.page));
    const sufijo = qs.toString();
    return api.get<ListaInscripciones>(`/inscripciones${sufijo ? `?${sufijo}` : ''}`);
  },
  detalle: (id: number) => api.get<InscripcionDetalle>(`/inscripciones/${id}`),
  aprobar: (id: number) => api.post<ResultadoAprobacion>(`/inscripciones/${id}/aprobar`),
  rechazar: (id: number, confirmacion: string) =>
    api.delete<{ ins_id: number }>(`/inscripciones/${id}`, { confirmacion }),

  documentos: () => api.get<Documentos>('/inscripciones/documentos'),
  documento: (id: number) => api.get<DocumentoLegal>(`/inscripciones/documentos/${id}`),
  guardarBorrador: (datos: { tipo: TipoDocumento; titulo: string; contenido: string }) =>
    api.post<DocumentoLegal>('/inscripciones/documentos', datos),
  publicarDocumento: (id: number) =>
    api.post<DocumentoLegal>(`/inscripciones/documentos/${id}/publicar`),
  borrarBorrador: (id: number) => api.delete<{ doc_id: number }>(`/inscripciones/documentos/${id}`),
  /** El PDF de ejemplo se baja como archivo: no es { data, error }. */
  ejemploContrato: (id: number) =>
    api.descargar(`/inscripciones/documentos/${id}/ejemplo`, {}, `contrato-ejemplo-${id}.pdf`),

  precios: () => api.get<PrecioColegio[]>('/inscripciones/precios'),
  guardarPrecio: (colId: number, datos: DatosPrecio) =>
    api.put<{ col_id: number }>(`/inscripciones/precios/${colId}`, datos),
  borrarPrecio: (colId: number) =>
    api.delete<{ col_id: number }>(`/inscripciones/precios/${colId}`),
};

const MONEDA = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
export const dinero = (dolares: number) => MONEDA.format(dolares);

export const NOMBRE_DOCUMENTO: Record<TipoDocumento, string> = {
  contrato: 'Contrato',
  terminos: 'Términos y condiciones',
  privacidad: 'Política de privacidad',
};
