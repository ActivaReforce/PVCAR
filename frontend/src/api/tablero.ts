import { api } from '@/lib/api';

/**
 * Cliente del Tablero.
 *
 * Un solo endpoint devuelve **qué tableros puede ver quien pregunta** y los
 * datos de uno de ellos. El sistema viejo tenía cuatro hooks distintos, cada
 * uno con entre 9 y 14 consultas a Supabase, y la pantalla elegía uno con una
 * cadena de `if` sobre los roles.
 */

export type TableroId = 'general' | 'coordinador' | 'entrenador' | 'representante';

export interface Asistencia {
  total: number;
  presente: number;
  ausente: number;
  tarde: number;
  justificado: number;
}

export interface TableroGeneral {
  colegios: number;
  usuarios: number;
  actividades: number;
  disciplinas: number;
  estudiantes: number;
  evaluaciones: number;
  evaluacionesPendientes: number;
  encuestasPublicadas: number;
  asistenciaAlumnos: Asistencia;
  asistenciaEntrenadores: Asistencia;
}

export interface ColegioDelCoordinador {
  col_id: number;
  col_nombre: string;
  disciplinas: number;
  estudiantes: number;
  entrenadores: number;
}

export interface TableroCoordinador {
  colegios: ColegioDelCoordinador[];
  evaluacionesAsignadas: number;
  evaluacionesPendientes: number;
  asistenciaAlumnos: Asistencia;
  asistenciaEntrenadores: Asistencia;
}

export interface DisciplinaDelEntrenador {
  colacthor_id: number;
  act_nombre: string;
  col_nombre: string;
  dia_nombre: string;
  hora: string | null;
  alumnos: number;
  pendientes: number;
}

export interface TableroEntrenador {
  disciplinas: DisciplinaDelEntrenador[];
  estudiantes: number;
  evaluacionesPendientes: number;
  asistenciaAlumnos: Asistencia;
  miAsistencia: Asistencia;
}

export interface HijoDelRepresentante {
  nino_id: number;
  nino_nombre: string;
  col_nombre: string | null;
  catninograd_nombre: string | null;
  disciplinas: Array<{ act_nombre: string; dia_nombre: string; hora: string | null }>;
  asistencia: Asistencia;
  evaluacionesPendientes: number;
  evaluacionesHechas: number;
  puntaje: number;
}

export interface TableroRepresentante {
  hijos: HijoDelRepresentante[];
}

export interface PuntoTendencia {
  fecha: string;
  tasa: number;
  registros: number;
}

export interface RespuestaTablero {
  disponibles: Array<{ id: TableroId; titulo: string }>;
  actual: TableroId | null;
  periodo: { desde: string; hasta: string };
  /** % de presentes por fecha del periodo. Vacío en el tablero del representante. */
  tendencia: PuntoTendencia[];
  datos:
    | TableroGeneral
    | TableroCoordinador
    | TableroEntrenador
    | TableroRepresentante
    | null;
}

export const tableroApi = {
  cargar: (rol?: TableroId, desde?: string, hasta?: string) => {
    const params = new URLSearchParams();
    if (rol) params.set('rol', rol);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    const cola = params.toString();
    return api.get<RespuestaTablero>(`/tablero${cola ? `?${cola}` : ''}`);
  },
};

/** El porcentaje de un estado dentro del total del periodo. */
export function porcentaje(asistencia: Asistencia, clave: keyof Asistencia): number {
  if (asistencia.total === 0) return 0;
  return Math.round((asistencia[clave] / asistencia.total) * 100);
}
