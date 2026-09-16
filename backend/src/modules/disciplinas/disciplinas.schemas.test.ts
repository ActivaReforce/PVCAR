import { describe, expect, it } from 'vitest';
import {
  actualizarDisciplinaSchema,
  crearDisciplinasSchema,
  listarDisciplinasSchema,
} from './disciplinas.schemas.js';

const base = { col_id: 11, act_id: 24 };
const franja = { dia_id: 1, colacthor_hora_inicio: '15:00', colacthor_hora_fin: '16:00' };

describe('crearDisciplinasSchema', () => {
  it('acepta un lote de varios dias con el mismo horario', () => {
    const r = crearDisciplinasSchema.parse({
      ...base,
      horarios: [franja, { ...franja, dia_id: 3 }],
    });
    expect(r.horarios).toHaveLength(2);
  });

  it('exige al menos un horario', () => {
    expect(crearDisciplinasSchema.safeParse({ ...base, horarios: [] }).success).toBe(false);
  });

  it('rechaza la hora de fin anterior a la de inicio', () => {
    const r = crearDisciplinasSchema.safeParse({
      ...base,
      horarios: [{ dia_id: 1, colacthor_hora_inicio: '16:00', colacthor_hora_fin: '15:00' }],
    });
    expect(r.success).toBe(false);
  });

  it('rechaza la hora de fin igual a la de inicio', () => {
    const r = crearDisciplinasSchema.safeParse({
      ...base,
      horarios: [{ dia_id: 1, colacthor_hora_inicio: '15:00', colacthor_hora_fin: '15:00' }],
    });
    expect(r.success).toBe(false);
  });

  it('admite el formato con segundos que devuelve Postgres', () => {
    const r = crearDisciplinasSchema.safeParse({
      ...base,
      horarios: [{ dia_id: 1, colacthor_hora_inicio: '15:00:00', colacthor_hora_fin: '16:30:00' }],
    });
    expect(r.success).toBe(true);
  });

  it('rechaza una hora imposible', () => {
    const r = crearDisciplinasSchema.safeParse({
      ...base,
      horarios: [{ dia_id: 1, colacthor_hora_inicio: '25:00', colacthor_hora_fin: '26:00' }],
    });
    expect(r.success).toBe(false);
  });

  it('rechaza un dia fuera de 1..7', () => {
    expect(
      crearDisciplinasSchema.safeParse({ ...base, horarios: [{ ...franja, dia_id: 8 }] }).success,
    ).toBe(false);
  });

  it('no deja crear mas de dos semanas de golpe', () => {
    const muchos = Array.from({ length: 15 }, () => franja);
    expect(crearDisciplinasSchema.safeParse({ ...base, horarios: muchos }).success).toBe(false);
  });
});

describe('actualizarDisciplinaSchema', () => {
  it('admite cambiar solo el dia', () => {
    expect(actualizarDisciplinaSchema.safeParse({ dia_id: 5 }).success).toBe(true);
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
