import { afterEach, describe, expect, it, vi } from 'vitest';
import { fechaDia, haceDiasEc, hoyEc } from './fecha';

afterEach(() => vi.useRealTimers());

describe('fechas en hora de Ecuador', () => {
  it('de noche en Ecuador, hoy sigue siendo hoy', () => {
    // 7 de octubre, 21:30 en Guayaquil = 8 de octubre, 02:30 UTC.
    vi.useFakeTimers({ now: new Date('2026-10-08T02:30:00Z') });
    expect(hoyEc()).toBe('2026-10-07');
    expect(haceDiasEc(7)).toBe('2026-09-30');
  });

  it('una columna date no se corre un día atrás', () => {
    expect(fechaDia('2026-10-07')).toBe('07/10/2026');
  });

  it('una marca de noche se enseña con el día de Ecuador', () => {
    expect(fechaDia('2026-10-08T02:30:00.000Z')).toBe('07/10/2026');
  });

  it('vacío o inválido da guion', () => {
    expect(fechaDia(null)).toBe('—');
    expect(fechaDia('no-es-fecha')).toBe('—');
  });
});
