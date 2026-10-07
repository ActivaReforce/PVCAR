import { describe, expect, it } from 'vitest';
import { ahoraEc, diaEc, HOY_EC, hoyEc, textoEc } from './fecha.js';

describe('fechas en hora de Ecuador', () => {
  it('de noche en Ecuador sigue siendo hoy, aunque en UTC ya sea manana', () => {
    // 7 de octubre, 21:30 en Guayaquil = 8 de octubre, 02:30 UTC.
    const noche = new Date('2026-10-08T02:30:00Z');
    expect(hoyEc(noche)).toBe('2026-10-07');
    expect(ahoraEc(noche)).toBe('2026-10-07 21:30');
  });

  it('justo antes y justo despues de medianoche en Ecuador', () => {
    expect(hoyEc(new Date('2026-10-08T04:59:00Z'))).toBe('2026-10-07');
    expect(hoyEc(new Date('2026-10-08T05:00:00Z'))).toBe('2026-10-08');
  });

  it('la medianoche se escribe 00, no 24', () => {
    expect(ahoraEc(new Date('2026-10-08T05:00:00Z'))).toBe('2026-10-08 00:00');
  });

  it('el SQL convierte siempre con la zona', () => {
    expect(HOY_EC).toBe(`(now() AT TIME ZONE 'America/Guayaquil')::date`);
    expect(diaEc('x.marca')).toBe(`(x.marca AT TIME ZONE 'America/Guayaquil')::date`);
    expect(textoEc('x.marca', 'DD/MM/YYYY')).toBe(
      `to_char(x.marca AT TIME ZONE 'America/Guayaquil', 'DD/MM/YYYY')`,
    );
  });
});
