import { z } from 'zod';

/**
 * Paralelo del alumno (0048, 2026-11-18): una letra mayúscula (A–Z). En
 * Ecuador cada curso tiene paralelos: "1ero de Básica A".
 *
 * Los alumnos anteriores no lo tienen (NULL); el formulario público lo pide
 * desde ahora.
 */
export const paraleloSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]$/, 'El paralelo es una sola letra (A, B, C…)');

/** "8vo de Básica" + "A" → "8vo de Básica A". Sin paralelo, el curso tal cual. */
export function cursoConParalelo(curso: string | null | undefined, paralelo: string | null | undefined): string | null {
  if (!curso) return paralelo ? `Paralelo ${paralelo}` : null;
  return paralelo ? `${curso} ${paralelo}` : curso;
}

/** Lo mismo en SQL: `concat_ws` salta los NULL. */
export const cursoConParaleloSql = (curso: string, paralelo: string) =>
  `NULLIF(concat_ws(' ', ${curso}, ${paralelo}), '')`;
