import { describe, expect, it } from 'vitest';
import { cursoConParalelo, limpiarParalelo } from './paralelo';

describe('limpiarParalelo', () => {
  it('pasa a mayúscula y deja una sola letra', () => {
    expect(limpiarParalelo('a')).toBe('A');
    expect(limpiarParalelo('ab')).toBe('A');
    expect(limpiarParalelo('1')).toBe('');
    expect(limpiarParalelo(' c')).toBe('C');
    expect(limpiarParalelo('')).toBe('');
  });

  it('junta curso y paralelo', () => {
    expect(cursoConParalelo('1ero de Básica', 'B')).toBe('1ero de Básica B');
    expect(cursoConParalelo('1ero de Básica', null)).toBe('1ero de Básica');
  });
});
