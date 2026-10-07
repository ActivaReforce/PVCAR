import { api } from '@/lib/api';

/** Un entrenador al que respalda el usuario (si es Asistente o Respaldo). */
export interface Titular {
  ent_id: number;
  usu_nombre: string;
}

export const titularesApi = {
  /** Vacío si no respalda a nadie. Con dos o más, la cabecera ofrece el selector. */
  mios: () => api.get<Titular[]>('/me/titulares'),
};
