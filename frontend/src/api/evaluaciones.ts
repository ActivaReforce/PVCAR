import { api } from '@/lib/api';

/**
 * Cliente de Evaluaciones.
 *
 * Dos partes: la **plantilla** (título, categoría, parámetros, a qué
 * disciplinas se aplica) y el **acto de evaluar** (los intentos de un alumno).
 *
 * El puntaje **nunca viaja desde aquí**: se manda lo que el evaluador registró
 * —un tiempo, un sí/no, un valor de escala o una puntuación Mobak— y el
 * servidor devuelve la nota ya calculada. En el sistema viejo la calculaba el
 * navegador y la base la aceptaba sin mirarla.
 */

/** Los cinco métodos de `evaluacion_tipo_metodo`. No cambian. */
export const METODO = {
  TIEMPO: 1,
  LOGRO: 2,
  ESCALA: 3,
  MOBAK_6: 4,
  MOBAK_2: 5,
} as const;

export interface MetodoEvaluacion {
  evatipometo_id: number;
  evatipometo_nombre: string;
}

export interface RangoTiempo {
  evatieran_op_cero: '<' | '<=' | '>' | '>=';
  evatieran_tiempo_cero: number;
  evatieran_op_full: '<' | '<=' | '>' | '>=';
  evatieran_tiempo_full: number;
}

export interface Evaluacion {
  eva_id: number;
  eva_titulo: string;
  eva_descripcion: string | null;
  eva_categoria: string | null;
  eva_puntaje_total: number;
  est_id: number;
  eva_fecha_creacion: string;
  eva_creador: number;
  creador: string;
  parametros: number;
  disciplinas: number;
  pendientes: number;
  evaluados: number;
}

export interface Parametro {
  evaparam_id: number;
  evaparam_nombre: string;
  evaparam_nota: string | null;
  evatipometo_id: number;
  evatipometo_nombre: string;
  evaparam_intentos: number;
  evaparam_puntaje: number;
  evaparam_escala_min: number | null;
  evaparam_escala_max: number | null;
  rango: RangoTiempo | null;
  /** Notas ya puestas contra este parámetro. Bloquea borrarlo y cambiarle el método. */
  intentos_registrados: number;
}

/** Lo que se manda al guardar un parámetro. Sin `evaparam_id` se crea. */
export interface ParametroInput {
  evaparam_id?: number;
  evaparam_nombre: string;
  evaparam_nota?: string;
  evatipometo_id: number;
  evaparam_intentos: number;
  evaparam_puntaje: number;
  evaparam_escala_min?: number | null;
  evaparam_escala_max?: number | null;
  rango?: RangoTiempo | null;
}

export interface ConteosEvaluaciones {
  total: number;
  activas: number;
  deBaja: number;
  sinDisciplinas: number;
}

export interface PaginaEvaluaciones {
  items: Evaluacion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  conteos: ConteosEvaluaciones;
}

export interface FichaEvaluacion {
  evaluacion: Evaluacion;
  parametros: Parametro[];
}

export interface FiltrosEvaluaciones {
  page?: number;
  limit?: number;
  buscar?: string;
  categoria?: string;
  estado?: number;
  sinDisciplinas?: boolean;
  orden?: 'titulo' | 'categoria' | 'puntaje' | 'creacion' | 'pendientes';
  dir?: 'asc' | 'desc';
}

export interface DatosEvaluacion {
  eva_titulo?: string;
  eva_descripcion?: string;
  eva_categoria?: string;
  parametros?: ParametroInput[];
}

