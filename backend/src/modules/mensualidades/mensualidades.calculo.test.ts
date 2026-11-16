import { describe, expect, it } from 'vitest';
import {
  estadoSinPagar,
  familias,
  listaDeMeses,
  mesQueFalta,
  mesesAtrasados,
  mesesDeLaFamilia,
  sumarMeses,
  type ColegioCobro,
  type CuotaRegistrada,
  type HijoCobro,
} from './mensualidades.calculo.js';

/** Todo 2026 y el primer semestre de 2027. */
const MESES = Array.from({ length: 18 }, (_, i) => sumarMeses('2026-01-01', i));
const colegio = (o: Partial<ColegioCobro> = {}): ColegioCobro => ({
  precio: 40,
  descuentoHermano: 10,
  meses: MESES,
  diaLimite: 5,
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

const cuota = (o: Partial<CuotaRegistrada>): CuotaRegistrada => ({
  nino_id: 1,
  mes: '2026-02-01',
  estado: 'aprobado',
  menpag_id: 9,
  fecha_pago: '2026-01-20',
  disciplinas: ['Fútbol'],
  subtotal: 40,
  descuento: 0,
  iva: 6,
  total: 46,
  ...o,
});

describe('sumarMeses', () => {
  it('pasa de año', () => {
    expect(sumarMeses('2026-12-01', 1)).toBe('2027-01-01');
    expect(sumarMeses('2026-01-01', -1)).toBe('2025-12-01');
  });
});

describe('estadoSinPagar', () => {
  it('hasta el día límite, pendiente; después, atrasado', () => {
    expect(estadoSinPagar('2026-12-01', '2026-12-05', 5)).toBe('pendiente');
    expect(estadoSinPagar('2026-12-01', '2026-12-06', 5)).toBe('atrasado');
  });
  it('un mes anterior sin pagar está atrasado; uno futuro, pendiente', () => {
    expect(estadoSinPagar('2026-11-01', '2026-12-01', 5)).toBe('atrasado');
    expect(estadoSinPagar('2027-02-01', '2026-12-20', 5)).toBe('pendiente');
  });
});

describe('mesesDeLaFamilia', () => {
  const colegios = new Map([[1, colegio()]]);

  it('la inscripción paga su mes y desde el siguiente se debe, también lo futuro', () => {
    const r = mesesDeLaFamilia([hijo(1, [['Fútbol', '2026-11-01', true]])], colegios, [], '2026-12-10');
    expect(r.get(1)!.slice(0, 3).map((m) => [m.mes, m.estado, m.total])).toEqual([
      ['2026-11-01', 'inscripcion', 0],
      ['2026-12-01', 'atrasado', 46],
      ['2027-01-01', 'pendiente', 46],
    ]);
    // Se puede pagar hasta el último mes marcado.
    expect(r.get(1)!.at(-1)!.mes).toBe('2027-06-01');
  });

  it('inscrito en noviembre eligiendo diciembre: noviembre no se cobra', () => {
    const r = mesesDeLaFamilia([hijo(1, [['Fútbol', '2026-12-01', true]])], colegios, [], '2026-11-28');
    expect(r.get(1)![0]).toMatchObject({ mes: '2026-12-01', estado: 'inscripcion' });
    expect(r.get(1)!.some((m) => m.mes === '2026-11-01')).toBe(false);
  });

  it('cada colegio usa su propio día límite', () => {
    const dos = new Map([
      [1, colegio({ diaLimite: 5 })],
      [2, colegio({ diaLimite: 15 })],
    ]);
    const hijos = [hijo(1, [['Fútbol', '2026-01-01', true]], 1), hijo(2, [['Danza', '2026-01-01', true]], 2)];
    const r = mesesDeLaFamilia(hijos, dos, [], '2026-02-10');
    const feb = (id: number) => r.get(id)!.find((m) => m.mes === '2026-02-01')!.estado;
    expect(feb(1)).toBe('atrasado');
    expect(feb(2)).toBe('pendiente');
  });

  it('los meses en pausa no salen', () => {
    const verano = new Map([[1, colegio({ meses: ['2026-01-01', '2026-03-01'] })]]);
    const r = mesesDeLaFamilia([hijo(1, [['Fútbol', '2026-01-01', true]])], verano, [], '2026-03-05');
    expect(r.get(1)!.map((m) => m.mes)).toEqual(['2026-01-01', '2026-03-01']);
  });

  it('el hermano lleva su descuento, lo pague quien lo pague', () => {
    const hijos = [hijo(1, [['Fútbol', '2026-01-01', true]]), hijo(2, [['Danza', '2026-01-01', true]])];
    const r = mesesDeLaFamilia(hijos, colegios, [], '2026-02-05');
    const feb = (id: number) => r.get(id)!.find((m) => m.mes === '2026-02-01')!;
    // 40 + 15 % = 46; el otro, 36 + 15 % = 41,40.
    expect([feb(1).total, feb(2).total].sort()).toEqual([41.4, 46]);
  });

  it('lo ya pagado conserva su importe, su estado y su fecha de pago', () => {
    const r = mesesDeLaFamilia(
      [hijo(1, [['Fútbol', '2026-01-01', true]])],
      colegios,
      [cuota({ estado: 'pendiente', total: 34.5 })],
      '2026-02-05',
    );
    expect(r.get(1)!.find((m) => m.mes === '2026-02-01')).toMatchObject({
      estado: 'revision',
      total: 34.5,
      menpag_id: 9,
      pagado_el: '2026-01-20',
    });
  });

  it('una disciplina añadida por inscripción: ese mes se cobra solo la que ya tenía', () => {
    const r = mesesDeLaFamilia(
      [hijo(1, [['Fútbol', '2026-01-01', true], ['Danza', '2026-02-01', true]])],
      colegios,
      [],
      '2026-03-05',
    );
    const feb = r.get(1)!.find((m) => m.mes === '2026-02-01')!;
    expect(feb).toMatchObject({ disciplinas: ['Fútbol'], inscripcion: ['Danza'], total: 46 });
    expect(r.get(1)!.find((m) => m.mes === '2026-03-01')!.total).toBe(92);
  });

  it('dada de alta a mano, sin inscripción: su primer mes también se cobra', () => {
    const r = mesesDeLaFamilia([hijo(1, [['Fútbol', '2026-02-01', false]])], colegios, [], '2026-02-05');
    expect(r.get(1)![0]).toMatchObject({ mes: '2026-02-01', estado: 'pendiente' });
  });
});

describe('mesQueFalta', () => {
  const meses = mesesDeLaFamilia(
    [hijo(1, [['Fútbol', '2026-11-01', true]])],
    new Map([[1, colegio()]]),
    [],
    '2026-11-20',
  ).get(1)!;

  it('en orden, nada falta', () => {
    expect(mesQueFalta(meses, new Set(['2026-12-01', '2027-01-01']))).toBeNull();
  });

  it('enero sin diciembre: falta diciembre', () => {
    expect(mesQueFalta(meses, new Set(['2027-01-01']))).toBe('2026-12-01');
  });

  it('un mes en revisión no hace falta marcarlo', () => {
    const conRevision = mesesDeLaFamilia(
      [hijo(1, [['Fútbol', '2026-11-01', true]])],
      new Map([[1, colegio()]]),
      [cuota({ mes: '2026-12-01', estado: 'pendiente' })],
      '2026-11-20',
    ).get(1)!;
    expect(mesQueFalta(conRevision, new Set(['2027-01-01']))).toBeNull();
  });
});

describe('mesesAtrasados', () => {
  it('lo vencido sin pagar; lo que está en revisión no', () => {
    const r = mesesDeLaFamilia(
      [hijo(1, [['Fútbol', '2026-10-01', true]])],
      new Map([[1, colegio()]]),
      [cuota({ mes: '2026-11-01', estado: 'pendiente' })],
      '2026-12-06',
    ).get(1)!;
    expect(mesesAtrasados(r)).toEqual(['2026-12-01']);
  });
});

describe('listaDeMeses', () => {
  it('junta los meses en una frase', () => {
    expect(listaDeMeses(['2026-12-01'])).toBe('diciembre 2026');
    expect(listaDeMeses(['2027-02-01', '2027-01-01'])).toBe('enero y febrero 2027');
    expect(listaDeMeses(['2026-12-01', '2027-01-01'])).toBe('diciembre 2026 y enero 2027');
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
