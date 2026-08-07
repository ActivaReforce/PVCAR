import { api } from '@/lib/api';
import type { SubidaFirmada, UsuarioDetalle } from './usuarios';

/**
 * Perfil propio. El sujeto siempre sale del token, nunca de un id en la URL:
 * por esta puerta no se puede editar a otro.
 */
export const perfilApi = {
  obtener: () => api.get<UsuarioDetalle>('/api/v1/perfil'),

  actualizar: (datos: { usu_telefono?: string; usu_foto?: string | null }) =>
    api.patch<UsuarioDetalle>('/api/v1/perfil', datos),

  urlDeSubida: (mimeType: string) => api.post<SubidaFirmada>('/api/v1/perfil/foto', { mimeType }),
};
