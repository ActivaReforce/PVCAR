import { api } from '@/lib/api';

/**
 * Cliente de Asistencias.
 *
 * Dos pantallas contra el mismo módulo: la de alumnos (una disciplina y una
 * fecha) y la de entrenadores (un colegio y una fecha). Las dos guardan **por
 * lote**: el navegador manda la sesión entera y el backend la escribe en una
 * transacción. En el sistema viejo era un upsert por fila, encolado a mano.
 */

/** Los cuatro estados de `asistencia_estado`. No cambian. */
export const ESTADO_ASISTENCIA = {
  PRESENTE: 1,
  AUSENTE: 2,
  TARDE: 3,
  JUSTIFICADO: 4,
} as const;

export interface EstadoAsistencia {
  asisest_id: number;
  asisest_nombre: string;
}

export interface ContextoAsistencias {
  /** Hoy en Ecuador, según el servidor. */
  hoy: string;
  /** La hora de Ecuador, HH:MM. */
  hora: string;
}

export interface Sesion {
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_id: number;
  act_nombre: string;
  dia_id: number;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  est_id: number;
  entrenadores: string[];
}

export interface ResumenAsistencia {
  total: number;
  marcados: number;
  sinMarcar: number;
  presentes: number;
  ausentes: number;
  tardes: number;
  justificados: number;
}

export interface AlumnoDeSesion {
  nino_id: number;
  nino_nombre: string;
  nino_foto_url: string | null;
  catninograd_nombre: string | null;
  /** Falso cuando solo sale porque ya tenía marca esa fecha. */
  inscrito: boolean;
  asisest_id: number | null;
  hora_tarde: string | null;
  razon: string | null;
  registrado_en: string | null;
  registrado_por: string | null;
}

export interface ListaAlumnos {
  sesion: Sesion;
  fecha: string;
  alumnos: AlumnoDeSesion[];
  resumen: ResumenAsistencia;
  hora_servidor: string;
}

export interface PersonaDeColegio {
  tipo: 'entrenador' | 'auxiliar';
  id: number;
  usu_nombre: string;
  usu_foto_url: string | null;
  titular: string | null;
  imparte: string[];
  activo_hoy: boolean;
  asisest_id: number | null;
  hora_tarde: string | null;
  razon: string | null;
  registrado_en: string | null;
  registrado_por: string | null;
}

export interface ListaEntrenadores {
  colegio: { col_id: number; col_nombre: string };
  fecha: string;
  dia_id: number;
  personas: PersonaDeColegio[];
  resumen: ResumenAsistencia;
  hora_servidor: string;
}

export interface ResultadoGuardado {
  altas: number;
  cambios: number;
}

export interface MarcaAlumno {
  nino_id: number;
  asisest_id: number;
  hora_tarde?: string | null;
  razon?: string | null;
}

export interface MarcaPersona {
  tipo: 'entrenador' | 'auxiliar';
  id: number;
  asisest_id: number;
  hora_tarde?: string | null;
  razon?: string | null;
}

export interface DiaDeHistorial {
  fecha: string;
  total: number;
  presentes: number;
  ausentes: number;
  tardes: number;
  justificados: number;
}

export interface Historial {
  sesion: Sesion;
  dias: DiaDeHistorial[];
}

export const asistenciasApi = {
  estados: () => api.get<EstadoAsistencia[]>('/asistencias/estados'),

  contexto: () => api.get<ContextoAsistencias>('/asistencias/contexto'),

  alumnos: (disciplina: number, fecha: string) =>
    api.get<ListaAlumnos>(`/asistencias/alumnos?disciplina=${disciplina}&fecha=${fecha}`),

  guardarAlumnos: (colacthorId: number, fecha: string, marcas: MarcaAlumno[]) =>
    api.put<ListaAlumnos & { resultado: ResultadoGuardado }>('/asistencias/alumnos', {
      colacthor_id: colacthorId,
      fecha,
      marcas,
    }),

  entrenadores: (colegio: number, fecha: string) =>
    api.get<ListaEntrenadores>(`/asistencias/entrenadores?colegio=${colegio}&fecha=${fecha}`),

  guardarEntrenadores: (colId: number, fecha: string, marcas: MarcaPersona[]) =>
    api.put<ListaEntrenadores & { resultado: ResultadoGuardado }>('/asistencias/entrenadores', {
      col_id: colId,
      fecha,
      marcas,
    }),

  historial: (disciplina: number, desde: string, hasta: string) =>
    api.get<Historial>(
      `/asistencias/historial?disciplina=${disciplina}&desde=${desde}&hasta=${hasta}`,
    ),
};
