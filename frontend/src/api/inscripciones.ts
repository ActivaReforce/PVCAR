import type { HorarioDisciplina } from '@/api/disciplinas';
import { api } from '@/lib/api';

/**
 * Cliente de Inscripciones (Fase 14B).
 *
 * Dos lados: el formulario público, que no tiene sesión, y el módulo interno
 * del Propietario. Mientras una inscripción está pendiente no existe ni el
 * usuario ni el alumno: nacen al aprobar.
 *
 * Cada alumno acepta seis documentos (ficha, contrato y los cuatro "00" del
 * cliente); de cada uno queda una constancia y todos van en un PDF.
 */

/** En el orden en que van en el paquete de cada alumno. */
export const TIPOS_DOCUMENTO = [
  'ficha_matricula',
  'contrato',
  'autorizacion_datos',
  'datos_medicos',
  'imagen',
  'politica',
] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

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
  /** Sus días con su hora: una disciplina se paga una vez. */
  horarios: HorarioDisciplina[];
  /** "Lun y Mié 15:00–16:00". */
  horario: string;
}

export interface ColegioOfertado {
  col_id: number;
  col_nombre: string;
  precio: number;
  descuento_hermano: number;
  sede: string;
  sede_corta: string;
  institucion: string;
  minimo_alumnos: number;
  disciplinas: DisciplinaOfertada[];
}

export interface CobroAlumno {
  precio_disciplina: number;
  disciplinas: number;
  subtotal: number;
  descuento_pct: number;
  disciplinas_con_descuento: number;
  descuento: number;
  /** Sin IVA. */
  total: number;
  paga_completo: boolean;
  iva_pct: number;
  iva: number;
  total_con_iva: number;
}

export interface Cobro {
  alumnos: CobroAlumno[];
  /** Sin IVA, con descuentos. */
  subtotal: number;
  iva: number;
  /** Con IVA: lo que se paga al mes. */
  total: number;
}

export interface Formulario {
  disponible: boolean;
  colegios: ColegioOfertado[];
  grados: Array<{ catninograd_id: number; catninograd_nombre: string }>;
  parentescos: string[];
  documentos: Partial<Record<TipoDocumento, DocumentoLegal>>;
  /** A dónde transferir el pago. */
  cuenta_bancaria: string | null;
  /** Cuántas disciplinas puede elegir cada alumno. */
  max_disciplinas: number;
}

export interface Factura {
  nombre: string;
  identificacion: string;
  correo: string;
  direccion: string;
}

export interface RepresentanteEnvio {
  nombre: string;
  cedula: string;
  correo: string;
  telefono: string;
  factura: Factura;
}

export interface Persona {
  nombre: string;
  relacion: string;
  telefono: string;
}

export type ModalidadSalida = 'escolar' | 'privado';

export interface Salud {
  tiene: boolean;
  detalle: string | null;
  autoriza: boolean;
}

export interface PermisosImagen {
  familias: boolean;
  redes: boolean;
  promocional: boolean;
}

export interface NinoEnvio {
  nombre: string;
  fecha_nacimiento: string;
  col_id: number;
  /** "Curso" en la ficha. */
  catninograd_id: number;
  parentesco: string;
  /** El hijo que ya existe, si se le añaden disciplinas (§9); null si es nuevo. */
  nino_id: number | null;
  disciplinas: number[];
  emergencia: Persona;
  /** Quien puede retirarlo; null si no indicó a nadie. */
  retiro: (Persona & { cedula: string }) | null;
  modalidad_salida: ModalidadSalida;
  detalle_retiro: string | null;
  salud: Salud;
  imagen: PermisosImagen;
}

export interface ColegioDocumento {
  sede: string;
  sede_corta: string;
  institucion: string;
  minimo_alumnos: number;
  tarifa: number;
  descuento_hermano: number;
}

