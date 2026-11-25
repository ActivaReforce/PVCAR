import { describe, expect, it } from 'vitest';
import { cursoConParalelo, paraleloSchema } from './paralelo.js';

describe('paralelo (0048)', () => {
  it('acepta una letra y la pasa a mayúscula', () => {
    expect(paraleloSchema.parse('a')).toBe('A');
    expect(paraleloSchema.parse(' B ')).toBe('B');
  });

  it('rechaza vacío, dos letras, números y ñ', () => {
    for (const malo of ['', 'AB', '1', 'ñ', 'A1']) {
      expect(paraleloSchema.safeParse(malo).success).toBe(false);
    }
  });

  it('junta curso y paralelo, y sin paralelo deja el curso tal cual', () => {
    expect(cursoConParalelo('8vo de Básica', 'A')).toBe('8vo de Básica A');
    expect(cursoConParalelo('8vo de Básica', null)).toBe('8vo de Básica');
    expect(cursoConParalelo('8vo de Básica', undefined)).toBe('8vo de Básica');
    expect(cursoConParalelo(null, null)).toBeNull();
  });
});
