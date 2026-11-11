import { api } from '@/lib/api';

/**
 * Comunicados (2026-11-11): correos masivos por Resend Broadcasts sin entrar
 * a Resend. Solo el rol Propietario; el backend lo comprueba.
 */

export const MAX_DESTINATARIOS = 1000;
export const MARCADOR = '{{contenido}}';

export interface Contacto {
  comcon_id: number;
  comcon_nombre: string;
  comcon_correo: string;
  comcon_fecha_creacion: string;
  segmentos: Array<{ id: number; nombre: string }>;
  /** Nombre del representante con el mismo correo, si lo hay. */
  representante: string | null;
}

export interface Segmento {
  comseg_id: number;
  comseg_nombre: string;
  contactos: number;
}

export interface RepresentanteCom {
  usu_id: number;
  usu_nombre: string;
  correo: string;
  hijos: Array<{ nombre: string; colegio: string; curso: string | null }>;
}

export interface Opciones {
  colegios: Array<{ id: number; nombre: string }>;
  cursos: Array<{ id: number; nombre: string }>;
  disciplinas: Array<{ id: number; col_id: number; nombre: string; horario: string | null }>;
}

export interface Plantilla {
  complan_id: number;
  complan_nombre: string;
  complan_html: string;
  complan_fecha_modificacion: string;
}

export interface FiltroRepresentantes {
  colegio: number | null;
  curso: number | null;
  disciplina: number | null;
}

export type Destino =
  | { tipo: 'contactos' }
  | { tipo: 'segmento'; segmento: number }
  | ({ tipo: 'representantes' } & FiltroRepresentantes);

export type EstadoVisible = 'borrador' | 'enviando' | 'enviado' | 'fallido';

export interface ComunicadoListado {
  com_id: number;
  com_asunto: string;
  estado: EstadoVisible;
  com_destino_texto: string | null;
  com_total: number | null;
  com_error: string | null;
  complan_id: number | null;
  plantilla_nombre: string | null;
  autor: string | null;
  com_fecha_creacion: string;
  com_fecha_modificacion: string;
  com_fecha_envio: string | null;
  com_fecha_fin: string | null;
}

export interface Comunicado extends ComunicadoListado {
  com_cuerpo: string;
  com_modo: 'visual' | 'html';
  com_destinos: Destino[];
  com_html: string | null;
}

export interface ComunicadoInput {
  asunto: string;
  cuerpo: string;
  modo: 'visual' | 'html';
  plantilla: number | null;
  destinos: Destino[];
}

export interface FilaContacto {
  nombre: string;
  correo: string;
}

export interface RevisionImportacion {
  nuevos: FilaContacto[];
  repetidosArchivo: Array<FilaContacto & { fila: number }>;
  yaContactos: FilaContacto[];
  yaRepresentantes: Array<FilaContacto & { representante: string }>;
  invalidos: Array<{ fila: number; texto: string }>;
}

const queryString = (params: Record<string, string | number | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const comunicadosApi = {
  opciones: () => api.get<Opciones>('/comunicados/opciones'),

  contactos: (f: { buscar?: string; segmento?: number | null }) =>
    api.get<{ contactos: Contacto[]; total: number }>(`/comunicados/contactos${queryString({ buscar: f.buscar, segmento: f.segmento })}`),
  crearContacto: (d: { nombre: string; correo: string; forzar?: boolean }) =>
    api.post<{ id: number }>('/comunicados/contactos', d),
  editarContacto: (id: number, d: { nombre: string; correo: string; forzar?: boolean }) =>
    api.put<{ id: number }>(`/comunicados/contactos/${id}`, d),
  borrarContactos: (ids: number[]) => api.post<{ borrados: number }>('/comunicados/contactos/borrar', { ids }),
  revisarImportacion: (nombre: string, contenido: string) =>
    api.post<RevisionImportacion>('/comunicados/contactos/importar/revisar', { nombre, contenido }),
  importar: (d: { filas: FilaContacto[]; segmento: number | null; segmentoNuevo: string | null }) =>
    api.post<{ nuevos: number; enSegmento: number }>('/comunicados/contactos/importar', d),

  segmentos: () => api.get<Segmento[]>('/comunicados/segmentos'),
  crearSegmento: (nombre: string) => api.post<{ id: number }>('/comunicados/segmentos', { nombre }),
  renombrarSegmento: (id: number, nombre: string) => api.put<{ id: number }>(`/comunicados/segmentos/${id}`, { nombre }),
  borrarSegmento: (id: number) => api.delete<{ id: number }>(`/comunicados/segmentos/${id}`),
  anadirASegmento: (id: number, ids: number[]) =>
    api.post<{ anadidos: number }>(`/comunicados/segmentos/${id}/anadir`, { ids }),
  quitarDeSegmento: (id: number, ids: number[]) =>
    api.post<{ quitados: number }>(`/comunicados/segmentos/${id}/quitar`, { ids }),

  representantes: (f: Partial<FiltroRepresentantes> & { buscar?: string }) =>
    api.get<RepresentanteCom[]>(`/comunicados/representantes${queryString(f)}`),

  plantillas: () => api.get<Plantilla[]>('/comunicados/plantillas'),
  crearPlantilla: (d: { nombre: string; html: string }) => api.post<{ id: number }>('/comunicados/plantillas', d),
  editarPlantilla: (id: number, d: { nombre: string; html: string }) =>
    api.put<{ id: number }>(`/comunicados/plantillas/${id}`, d),
  borrarPlantilla: (id: number) => api.delete<{ id: number }>(`/comunicados/plantillas/${id}`),

  listar: () => api.get<ComunicadoListado[]>('/comunicados'),
  obtener: (id: number) => api.get<Comunicado>(`/comunicados/${id}`),
  crear: (d: ComunicadoInput) => api.post<{ id: number }>('/comunicados', d),
  editar: (id: number, d: ComunicadoInput) => api.put<{ id: number }>(`/comunicados/${id}`, d),
  borrar: (id: number) => api.delete<{ id: number }>(`/comunicados/${id}`),
  contar: (destinos: Destino[]) =>
    api.post<{ total: number; porGrupo: number[]; maximo: number }>('/comunicados/contar', { destinos }),
  prueba: (d: { asunto: string; cuerpo: string; plantilla: number | null; correo: string }) =>
    api.post<{ enviado: boolean }>('/comunicados/prueba', d),
  enviar: (id: number) => api.post<{ id: number; total: number; destino: string }>(`/comunicados/${id}/enviar`),
};
