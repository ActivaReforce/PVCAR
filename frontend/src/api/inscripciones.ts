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
  disciplinas: DisciplinaOfertada[];
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
  aceptaciones: number;
}

export interface Documentos {
  vigentes: DocumentoLegal[];
  historial: VersionDocumento[];
  marcadores: Record<string, string>;
}

export const inscripcionesApi = {
  formulario: () => api.get<Formulario>('/inscripcion/formulario'),
  enviar: (envio: Envio) => api.post<EnvioRecibido>('/inscripcion', envio),

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
  publicarDocumento: (datos: { tipo: TipoDocumento; titulo: string; contenido: string }) =>
    api.post<DocumentoLegal>('/inscripciones/documentos', datos),
};

export const NOMBRE_DOCUMENTO: Record<TipoDocumento, string> = {
  contrato: 'Contrato',
  terminos: 'Términos y condiciones',
  privacidad: 'Política de privacidad',
};
