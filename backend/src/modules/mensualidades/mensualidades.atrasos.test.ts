import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: {}, frontendBaseUrl: 'https://activareforce.com' }));
vi.mock('../../config/db.js', () => ({ getPool: () => ({ query: async () => ({ rows: [] }) }) }));

const { msHastaLaHora, textoDeNovedad } = await import('./mensualidades.atrasos.js');

const HORA = 3_600_000;

describe('msHastaLaHora', () => {
  it('a las 6:00 de Ecuador (11:00 UTC) faltan 60 minutos para las 7:00', () => {
    expect(msHastaLaHora(new Date('2026-12-06T11:00:00Z'))).toBe(HORA);
  });

  it('a las 7:30 de Ecuador, la siguiente es mañana a las 7:00', () => {
    expect(msHastaLaHora(new Date('2026-12-06T12:30:00Z'))).toBe(23.5 * HORA);
  });

  it('a las 22:00 de Ecuador (ya es mañana en UTC) faltan 9 horas', () => {
    expect(msHastaLaHora(new Date('2026-12-07T03:00:00Z'))).toBe(9 * HORA);
  });
});

describe('textoDeNovedad', () => {
  it('resume el total y lista a cada alumno con lo que debe', () => {
    const texto = textoDeNovedad('2026-12-01', [
      { alumno: 'Ana', colegio: 'CRISFE', representante: 'Pablo', telefono: '0999', correo: 'p@x', meses: ['2026-12-01'], debe: 36.92 },
      { alumno: 'Luis', colegio: 'CRISFE', representante: '', telefono: '', correo: '', meses: ['2026-11-01', '2026-12-01'], debe: 73.84 },
    ]);
    expect(texto.split('\n')[0]).toBe('Mensualidad atrasada (Diciembre 2026): 2 alumnos deben $110.76.');
    expect(texto).toContain('• Ana (CRISFE) — debe Diciembre 2026: $36.92 · Pablo 0999');
    expect(texto).toContain('• Luis (CRISFE) — debe Noviembre 2026, Diciembre 2026: $73.84');
  });
});
