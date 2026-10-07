import { describe, expect, it } from 'vitest';
import {
  actualizarDisciplinaSchema,
  crearDisciplinaSchema,
  listarDisciplinasSchema,
} from './disciplinas.schemas.js';

const base = { col_id: 11, act_id: 24 };
const franja = { dia_id: 1, inicio: '15:00', fin: '16:00' };

describe('crearDisciplinaSchema', () => {
  it('acepta varios dias, cada uno con su hora', () => {
    const r = crearDisciplinaSchema.parse({
      ...base,
      horarios: [franja, { dia_id: 3, inicio: '16:00', fin: '17:00' }],
    });
    expect(r.horarios).toHaveLength(2);
  });

  it('rechaza el mismo dia dos veces', () => {
    const r = crearDisciplinaSchema.safeParse({ ...base, horarios: [franja, franja] });
    expect(r.success).toBe(false);
  });

  it('exige al menos un horario', () => {
    expect(crearDisciplinaSchema.safeParse({ ...base, horarios: [] }).success).toBe(false);
  });

  it('rechaza la hora de fin anterior a la de inicio', () => {
    const r = crearDisciplinaSchema.safeParse({
      ...base,
      horarios: [{ dia_id: 1, inicio: '16:00', fin: '15:00' }],
    });
    expect(r.success).toBe(false);
  });

  it('rechaza la hora de fin igual a la de inicio', () => {
    const r = crearDisciplinaSchema.safeParse({
      ...base,
      horarios: [{ dia_id: 1, inicio: '15:00', fin: '15:00' }],
    });
    expect(r.success).toBe(false);
  });

  it('admite el formato con segundos que devuelve Postgres', () => {
    const r = crearDisciplinaSchema.safeParse({
      ...base,
      horarios: [{ dia_id: 1, inicio: '15:00:00', fin: '16:30:00' }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.horarios[0]).toMatchObject({ inicio: '15:00', fin: '16:30' });
  });

  it('rechaza una hora imposible', () => {
    const r = crearDisciplinaSchema.safeParse({
      ...base,
      horarios: [{ dia_id: 1, inicio: '25:00', fin: '26:00' }],
    });
    expect(r.success).toBe(false);
  });

  it('rechaza un dia fuera de 1..7', () => {
    expect(
      crearDisciplinaSchema.safeParse({ ...base, horarios: [{ ...franja, dia_id: 8 }] }).success,
    ).toBe(false);
  });

  it('no admite mas de siete dias', () => {
    const muchos = Array.from({ length: 8 }, (_, i) => ({ ...franja, dia_id: (i % 7) + 1 }));
    expect(crearDisciplinaSchema.safeParse({ ...base, horarios: muchos }).success).toBe(false);
  });
});

describe('actualizarDisciplinaSchema', () => {
  it('admite cambiar solo los horarios', () => {
    expect(actualizarDisciplinaSchema.safeParse({ horarios: [{ ...franja, dia_id: 5 }] }).success).toBe(true);
  });

  it('rechaza un cuerpo vacio', () => {
    expect(actualizarDisciplinaSchema.safeParse({}).success).toBe(false);
  });
});

describe('listarDisciplinasSchema', () => {
  it('parte la lista de colegios separada por comas', () => {
    expect(listarDisciplinasSchema.parse({ colegio: '11,14' }).colegio).toEqual([11, 14]);
  });

  it('ignora la basura dentro de la lista', () => {
    expect(listarDisciplinasSchema.parse({ colegio: '11,abc,-3' }).colegio).toEqual([11]);
  });

  it("no convierte 'false' en true", () => {
    expect(listarDisciplinasSchema.parse({ sinEntrenador: 'false' }).sinEntrenador).toBe(false);
    expect(listarDisciplinasSchema.parse({ sinEntrenador: 'true' }).sinEntrenador).toBe(true);
  });

  it('rechaza un orden fuera de la lista blanca', () => {
    expect(listarDisciplinasSchema.safeParse({ orden: 'colacthor_id; drop' }).success).toBe(false);
  });
});
