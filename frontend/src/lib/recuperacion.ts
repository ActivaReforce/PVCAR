/**
 * De dónde vino quien pidió recuperar la contraseña. Un representante que lo
 * pide desde /inscripcion no conoce el login de la plataforma: al terminar
 * tiene que volver a la inscripción (cliente, 2026-10-07).
 *
 * Se guarda en el navegador porque el enlace del correo no lo puede llevar
 * (la URL de vuelta tiene que estar en la lista blanca de Supabase). Si abre
 * el correo en otro dispositivo, no se sabe: se ofrecen las dos salidas.
 */
const CLAVE = 'pvcar.recuperacion.desde';

export type OrigenRecuperacion = 'inscripcion' | 'plataforma';

export function recordarOrigen(origen: OrigenRecuperacion): void {
  try {
    localStorage.setItem(CLAVE, origen);
  } catch {
    // Sin almacenamiento: se ofrecerán las dos salidas.
  }
}

export function origenRecordado(): OrigenRecuperacion | null {
  try {
    const v = localStorage.getItem(CLAVE);
    return v === 'inscripcion' || v === 'plataforma' ? v : null;
  } catch {
    return null;
  }
}

export function olvidarOrigen(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que hacer.
  }
}
