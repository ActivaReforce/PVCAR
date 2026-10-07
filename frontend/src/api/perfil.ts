import { api } from '@/lib/api';
import type { SubidaFirmada, UsuarioDetalle } from './usuarios';

/**
 * Perfil propio. El sujeto siempre sale del token, nunca de un id en la URL:
 * por esta puerta no se puede editar a otro.
 */
export const perfilApi = {
  obtener: () => api.get<UsuarioDetalle>('/perfil'),

  actualizar: (datos: { usu_nombre?: string; usu_telefono?: string; usu_foto?: string | null }) =>
    api.patch<UsuarioDetalle>('/perfil', datos),

  /** Lo que tiene a cargo según sus roles. */
  resumen: () => api.get<ResumenPerfil>('/perfil/resumen'),

  urlDeSubida: (mimeType: string) => api.post<SubidaFirmada>('/perfil/foto', { mimeType }),
};

export interface ResumenPerfil {
  colegios: Array<{ col_id: number; col_nombre: string }>;
  disciplinas: Array<{ colacthor_id: number; act_nombre: string; col_nombre: string; horario: string | null; alumnos: number }>;
  titulares: Array<{ ent_id: number; usu_nombre: string }>;
  hijos: Array<{ nino_id: number; nombre: string; col_nombre: string; disciplinas: Array<{ actividad: string; horario: string }> }>;
}
