/**
 * Cursos (categoria_nino_grado) en corto, para listas apretadas:
 * "6to de Básica" → "6to", "1ro de Bachillerato" → "1ro Bach.".
 */
export function cursoCorto(nombre: string): string {
  return nombre.replace(/ de Básica$/i, '').replace(/ de Bachillerato$/i, ' Bach.');
}

/** ¿La disciplina es para este curso? Sin cursos marcados vale para todos. */
export function esParaCurso(grados: number[], curso: number | null): boolean {
  return grados.length === 0 || curso === null || grados.includes(curso);
}

/** "6to, 7mo" o "Todos los cursos", con los nombres del catálogo. */
export function textoCursos(
  ids: number[],
  catalogo: Array<{ catninograd_id: number; catninograd_nombre: string }>,
): string {
  if (ids.length === 0 || ids.length === catalogo.length) return 'Todos los cursos';
  return catalogo
    .filter((g) => ids.includes(g.catninograd_id))
    .map((g) => cursoCorto(g.catninograd_nombre))
    .join(', ');
}