/** Lo que se guarda de cada alumno: lo enviado y lo que el sistema puso en sus documentos. */
export interface NinoGuardado extends Omit<NinoEnvio, 'disciplinas' | 'nino_id'> {
  documento: {
    colegio: ColegioDocumento;
    curso: string | null;
    actividades: string[];
    horarios: string[];
  };
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
  paquetes: Array<{ alumno: string; url: string | null }>;
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
  /** Los colegios de sus alumnos, sin repetir. */
  colegios: string[];
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

export interface ConstanciaDetalle {
  tipo: TipoDocumento;
  nombre: string;
  version: number;
  sha256: string;
  opciones: Record<string, unknown>;
}

export interface NinoDetalle {
  insnino_id: number;
  datos: NinoGuardado;
  colegio: string | null;
  grado: string | null;
  disciplinas: Array<{ colacthor_id: number; descripcion: string; disponible: boolean }>;
  /** El aprobado si existe; si no, el que se descargó al enviar. */
  paquete_url: string | null;
  paquete_sha256: string;
  constancias: ConstanciaDetalle[];
  cobro: CobroAlumno | null;
  nino_id: number | null;
  /** Pendiente y con un hijo que ya existía: se le añaden disciplinas, no se crea. */
  existente: boolean;
  /** Pendiente y nuevo: alumnos que coinciden en nombre, nacimiento y colegio. */
  posibles: PosibleMismo[];
}

export interface PosibleMismo {
  nino_id: number;
  nino_nombre: string;
  col_nombre: string;
  representantes: string[];
}

/** La cuenta que ya tenía quien envió (§9). */
export interface CuentaPrevia {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  /** Está dada de baja: aprobar la reactiva. */
  reactiva: boolean;
  cambios: string[];
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
  comprobante_url: string | null;
  ninos: NinoDetalle[];
  coincidencias: UsuarioCoincidente[];
  cuenta: CuentaPrevia | null;
  bloqueos: string[];
}

/** "Ya inscribí antes": solo si hay cuenta, sin ningún dato. */
export type Identificacion =
  | { estado: 'nuevo' }
  | { estado: 'cuenta'; correo_pista: string }
  | { estado: 'inactiva' };

export interface DisciplinaActiva {
  colacthor_id: number;
  actividad: string;
  horarios: HorarioDisciplina[];
}

export interface HijoDelRepresentante {
  nino_id: number;
  nombre: string;
  fecha_nacimiento: string | null;
  col_id: number;
  col_nombre: string;
  catninograd_id: number | null;
  parentesco: string | null;
  modalidad_salida: ModalidadSalida | null;
  detalle_retiro: string | null;
  salud: string | null;
  imagen: PermisosImagen;
  emergencia: (Persona & { cedula: string | null }) | null;
  retiro: (Persona & { cedula: string | null }) | null;
  activas: DisciplinaActiva[];
}

export interface MisDatos {
  representante: {
    nombre: string;
    cedula: string | null;
    correo: string;
    telefono: string | null;
    factura: Factura | null;
  };
  hijos: HijoDelRepresentante[];
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
  /** Los textos de los Word del cliente, para un tipo que todavía no tiene texto. */
  iniciales: Record<TipoDocumento, { titulo: string; contenido: string }>;
}

export interface PrecioColegio {
  col_id: number;
  col_nombre: string;
  disciplinas_activas: number;
  precio: number | null;
  descuento_hermano: number | null;
  sede: string | null;
  sede_corta: string | null;
  institucion: string | null;
  minimo_alumnos: number | null;
  /** Interruptor del colegio; null si todavía no tiene valores. */
  abierta: boolean | null;
  fecha_modificacion: string | null;
}

export interface EstadoColegio {
  col_id: number;
  col_nombre: string;
  /** Abierto de verdad: interruptor encendido y todo lo necesario listo. */
  abierto: boolean;
  interruptor: boolean;
  /** Por qué está cerrado. Vacío si está abierto. */
  motivos: string[];
}

export interface EstadoInscripciones {
  abiertas: boolean;
  interruptor: boolean;
  motivos: string[];
  colegios: EstadoColegio[];
}

export interface DatosPrecio {
  precio: number;
  descuento_hermano: number;
  sede: string;
  sede_corta: string;
  institucion: string;
  minimo_alumnos: number;
}

export interface ConfigInscripciones {
  /** A dónde se transfiere el pago. Texto libre, con saltos de línea. */
  cuenta_bancaria: string | null;
  /** Tope de disciplinas por alumno en el formulario público. */
  max_disciplinas: number;
  /** false = el membrete de serie (el de los Word del cliente). */
  membrete_propio: boolean;
  membrete_data_url: string | null;
}

export interface DocumentoDeRepresentante {
  ins_id: number;
  ins_fecha: string;
  ins_estado: EstadoInscripcion;
  alumno: string;
  colegio: string | null;
  url: string | null;
}

export const inscripcionesApi = {
  formulario: () => api.get<Formulario>('/inscripcion/formulario'),
  /** `conSesion`: solo si entró en el propio formulario (§9); si no, va como anónimo. */
  enviar: (envio: Envio, conSesion: boolean) =>
    api.post<EnvioRecibido>('/inscripcion', envio, { sinSesion: !conSesion }),
  cotizar: (ninos: Array<{ col_id: number; disciplinas: number[]; nino_id: number | null }>, conSesion: boolean) =>
    api.post<Cobro>('/inscripcion/cotizacion', { ninos }, { sinSesion: !conSesion }),
  identificar: (cedula: string) =>
    api.post<Identificacion>('/inscripcion/identificar', { cedula }, { sinSesion: true }),
  misDatos: () => api.get<MisDatos>('/inscripcion/mis-datos'),

  listar: (filtros: { estado?: EstadoInscripcion; buscar?: string; colegio?: number; page?: number }) => {
    const qs = new URLSearchParams();
    if (filtros.estado) qs.set('estado', filtros.estado);
    if (filtros.colegio) qs.set('colegio', String(filtros.colegio));
    if (filtros.buscar) qs.set('buscar', filtros.buscar);
    if (filtros.page) qs.set('page', String(filtros.page));
    const sufijo = qs.toString();
    return api.get<ListaInscripciones>(`/inscripciones${sufijo ? `?${sufijo}` : ''}`);
  },
  detalle: (id: number) => api.get<InscripcionDetalle>(`/inscripciones/${id}`),
  documentosDeRepresentante: (usuId: number) =>
    api.get<DocumentoDeRepresentante[]>(`/inscripciones/representantes/${usuId}/documentos`),
  /** `mismos`: { insnino_id: nino_id } de los que el admin dijo que son el mismo alumno. */
  aprobar: (id: number, mismos: Record<number, number> = {}) =>
    api.post<ResultadoAprobacion>(`/inscripciones/${id}/aprobar`, { mismos }),
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
  ejemploPaquete: () =>
    api.descargar('/inscripciones/documentos/ejemplo', {}, 'inscripcion-ejemplo.pdf'),

  precios: () => api.get<PrecioColegio[]>('/inscripciones/precios'),
  guardarPrecio: (colId: number, datos: DatosPrecio) =>
    api.put<{ col_id: number }>(`/inscripciones/precios/${colId}`, datos),
  borrarPrecio: (colId: number) =>
    api.delete<{ col_id: number }>(`/inscripciones/precios/${colId}`),

  estado: () => api.get<EstadoInscripciones>('/inscripciones/estado'),
  abrir: (abiertas: boolean) => api.put<EstadoInscripciones>('/inscripciones/estado', { abiertas }),
  abrirColegio: (colId: number, abiertas: boolean) =>
    api.put<EstadoInscripciones>(`/inscripciones/estado/colegios/${colId}`, { abiertas }),

  config: () => api.get<ConfigInscripciones>('/inscripciones/config'),
  subirMembrete: (datos: { mime: string; base64: string }) =>
    api.put<{ membrete_propio: boolean }>('/inscripciones/config/membrete', datos),
  guardarCuentaBancaria: (texto: string) =>
    api.put<{ cuenta_bancaria: string | null }>('/inscripciones/config/cuenta-bancaria', { texto }),
  guardarMaxDisciplinas: (maximo: number) =>
    api.put<{ max_disciplinas: number }>('/inscripciones/config/max-disciplinas', { maximo }),
  restaurarMembrete: () =>
    api.delete<{ membrete_propio: boolean }>('/inscripciones/config/membrete'),
};

const MONEDA = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
export const dinero = (dolares: number) => MONEDA.format(dolares);

export const NOMBRE_DOCUMENTO: Record<TipoDocumento, string> = {
  ficha_matricula: 'Ficha de matrícula',
  contrato: 'Contrato',
  autorizacion_datos: 'Autorización de datos personales',
  datos_medicos: 'Información de salud',
  imagen: 'Uso de imagen',
  politica: 'Política de datos personales',
};
