/**
 * Horas que vienen de la base como `time` (HH:MM:SS) y se enseñan como HH:MM.
 *
 * Es lo único que se salvó de `components/attendance/TimezoneUtils.ts`, que
 * además convertía zonas horarias en el navegador con `date-fns-tz`. Eso ya no
 * hace falta: la hora de Ecuador la da el backend en `/asistencias/contexto`,
 * una sola vez y para todos.
 *
 * Lo sigue usando el informe de asistencia de entrenadores, que aún consulta
 * Supabase directo y se reescribe en la Fase 13.
 */
export function horaCorta(hora: string | null | undefined): string {
  if (!hora) return '';
  return hora.slice(0, 5);
}
