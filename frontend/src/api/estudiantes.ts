import { api } from '@/lib/api';

/**
 * Cliente de Estudiantes.
 *
 * 796 alumnos y 1672 inscripciones: la lista **siempre** viene paginada del
 * servidor. El sistema viejo se traía los 796 con sus padres, su colegio y su
 * grado anidados —y la contraseña del padre dentro— para luego filtrar y
 * contar en el navegador.
 */

export interface Estudiante {
  nino_id: number;
  nino_nombre: string;
  nino_edad: number | null;
  nino_foto: string | null;
  nino_foto_url: string | null;
  col_id: number;
  col_nombre: string;
  catninograd_id: number | null;
  catninograd_nombre: string | null;
  est_id: number;
  nino_fecha_creacion: string | null;
  disciplinas: number;
  representantes: number;
}

/** La ficha trae lo sensible; la lista, no. */
export interface EstudianteDetalle extends Estudiante {
  nino_cedula: string | null;
  nino_toma_transporte: boolean | null;
  nino_info_salud: string | null;
  nino_otra_info: string | null;
  nino_fecha_modificacion: string | null;
}

export interface Inscripcion {
  ninoasig_id: number;
  colacthor_id: number;
  col_id: number;
  col_nombre: string;
  act_nombre: string;
  dia_id: number;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  ninoasig_fecha_inscripcion: string;
  ninoasig_fecha_baja: string | null;
  est_id: number;
  disciplina_est_id: number;
  entrenador: string | null;
}

export interface Representante {
  ninopadre_id: number;
  padre_id: number;
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  usu_telefono: string | null;
  padre_sector_residencia: string | null;
  usuario_activo: boolean;
}

export interface FichaEstudiante {
  estudiante: EstudianteDetalle;
  inscripciones: Inscripcion[];
  representantes: Representante[];
}

export interface ConteosEstudiantes {
  total: number;
  activos: number;
  inactivos: number;
  sinAsignar: number;
}

export interface PaginaEstudiantes {
  items: Estudiante[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  conteos: ConteosEstudiantes;
}

export interface FiltrosEstudiantes {
  page?: number;
  limit?: number;
  buscar?: string;
  colegio?: number[];
  disciplina?: number;
  sinAsignar?: boolean;
  grado?: number;
  estado?: number;
  orden?: 'nombre' | 'colegio' | 'grado' | 'edad' | 'creacion';
  dir?: 'asc' | 'desc';
}

export interface DisciplinaDisponible {
  colacthor_id: number;
  act_nombre: string;
  dia_id: number;
  dia_nombre: string;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  alumnos: number;
  entrenador: string | null;
  /** Ya estuvo inscrito antes: reinscribirlo reabre su fila y sus evaluaciones. */
  fue_inscrito: boolean;
}

export interface Grado {
  catninograd_id: number;
  catninograd_nombre: string;
  estudiantes: number;
}

export interface CandidatoRepresentante {
  usu_id: number;
  padre_id: number;
  usu_nombre: string;
  usu_correo: string;
}

export interface ImpactoEstudiante {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

export interface DatosEstudiante {
  nino_nombre?: string;
  col_id?: number;
  catninograd_id?: number | null;
  nino_edad?: number | null;
  nino_cedula?: string;
  nino_toma_transporte?: boolean;
  nino_info_salud?: string;
  nino_otra_info?: string;
  nino_foto?: string | null;
  disciplinas?: number[];
}

export interface SubidaFirmada {
  path: string;
  signedUrl: string;
  token: string;
}

function queryString(filtros: Record<string, unknown> | FiltrosEstudiantes): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros as Record<string, unknown>)) {
    if (valor === undefined || valor === null || valor === '' || valor === false) continue;
    if (Array.isArray(valor)) {
      if (valor.length > 0) params.set(clave, valor.join(','));
      continue;
    }
    params.set(clave, String(valor));
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

export const estudiantesApi = {
  listar: (filtros: FiltrosEstudiantes) =>
    api.get<PaginaEstudiantes>(`/estudiantes${queryString(filtros)}`),

  grados: () => api.get<Grado[]>('/estudiantes/grados'),

  ficha: (id: number, historial = false) =>
    api.get<FichaEstudiante>(`/estudiantes/${id}${historial ? '?historial=true' : ''}`),

  disponibles: (id: number) =>
    api.get<DisciplinaDisponible[]>(`/estudiantes/${id}/disponibles`),

  crear: (datos: DatosEstudiante) => api.post<EstudianteDetalle>('/estudiantes', datos),

  actualizar: (id: number, datos: DatosEstudiante) =>
    api.patch<EstudianteDetalle>(`/estudiantes/${id}`, datos),

  /** La lista completa de disciplinas activas que debe tener. */
  inscripciones: (id: number, colacthor_ids: number[]) =>
    api.put<Inscripcion[]>(`/estudiantes/${id}/inscripciones`, { colacthor_ids }),

  darDeBaja: (id: number) => api.post<EstudianteDetalle>(`/estudiantes/${id}/baja`),

  reactivar: (id: number) => api.post<EstudianteDetalle>(`/estudiantes/${id}/reactivar`),

  impacto: (id: number) => api.get<ImpactoEstudiante>(`/estudiantes/${id}/impacto`),

  eliminar: (id: number, confirmacion: string) =>
    api.delete<ImpactoEstudiante>(`/estudiantes/${id}`, { confirmacion }),

  candidatosRepresentante: () =>
    api.get<CandidatoRepresentante[]>('/estudiantes/candidatos-representante'),

  atarRepresentante: (id: number, usu_id: number) =>
    api.post<Representante[]>(`/estudiantes/${id}/representantes`, { usu_id }),

  soltarRepresentante: (id: number, ninopadreId: number) =>
    api.delete<Representante[]>(`/estudiantes/${id}/representantes/${ninopadreId}`),

  urlDeSubida: (mimeType: string) => api.post<SubidaFirmada>('/estudiantes/foto', { mimeType }),
};
