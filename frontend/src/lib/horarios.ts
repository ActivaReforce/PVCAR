import type { Franja, HorarioDisciplina } from '@/api/disciplinas';

/**
 * El día en que dos disciplinas se pisan, o null si son compatibles.
 *
 * Es la misma regla que aplica el backend (lib/horarios.ts): mismo día y
 * franjas que se solapan; 15:00–16:00 y 16:00–17:00 NO se cruzan. Aquí solo
 * sirve para avisar antes de guardar: quien decide es el servidor.
 */
export function diaDeCruce(a: HorarioDisciplina[], b: HorarioDisciplina[]): string | null {
  for (const x of a) {
    for (const y of b) {
      if (x.dia_id === y.dia_id && x.inicio < y.fin && y.inicio < x.fin) return x.dia_nombre;
    }
  }
  return null;
}

/** Primer par que se cruza entre las elegidas: "Fútbol y Danza se cruzan el lunes". */
export function primerCruce(
  elegidas: Array<{ nombre: string; horarios: HorarioDisciplina[] }>,
): string | null {
  for (let i = 0; i < elegidas.length; i++) {
    for (let j = i + 1; j < elegidas.length; j++) {
      const dia = diaDeCruce(elegidas[i]!.horarios, elegidas[j]!.horarios);
      if (dia) return `${elegidas[i]!.nombre} y ${elegidas[j]!.nombre} se cruzan el ${dia.toLowerCase()}`;
    }
  }
  return null;
}

/** Qué tiene de malo la lista, o null si se puede guardar. */
export function problemaDeHorarios(horarios: Franja[]): string | null {
  if (horarios.length === 0) return 'Elige al menos un día';
  const mal = horarios.find((f) => !f.inicio || !f.fin || f.fin <= f.inicio);
  if (mal) return 'En cada día, la hora de fin tiene que ser posterior a la de inicio';
  return null;
}
