import { describe, expect, it, vi } from 'vitest';
import { ESTADO } from '../../lib/constants.js';
import { resumenDe, type Bloque, type Fila } from './reportes.resumen.js';

// Las definiciones tiran de `config/db`, que sin variables de entorno (CI) sale.
vi.mock('../../config/db.js', () => ({ getPool: () => ({}) }));
const { DEFINICIONES } = await import('./reportes.definiciones.js');

/**
 * La hoja Resumen, con los dos casos que dio el cliente el 2026-10-07:
 * ej1 (cuántas veces vino cada profe) y ej2 (alumnos por disciplina).
 */

const P = 1; // presente
const A = 2; // ausente
const T = 3; // tarde
const J = 4; // justificado

const bloque = (bloques: Bloque[], titulo: string) => {
  const b = bloques.find((x) => x.titulo === titulo);
  if (!b) throw new Error(`falta el bloque "${titulo}"`);
  return b;
};

describe('ej1 — cuántas veces vino cada profe', () => {
  const marca = (persona: number, nombre: string, tipo: string, colegio: string, estado: number): Fila => ({
    _persona: persona,
    usu_nombre: nombre,
    tipo,
    col_nombre: colegio,
    _asisest: estado,
  });
  const filas = [
    marca(1, 'Beto', 'Entrenador', 'Colegio A', P),
    marca(1, 'Beto', 'Entrenador', 'Colegio A', P),
    marca(1, 'Beto', 'Entrenador', 'Colegio A', A),
    marca(1, 'Beto', 'Entrenador', 'Colegio B', T),
    marca(2, 'Ana', 'Entrenador', 'Colegio A', P),
    marca(2, 'Ana', 'Entrenador', 'Colegio A', J),
    // La misma persona como auxiliar va aparte.
    marca(2, 'Ana', 'Auxiliar', 'Colegio B', P),
  ];
  const b = bloque(resumenDe('asistencias-entrenadores', filas, {}), 'Cuántas veces vino cada persona');

  it('una fila por persona y papel, en orden alfabético', () => {
    const personas = b.destacadas.map((i) => b.filas[i]!.slice(0, 2));
    expect(personas).toEqual([
      ['Ana', 'Auxiliar'],
      ['Ana', 'Entrenador'],
      ['Beto', 'Entrenador'],
    ]);
  });

  it('cuenta presentes, tardes, ausentes, cuántas veces vino y el %', () => {
    // Persona, Tipo, Colegio, Presente, Tarde, Justificado, Ausente, Total, Vino, % presente
    expect(b.filas[b.destacadas[2]!]).toEqual(['Beto', 'Entrenador', 'Todos (2)', 2, 1, 0, 1, 4, 3, 50]);
  });

  it('desglosa por colegio solo a quien trabaja en más de uno', () => {
    const i = b.destacadas[2]!;
    expect(b.filas[i + 1]).toEqual(['', '', 'Colegio A', 2, 0, 0, 1, 3, 2, 66.7]);
    expect(b.filas[i + 2]).toEqual(['', '', 'Colegio B', 0, 1, 0, 0, 1, 1, 0]);
    // Ana como entrenadora: un solo colegio y sin desglose debajo.
    expect(b.filas[b.destacadas[1]!]![2]).toBe('Colegio A');
    expect(b.destacadas[2]).toBe(b.destacadas[1]! + 1);
  });
});

