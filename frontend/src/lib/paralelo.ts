/**
 * Paralelo del alumno (0048, 2026-11-18): una letra mayúscula (A–Z).
 * Los alumnos anteriores no lo tienen.
 */

/** Lo que se escribe en el campo: una sola letra, en mayúscula; lo demás no entra. */
export function limpiarParalelo(texto: string): string {
  const letras = texto.toUpperCase().replace(/[^A-Z]/g, '');
  return letras.slice(0, 1);
}

export const PARALELO_VALIDO = /^[A-Z]$/;

/** "8vo de Básica" + "A" → "8vo de Básica A". */
export function cursoConParalelo(curso: string | null | undefined, paralelo: string | null | undefined): string | null {
  if (!curso) return paralelo ? `Paralelo ${paralelo}` : null;
  return paralelo ? `${curso} ${paralelo}` : curso;
}
