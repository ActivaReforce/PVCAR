/** Formatos de fecha y contacto que comparten las pantallas de Inscripciones. */

import { ZONA } from '@/lib/fecha';

export function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: ZONA,
  }).format(new Date(iso));
}

export function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: ZONA }).format(
    new Date(iso),
  );
}

/** AAAA-MM-DD sin que la zona horaria lo mueva un día atrás. */
export function fechaNacimiento(aaaammdd: string): string {
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${aaaammdd}T00:00:00Z`),
  );
}

/**
 * Enlace de WhatsApp para un teléfono de Ecuador. "0991234567" pasa a
 * 593991234567; uno que ya trae prefijo internacional se deja como está.
 * Si no parece un móvil, no hay enlace.
 */
export function enlaceWhatsApp(telefono: string): string | null {
  let digitos = telefono.replace(/\D/g, '');
  if (digitos.length === 10 && digitos.startsWith('09')) digitos = `593${digitos.slice(1)}`;
  if (digitos.length < 11) return null;
  return `https://wa.me/${digitos}`;
}
