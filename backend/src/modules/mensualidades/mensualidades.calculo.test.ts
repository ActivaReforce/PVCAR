import { describe, expect, it } from 'vitest';
import {
  familias,
  mesesDeLaFamilia,
  primerMes,
  sumarMeses,
  type ColegioCobro,
  type CuotaRegistrada,
  type HijoCobro,
} from './mensualidades.calculo.js';

const TODO_EL_ANO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const colegio = (o: Partial<ColegioCobro> = {}): ColegioCobro => ({
  precio: 40,
  descuentoHermano: 10,
  meses: TODO_EL_ANO,
  desde: '2026-01-01',
  diaLimite: 10,
  diaCorte: 20,
  ...o,
});

const hijo = (id: number, disciplinas: Array<[string, string, boolean]>, col = 1): HijoCobro => ({
  nino_id: id,
  nombre: `Hijo ${id}`,
  col_id: col,
  disciplinas: disciplinas.map(([nombre, inicio, porInscripcion], i) => ({
    colacthor_id: id * 100 + i,
    nombre,
    inicio,
    porInscripcion,
  })),
});

describe('sumarMeses', () => {
  it('pasa de año', () => {
    expect(sumarMeses('2026-12-01', 1)).toBe('2027-01-01');
    expect(sumarMeses('2026-01-01', -1)).toBe('2025-12-01');
  });
});

describe('primerMes', () => {
  it('antes del corte paga su mes; desde el corte, el siguiente', () => {
    expect(primerMes('2026-01-05', colegio())).toBe('2026-01-01');
    expect(primerMes('2026-01-19', colegio())).toBe('2026-01-01');
    expect(primerMes('2026-01-20', colegio())).toBe('2026-02-01');
    expect(primerMes('2026-01-25', colegio())).toBe('2026-02-01');
  });

  it('lo inscrito antes de "cobrar desde" cubre ese mes', () => {
    expect(primerMes('2026-10-05', colegio({ desde: '2026-11-01' }))).toBe('2026-11-01');
  });

  it('salta los meses en pausa', () => {
    const sierra = colegio({ meses: [9, 10, 11, 12, 1, 2, 3, 4, 5, 6] });
    expect(primerMes('2026-07-10', sierra)).toBe('2026-09-01');
  });

  it('sin configurar no cobra', () => {
    expect(primerMes('2026-01-05', colegio({ desde: null }))).toBeNull();
    expect(primerMes('2026-01-05', colegio({ meses: [] }))).toBeNull();
  });
});

describe('mesesDeLaFamilia', () => {
  const colegios = new Map([[1, colegio()]]);

  it('el mes de la inscripción sale como pagado por ella y el resto se debe', () => {
    const r = mesesDeLaFamilia([hijo(1, [['Fútbol', '2026-01-05', true]])], colegios, [], '2026-03-05');
    expect(r.get(1)!.map((m) => [m.mes, m.estado, m.total])).toEqual([
      ['2026-01-01', 'inscripcion', 0],
      ['2026-02-01', 'atrasado', 46],
      ['2026-03-01', 'pendiente', 46],
    ]);
  });

  it('pasado el día límite, el mes en curso está atrasado', () => {
    const r = mesesDeLaFamilia([hijo(1, [['Fútbol', '2026-01-05', true]])], colegios, [], '2026-02-11');
    expect(r.get(1)!.at(-1)).toMatchObject({ mes: '2026-02-01', estado: 'atrasado' });
  });

  it('cada colegio usa su propio día límite', () => {
    const dos = new Map([
      [1, colegio({ diaLimite: 5 })],
      [2, colegio({ diaLimite: 15 })],
    ]);
    const hijos = [hijo(1, [['Fútbol', '2026-01-05', true]], 1), hijo(2, [['Danza', '2026-01-05', true]], 2)];
    const r = mesesDeLaFamilia(hijos, dos, [], '2026-02-10');
    expect(r.get(1)!.at(-1)!.estado).toBe('atrasado');
    expect(r.get(2)!.at(-1)!.estado).toBe('pendiente');
  });

  it('el 25 de enero empieza en febrero: enero no se cobra', () => {
    const r = mesesDeLaFamilia([hijo(1, [['Fútbol', '2026-01-25', true]])], colegios, [], '2026-02-05');
    expect(r.get(1)!.map((m) => [m.mes, m.estado])).toEqual([['2026-02-01', 'inscripcion']]);
  });

  it('los meses en pausa no salen', () => {
    const verano = new Map([[1, colegio({ meses: [1, 3] })]]);
    const r = mesesDeLaFamilia([hijo(1, [['Fútbol', '2026-01-05', true]])], verano, [], '2026-03-05');
    expect(r.get(1)!.map((m) => m.mes)).toEqual(['2026-01-01', '2026-03-01']);
  });

  it('el hermano lleva su descuento, lo pague quien lo pague', () => {
    const hijos = [hijo(1, [['Fútbol', '2026-01-05', true]]), hijo(2, [['Danza', '2026-01-05', true]])];
    const r = mesesDeLaFamilia(hijos, colegios, [], '2026-02-05');
    const feb = (id: number) => r.get(id)!.find((m) => m.mes === '2026-02-01')!;
    // 40 + 15 % = 46; el otro, 36 + 15 % = 41,40.
    expect([feb(1).total, feb(2).total].sort()).toEqual([41.4, 46]);
  });

  it('lo ya pagado conserva su importe y su estado', () => {
    const pagada: CuotaRegistrada = {
      nino_id: 1,
      mes: '2026-02-01',
      estado: 'pendiente',
      menpag_id: 9,
      disciplinas: ['Fútbol'],
      subtotal: 30,
      descuento: 0,
      iva: 4.5,
      total: 34.5,
    };
    const r = mesesDeLaFamilia([hijo(1, [['Fútbol', '2026-01-05', true]])], colegios, [pagada], '2026-02-05');
    expect(r.get(1)!.find((m) => m.mes === '2026-02-01')).toMatchObject({ estado: 'revision', total: 34.5, menpag_id: 9 });
  });

  it('una disciplina añadida por inscripción: ese mes se cobra solo la que ya tenía', () => {
    const r = mesesDeLaFamilia(
      [hijo(1, [['Fútbol', '2026-01-05', true], ['Danza', '2026-02-03', true]])],
      colegios,
      [],
      '2026-03-05',
    );
    const feb = r.get(1)!.find((m) => m.mes === '2026-02-01')!;
    expect(feb).toMatchObject({ disciplinas: ['Fútbol'], inscripcion: ['Danza'], total: 46 });
    expect(r.get(1)!.find((m) => m.mes === '2026-03-01')!.total).toBe(92);
  });

  it('dada de alta a mano, sin inscripción: su primer mes también se cobra', () => {
    const r = mesesDeLaFamilia([hijo(1, [['Fútbol', '2026-02-03', false]])], colegios, [], '2026-02-05');
    expect(r.get(1)!.map((m) => [m.mes, m.estado])).toEqual([['2026-02-01', 'pendiente']]);
  });
});

describe('familias', () => {
  it('une a los alumnos que comparten algún representante', () => {
    const g = familias([
      { nino_id: 1, representantes: [10] },
      { nino_id: 2, representantes: [10, 11] },
      { nino_id: 3, representantes: [11] },
      { nino_id: 4, representantes: [12] },
    ]);
    expect(g.map((f) => f.map((h) => h.nino_id).sort()).sort()).toEqual([[1, 2, 3], [4]]);
  });
});
