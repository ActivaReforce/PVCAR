import { api } from '@/lib/api';

/**
 * Cliente de Encuestas.
 *
 * Dos mitades con puertas distintas: `/encuestas/mias/*` lo usa el
 * **representante**, que no tiene el permiso del módulo; el resto lo usa quien
 * gestiona. Esa separación es del backend, aquí solo se refleja.
 */

/** Los seis tipos de `encuesta_tipo_respuesta`. */
export const TIPO = {
  TEXTO_CORTO: 1,
  TEXTO_LARGO: 2,
  ESCALA: 3,
  FECHA: 4,
  HORA: 5,
  SI_NO: 6,
} as const;

/** Los tres estados del catálogo que significan algo para una encuesta. */
export const ESTADO_ENCUESTA = {
  BORRADOR: 3,
  FINALIZADO: 4,
  PUBLICADO: 5,
} as const;

export interface TipoRespuesta {
  encutiporesp_id: number;
  encutiporesp_nombre: string;
}

export interface Encuesta {
  encu_id: number;
  encu_titulo: string;
  encu_descripcion: string | null;
  est_id: number;
  encu_creador: number;
  creador: string;
  encu_fecha_creacion: string;
  preguntas: number;
  respondidas: number;
  /** Representantes activos con ficha: el denominador de la proporción. */
  representantes: number;
}

export interface Pregunta {
  encupreg_id: number;
  encupreg_orden: number;
  encupreg_pregunta: string;
  encupreg_nota: string | null;
  encutiporesp_id: number;
  encutiporesp_nombre: string;
  encupreg_escala_min: number | null;
  encupreg_escala_max: number | null;
  respuestas: number;
}

/** Lo que se manda al guardar. El orden es la posición en el array. */
export interface PreguntaInput {
  encupreg_id?: number;
  encupreg_pregunta: string;
  encupreg_nota?: string;
  encutiporesp_id: number;
  encupreg_escala_min?: number | null;
  encupreg_escala_max?: number | null;
}

export interface FichaEncuesta {
  encuesta: Encuesta;
  preguntas: Pregunta[];
}

export interface ResultadoPregunta {
  encupreg_id: number;
  encupreg_orden: number;
  encupreg_pregunta: string;
  encutiporesp_id: number;
  encutiporesp_nombre: string;
  respuestas: number;
  promedio: number | null;
  conteos: Array<{ etiqueta: string; valor: number }>;
  textos: string[];
}

export interface Resultados {
  encuesta: Encuesta;
  preguntas: ResultadoPregunta[];
}

export interface ImpactoEncuesta {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

export interface MiEncuesta {
  encu_id: number;
  encu_titulo: string;
  encu_descripcion: string | null;
  preguntas: number;
  respondida: boolean;
  encurespo_fecha_registro: string | null;
}

export interface EncuestaParaContestar {
  encuesta: Encuesta;
  preguntas: Pregunta[];
  yaRespondida: boolean;
}

/** Una respuesta lleva solo el campo de su tipo; el resto van vacíos. */
export interface RespuestaInput {
  encupreg_id: number;
  texto?: string | null;
  numero?: number | null;
  fecha?: string | null;
  hora?: string | null;
  sino?: boolean | null;
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

export const encuestasApi = {
  listar: (filtros: { buscar?: string; estado?: number }) =>
    api.get<Encuesta[]>(`/encuestas${queryString(filtros)}`),

  tipos: () => api.get<TipoRespuesta[]>('/encuestas/tipos'),

  ficha: (id: number) => api.get<FichaEncuesta>(`/encuestas/${id}`),

  crear: (datos: { encu_titulo: string; encu_descripcion?: string; preguntas?: PreguntaInput[] }) =>
    api.post<FichaEncuesta>('/encuestas', datos),

  actualizar: (id: number, datos: { encu_titulo?: string; encu_descripcion?: string }) =>
    api.patch<FichaEncuesta>(`/encuestas/${id}`, datos),

  guardarPreguntas: (id: number, preguntas: PreguntaInput[]) =>
    api.put<FichaEncuesta>(`/encuestas/${id}/preguntas`, { preguntas }),

  finalizar: (id: number) => api.post<FichaEncuesta>(`/encuestas/${id}/finalizar`),
  volverABorrador: (id: number) => api.post<FichaEncuesta>(`/encuestas/${id}/borrador`),
  publicar: (id: number) => api.post<FichaEncuesta>(`/encuestas/${id}/publicar`),

  resultados: (id: number) => api.get<Resultados>(`/encuestas/${id}/resultados`),
  impacto: (id: number) => api.get<ImpactoEncuesta>(`/encuestas/${id}/impacto`),

  eliminar: (id: number, confirmacion: string) =>
    api.delete<ImpactoEncuesta>(`/encuestas/${id}`, { confirmacion }),

  // --- El lado del representante ---
  mias: () => api.get<MiEncuesta[]>('/encuestas/mias'),
  paraResponder: (id: number) => api.get<EncuestaParaContestar>(`/encuestas/mias/${id}`),
  responder: (id: number, respuestas: RespuestaInput[]) =>
    api.post<{ registradas: number }>(`/encuestas/mias/${id}/responder`, { respuestas }),
};

export const NOMBRE_ESTADO: Record<number, string> = {
  [ESTADO_ENCUESTA.BORRADOR]: 'Borrador',
  [ESTADO_ENCUESTA.FINALIZADO]: 'Finalizada',
  [ESTADO_ENCUESTA.PUBLICADO]: 'Publicada',
};
