import { api } from '@/lib/api';

/**
 * Cliente del modulo de usuarios.
 *
 * Los tipos los define el backend y aqui se copian tal cual. En el sistema
 * viejo los tipos salian del generador de Supabase y se escapaban con `any`
 * en cuanto habia un join anidado (114 `: any` en la aplicacion).
 */

export interface RolResumen {
  rol_id: number;
  rol_nombre: string;
  rol_titulo: string;
}

export interface Rol extends RolResumen {
  rol_descripcion: string | null;
}

export interface UsuarioListado {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  usu_telefono: string | null;
  usu_foto: string | null;
  /** URL firmada, valida una hora. Es la unica que sirve para pintar. */
  usu_foto_url: string | null;
  usu_fecha_creacion: string | null;
  est_id: number;
  roles: RolResumen[];
}

export interface UsuarioDetalle extends UsuarioListado {
  auth_user_id: string | null;
  usu_fecha_modificacion: string | null;
  ent_cedula: string | null;
  ent_est_id: number | null;
  padre_id: number | null;
  padre_sector_residencia: string | null;
}

export interface ConteosUsuarios {
  total: number;
  activos: number;
  inactivos: number;
  /** Usuarios por rol, contados en SQL: { "3": 49 }. */
  porRol: Record<string, number>;
}

export interface PaginaUsuarios {
  items: UsuarioListado[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  conteos: ConteosUsuarios;
}

export interface FiltrosUsuarios {
  page?: number;
  limit?: number;
  buscar?: string;
  /** Varios roles a la vez; viaja como ?rol=2,3. */
  rol?: number[];
  estado?: number;
  orden?: 'nombre' | 'correo' | 'creacion' | 'estado';
  dir?: 'asc' | 'desc';
}

export interface ImpactoEliminacion {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

export interface SubidaFirmada {
  path: string;
  signedUrl: string;
  token: string;
}

export interface DatosUsuario {
  usu_nombre?: string;
  usu_correo?: string;
  usu_telefono?: string;
  password?: string;
  roles?: number[];
  ent_cedula?: string;
  padre_sector_residencia?: string;
  usu_foto?: string | null;
}

function queryString(filtros: FiltrosUsuarios): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === '') continue;
    if (Array.isArray(valor)) {
      if (valor.length > 0) params.set(clave, valor.join(','));
      continue;
    }
    params.set(clave, String(valor));
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

export const usuariosApi = {
  listar: (filtros: FiltrosUsuarios) =>
    api.get<PaginaUsuarios>(`/api/v1/usuarios${queryString(filtros)}`),

  roles: () => api.get<Rol[]>('/api/v1/usuarios/roles'),

  obtener: (id: number) => api.get<UsuarioDetalle>(`/api/v1/usuarios/${id}`),

  crear: (datos: DatosUsuario) => api.post<UsuarioDetalle>('/api/v1/usuarios', datos),

  actualizar: (id: number, datos: DatosUsuario) =>
    api.patch<UsuarioDetalle>(`/api/v1/usuarios/${id}`, datos),

  darDeBaja: (id: number) => api.post<UsuarioDetalle>(`/api/v1/usuarios/${id}/baja`),

  reactivar: (id: number) => api.post<UsuarioDetalle>(`/api/v1/usuarios/${id}/reactivar`),

  impacto: (id: number) => api.get<ImpactoEliminacion>(`/api/v1/usuarios/${id}/impacto`),

  /**
   * El nombre escrito por quien confirma viaja al servidor: la comprobacion
   * la hace el backend, no el modal.
   */
  eliminar: (id: number, confirmacion: string) =>
    api.delete<ImpactoEliminacion>(`/api/v1/usuarios/${id}`, { confirmacion }),

  urlDeSubida: (mimeType: string) =>
    api.post<SubidaFirmada>('/api/v1/usuarios/foto', { mimeType }),
};
