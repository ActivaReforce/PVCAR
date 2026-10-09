import { api } from '@/lib/api';

/**
 * Configuración de correos (2026-10-07): quién envía cada tipo y a quién va
 * en copia. Solo Propietario; el backend lo comprueba.
 */

/** inscripciones: aprobada, al representante. inscripciones_aviso: nueva, al equipo. novedades: punto 8. */
export type TipoCorreo = 'inscripciones' | 'inscripciones_aviso' | 'novedades';

export interface ConfigCorreo {
  tipo: TipoCorreo;
  nombre: string;
  /** Lo de antes de la arroba. */
  usuario: string;
  /** Destinatarios fijos: solo en los avisos internos y en novedades. */
  para: string[];
  cc: string[];
  responder_a: string | null;
  /** Solo para 'novedades': ¿avisar también al mencionado o representante? */
  notificar_mencionado: boolean;
  /** El dominio verificado (CORREO_DOMINIO de Railway). null si falta. */
  dominio: string | null;
}

export type ConfigCorreoInput = Pick<
  ConfigCorreo,
  'nombre' | 'usuario' | 'para' | 'cc' | 'responder_a' | 'notificar_mencionado'
>;

export const correosApi = {
  obtener: (tipo: TipoCorreo) => api.get<ConfigCorreo>(`/correos/${tipo}`),
  guardar: (tipo: TipoCorreo, datos: ConfigCorreoInput) => api.put<ConfigCorreo>(`/correos/${tipo}`, datos),
};