export interface ImpactoEvaluacion {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

export interface DisciplinaVinculada {
  evaasig_id: number;
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_nombre: string;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  est_id: number;
  alumnos: number;
  pendientes: number;
  evaluados: number;
}

export interface DisciplinaDisponible {
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_nombre: string;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  alumnos: number;
  estuvo: boolean;
}

export interface ResultadoVinculo {
  vinculadas: number;
  desvinculadas: number;
  pendientesCreadas: number;
  pendientesDesactivadas: number;
  notasConservadas: number;
}

export interface DisciplinasDeEvaluacion {
  vinculadas: DisciplinaVinculada[];
  disponibles: DisciplinaDisponible[];
}

export interface AlumnoPendiente {
  evaninopen_id: number;
  nino_id: number;
  nino_nombre: string;
  nino_foto_url: string | null;
  catninograd_nombre: string | null;
  est_id: number;
  evaninopen_fecha_finalizacion: string | null;
  evaluado_por: string | null;
  puntaje: number;
  intentos_registrados: number;
}

export interface ListaPendientes {
  alumnos: AlumnoPendiente[];
  conteos: { total: number; pendientes: number; evaluados: number };
  eva_puntaje_total: number;
}

export interface IntentoGuardado {
  evaint_id: number;
  evaparam_id: number;
  evaint_intento: number;
  evaint_tiempo: number | null;
  evaint_logro: boolean | null;
  evaint_num: number | null;
  evaint_mobak: number | null;
  evaint_puntaje_obtenido: number;
}

export interface FichaDeEvaluacion {
  pendiente: {
    evaninopen_id: number;
    eva_id: number;
    eva_titulo: string;
    eva_puntaje_total: number;
    nino_id: number;
    nino_nombre: string;
    nino_foto_url: string | null;
    colacthor_id: number;
    col_id: number;
    col_nombre: string;
    act_nombre: string;
    est_id: number;
    evaninopen_fecha_finalizacion: string | null;
    evaluado_por: string | null;
  };
  parametros: Parametro[];
  intentos: IntentoGuardado[];
  puntaje: number;
}

/** Lo que el evaluador registra. Solo uno de los cuatro, según el método. */
export interface IntentoInput {
  evaparam_id: number;
  evaint_intento: number;
  tiempo?: number | null;
  logro?: boolean | null;
  escala?: number | null;
  mobak?: number | null;
}

function queryString(filtros: object): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === '' || valor === false) continue;
    params.set(clave, String(valor));
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

export const evaluacionesApi = {
  listar: (filtros: FiltrosEvaluaciones) =>
    api.get<PaginaEvaluaciones>(`/evaluaciones${queryString(filtros)}`),

  metodos: () => api.get<MetodoEvaluacion[]>('/evaluaciones/metodos'),

  categorias: () =>
    api.get<Array<{ categoria: string; evaluaciones: number }>>('/evaluaciones/categorias'),

  ficha: (id: number) => api.get<FichaEvaluacion>(`/evaluaciones/${id}`),

  crear: (datos: DatosEvaluacion) => api.post<FichaEvaluacion>('/evaluaciones', datos),

  actualizar: (id: number, datos: DatosEvaluacion) =>
    api.patch<FichaEvaluacion>(`/evaluaciones/${id}`, datos),

  guardarParametros: (id: number, parametros: ParametroInput[]) =>
    api.put<FichaEvaluacion>(`/evaluaciones/${id}/parametros`, { parametros }),

  darDeBaja: (id: number) => api.post<FichaEvaluacion>(`/evaluaciones/${id}/baja`),

  reactivar: (id: number) => api.post<FichaEvaluacion>(`/evaluaciones/${id}/reactivar`),

  impacto: (id: number) => api.get<ImpactoEvaluacion>(`/evaluaciones/${id}/impacto`),

  eliminar: (id: number, confirmacion: string) =>
    api.delete<ImpactoEvaluacion>(`/evaluaciones/${id}`, { confirmacion }),

  disciplinas: (id: number) =>
    api.get<DisciplinasDeEvaluacion>(`/evaluaciones/${id}/disciplinas`),

  guardarDisciplinas: (id: number, colacthorIds: number[]) =>
    api.put<DisciplinasDeEvaluacion & { resultado: ResultadoVinculo }>(
      `/evaluaciones/${id}/disciplinas`,
      { colacthor_ids: colacthorIds },
    ),

  pendientes: (evaluacion: number, disciplina: number, estado?: number, buscar?: string) =>
    api.get<ListaPendientes>(
      `/evaluaciones/pendientes${queryString({ evaluacion, disciplina, estado, buscar })}`,
    ),

  fichaDeAlumno: (evaninopenId: number) =>
    api.get<FichaDeEvaluacion>(`/evaluaciones/pendientes/${evaninopenId}`),

  guardarIntentos: (evaninopenId: number, intentos: IntentoInput[]) =>
    api.put<FichaDeEvaluacion>(`/evaluaciones/pendientes/${evaninopenId}/intentos`, { intentos }),

  borrarEvaluacionDeAlumno: (evaninopenId: number) =>
    api.delete<FichaDeEvaluacion>(`/evaluaciones/pendientes/${evaninopenId}`),
};
