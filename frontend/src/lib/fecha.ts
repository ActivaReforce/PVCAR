/**
 * Fechas en hora de Ecuador, sea cual sea el reloj del navegador.
 *
 * `new Date().toISOString().slice(0, 10)` da la fecha en UTC: de 19:00 a 23:59
 * en Ecuador ya es "mañana". Y `new Date('2026-10-07')` es la medianoche UTC,
 * que en Ecuador se enseña como el 6. Toda fecha de pantalla pasa por aquí.
 */

export const ZONA = 'America/Guayaquil';

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` de hoy en Ecuador. */
export function hoyEc(): string {
  // en-CA escribe las fechas como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
}

/** `YYYY-MM-DD` de hace `dias` días, contando desde hoy en Ecuador. */
export function haceDiasEc(dias: number): string {
  const d = new Date(`${hoyEc()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

/**
 * `HH:MM` de ahora mismo en Ecuador. Se usa al pulsar "Tarde": la hora del
 * alumno que acaba de llegar es la de **este** momento, no la del `GET` que
 * cargó la lista hace diez minutos. El reloj es el del teléfono porque los
 * móviles están sincronizados; si uno no lo está, el entrenador puede editar.
 */
export function horaEcAhora(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

/**
 * Día legible (dd/mm/aaaa) de una columna `date` ("2026-10-07") o de una
 * marca con hora ("2026-10-08T02:30:00Z", que en Ecuador fue el 7).
 */
export function fechaDia(valor: string | null | undefined): string {
  if (!valor) return '—';
  const soloFecha = SOLO_FECHA.test(valor);
  const d = new Date(soloFecha ? `${valor}T00:00:00Z` : valor);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    // Una fecha sin hora no tiene zona: se lee tal cual.
    timeZone: soloFecha ? 'UTC' : ZONA,
  }).format(d);
}