describe('ej2 — alumnos por disciplina', () => {
  const d = (id: number, actividad: string) => ({ id, colegio: 'Colegio A', actividad, horario: 'Lun 15:00' });
  const filas: Fila[] = [
    { nino_nombre: 'Zoe', col_nombre: 'Colegio A', estado: 'Activo', _disciplinas: [d(1, 'Fútbol'), d(2, 'Danza')] },
    { nino_nombre: 'Luis', col_nombre: 'Colegio A', estado: 'Activo', _disciplinas: [d(1, 'Fútbol')] },
    { nino_nombre: 'Eva', col_nombre: 'Colegio A', estado: 'Inactivo', _disciplinas: [] },
  ];

  it('la tabla de conteos dice cuántos por disciplina, los sueltos y el total sin repetir', () => {
    const b = bloque(resumenDe('estudiantes', filas, {}), 'Alumnos por disciplina');
    expect(b.filas).toEqual([
      ['Colegio A', 'Danza', 'Lun 15:00', 1],
      ['Colegio A', 'Fútbol', 'Lun 15:00', 2],
      ['Sin disciplina', '', '', 1],
      ['Total de alumnos (sin repetir)', '', '', 3],
    ]);
  });

  it('la lista agrupada pone el título de cada disciplina y sus alumnos debajo', () => {
    const b = bloque(resumenDe('estudiantes', filas, {}), 'Lista de alumnos por disciplina');
    expect(b.destacadas.map((i) => b.filas[i]![0])).toEqual([
      'Colegio A · Danza (Lun 15:00) — 1 alumno',
      'Colegio A · Fútbol (Lun 15:00) — 2 alumnos',
    ]);
    expect(b.filas.slice(b.destacadas[1]! + 1).map((f) => f[0])).toEqual(['Luis', 'Zoe']);
  });

  it('con filtro de disciplina, solo sale esa', () => {
    const b = bloque(resumenDe('estudiantes', filas, { disciplina: 2 }), 'Alumnos por disciplina');
    expect(b.filas[0]).toEqual(['Colegio A', 'Danza', 'Lun 15:00', 1]);
  });
});

describe('los demás reportes', () => {
  it('los nueve tienen Resumen', () => {
    const fila: Fila = { estado: 'Activo', _roles: ['Entrenador'], _colegios: ['Colegio A'] };
    for (const def of DEFINICIONES) {
      expect(resumenDe(def.id, [fila], {}).length, def.id).toBeGreaterThan(0);
    }
  });

  it('sin filas no inventa bloques', () => {
    expect(resumenDe('usuarios', [], {})).toEqual([]);
  });

  it('evaluaciones: promedia solo las evaluadas', () => {
    const filas: Fila[] = [
      { eva_titulo: 'Mobak', col_nombre: 'A', act_nombre: 'X', _est: ESTADO.EVALUADO, porcentaje: 80 },
      { eva_titulo: 'Mobak', col_nombre: 'A', act_nombre: 'X', _est: ESTADO.EVALUADO, porcentaje: 60 },
      { eva_titulo: 'Mobak', col_nombre: 'A', act_nombre: 'X', _est: ESTADO.PENDIENTE, porcentaje: 0 },
    ];
    const b = bloque(resumenDe('evaluaciones', filas, {}), 'Por evaluación');
    expect(b.filas[0]).toEqual(['Mobak', '', 3, 2, 1, 70]);
  });

  it('entrenadores: titulares y auxiliares se cuentan por separado', () => {
    const filas: Fila[] = [
      { tipo: 'Entrenador', usu_nombre: 'Beto', estado: 'Activo', _colegios: ['A', 'B'], disciplinas: 2 },
      { tipo: 'Auxiliar', usu_nombre: 'Caro', estado: 'Activo', _colegios: ['A'], disciplinas: 1 },
      { tipo: 'Auxiliar', usu_nombre: 'Dani', estado: 'Inactivo', _colegios: [], disciplinas: 0 },
    ];
    const bloques = resumenDe('entrenadores', filas, {});
    expect(bloque(bloques, 'Por estado').filas).toEqual([
      ['Activo', 1, 1, 2],
      ['Inactivo', 0, 1, 1],
      ['Total', 1, 2, 3],
    ]);
    expect(bloque(bloques, 'Por colegio').filas).toEqual([
      ['A', 1, 1, 2],
      ['B', 1, 0, 1],
      ['Sin colegio', 0, 1, 1],
    ]);
    expect(bloque(bloques, 'Sin disciplinas activas').filas).toEqual([['Dani', 'Auxiliar']]);
  });

  it('usuarios: quien tiene dos roles cuenta en los dos', () => {
    const filas: Fila[] = [
      { estado: 'Activo', _roles: ['Coordinador', 'Entrenador'] },
      { estado: 'Inactivo', _roles: ['Entrenador'] },
    ];
    const b = bloque(resumenDe('usuarios', filas, {}), 'Personas por rol');
    expect(b.filas).toEqual([
      ['Coordinador', 1, 0, 1],
      ['Entrenador', 1, 1, 2],
    ]);
  });
});
