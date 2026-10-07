import { api } from '@/lib/api';

/**
 * Configuración de correos (2026-10-07): quién envía cada tipo y a quién va
 * en copia. Solo Propietario; el backend lo comprueba.
 */

/** inscripciones: aprobada, al representante. inscripciones_aviso: nueva, al equipo. */
export type TipoCorreo = 'inscripciones' | 'inscripciones_aviso';

export interface ConfigCorreo {
  tipo: TipoCorreo;
  nombre: string;
  /** Lo de antes de la arroba. */
  usuario: string;
  /** Destinatarios fijos: solo en los avisos internos. */
  para: string[];
  cc: string[];
  responder_a: string | null;
  /** El dominio verificado (CORREO_DOMINIO de Railway). null si falta. */
  dominio: string | null;
}

export type ConfigCorreoInput = Pick<ConfigCorreo, 'nombre' | 'usuario' | 'para' | 'cc' | 'responder_a'>;

export const correosApi = {
  obtener: (tipo: TipoCorreo) => api.get<ConfigCorreo>(`/correos/${tipo}`),
  guardar: (tipo: TipoCorreo, datos: ConfigCorreoInput) => api.put<ConfigCorreo>(`/correos/${tipo}`, datos),
};
