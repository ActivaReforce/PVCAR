/**
 * Fechas en hora de Ecuador.
 *
 * La base trabaja en UTC (`TimeZone = UTC` en Supabase) y el contenedor de
 * Railway tambien. Ecuador va 5 horas por detras y sin horario de verano: de
 * 19:00 a 23:59 en Guayaquil, UTC ya es "manana". Un `CURRENT_DATE`, un
 * `marca::date` o un `to_char(marca, ...)` sin zona daban la fecha del dia
 * siguiente a todo lo que se hacia de noche.
 *
 * Regla: ninguna fecha "de hoy" ni ninguna fecha sacada de un `timestamptz`
 * se calcula sin pasar por aqui.
 */

export const ZONA = 'America/Guayaquil';

/** SQL: la fecha de hoy en Ecuador. Sustituye a `CURRENT_DATE`. */
export const HOY_EC = `(now() AT TIME ZONE '${ZONA}')::date`;

/** SQL: el dia en Ecuador de una marca `timestamptz`. Sustituye a `marca::date`. */
export const diaEc = (expr: string) => `(${expr} AT TIME ZONE '${ZONA}')::date`;

/** SQL: `to_char` de una marca `timestamptz` en hora de Ecuador. */
export const textoEc = (expr: string, formato: string) =>
  `to_char(${expr} AT TIME ZONE '${ZONA}', '${formato}')`;

const partes = (d: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );

/** `YYYY-MM-DD` de hoy (o de `d`) en Ecuador. */
export function hoyEc(d: Date = new Date()): string {
  const p = partes(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** `YYYY-MM-DD HH:MM` de ahora (o de `d`) en Ecuador. */
export function ahoraEc(d: Date = new Date()): string {
  const p = partes(d);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
