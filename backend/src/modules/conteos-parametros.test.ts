import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Alcance } from '../lib/alcance.js';

/**
 * Guardia contra el fallo que tumbo Disciplinas y Entrenadores en dev.
 *
 * Los modulos con filtros comparten un array de parametros entre la consulta
 * de la pagina y la de los conteos, pero los conteos ignoran a proposito los
 * ultimos filtros. Postgres deduce cuantos parametros hay del marcador mas
 * alto del SQL, asi que mandarle de mas revienta la consulta entera:
 * `bind message supplies 8 parameters, but prepared statement "" requires 6`.
 *
 * Aqui se llama a cada listado y a cada conteo con la base fingida y se
 * comprueba lo unico que Postgres exige: tantos valores como marcadores.
 */

const llamadas: Array<{ sql: string; valores: unknown[] }> = [];

const query = vi.fn(async (sql: string, valores: unknown[] = []) => {
  llamadas.push({ sql, valores });
  return { rows: [] };
});

vi.mock('../config/db.js', () => ({ getPool: () => ({ query }) }));

const ALCANCE: Alcance = { global: false, colegios: [11], disciplinas: [80] };

/** El marcador mas alto que aparece en el SQL: lo que Postgres va a exigir. */
function marcadores(sql: string): number {
  let mayor = 0;
  for (const [, n] of sql.matchAll(/\$(\d+)/g)) mayor = Math.max(mayor, Number(n));
  return mayor;
}

beforeEach(() => {
  llamadas.length = 0;
});

describe('los parametros cuadran con los marcadores', () => {
  it('disciplinas: listado y conteos', async () => {
    const repo = await import('./disciplinas/disciplinas.repository.js');
    const query_ = { page: 1, limit: 200, estado: 1, orden: 'horario', sinEntrenador: false } as never;

    await repo.listarDisciplinas(query_, ALCANCE);
    await repo.contarDisciplinas(query_, ALCANCE);

    expect(llamadas).toHaveLength(2);
    for (const { sql, valores } of llamadas) expect(valores).toHaveLength(marcadores(sql));
  });

  it('entrenadores: listado y conteos', async () => {
    const repo = await import('./entrenadores/entrenadores.repository.js');
    const query_ = { page: 1, limit: 200, estado: 1, sinAsignar: false } as never;

    await repo.listarEntrenadores(query_, ALCANCE);
    await repo.contarEntrenadores(query_, ALCANCE);

    expect(llamadas).toHaveLength(2);
    for (const { sql, valores } of llamadas) expect(valores).toHaveLength(marcadores(sql));
  });

  it('estudiantes: listado y conteos', async () => {
    const repo = await import('./estudiantes/estudiantes.repository.js');
    const query_ = { page: 1, limit: 200, estado: 1, sinAsignar: false } as never;

    await repo.listarEstudiantes(query_, ALCANCE);
    await repo.contarEstudiantes(query_, ALCANCE);

    expect(llamadas).toHaveLength(2);
    for (const { sql, valores } of llamadas) expect(valores).toHaveLength(marcadores(sql));
  });

  it('usuarios: listado y conteos', async () => {
    const repo = await import('./usuarios/usuarios.repository.js');
    const query_ = { page: 1, limit: 200, estado: 1, sinRol: false } as never;

    await repo.listarUsuarios(query_, ALCANCE, 1);
    await repo.contarUsuarios(query_, ALCANCE, 1);

    expect(llamadas).toHaveLength(2);
    for (const { sql, valores } of llamadas) expect(valores).toHaveLength(marcadores(sql));
  });

  it('evaluaciones: listado y conteos', async () => {
    const repo = await import('./evaluaciones/evaluaciones.repository.js');
    const query_ = { page: 1, limit: 200, estado: 1, sinDisciplinas: false } as never;

    await repo.listarEvaluaciones(query_, ALCANCE, 1);
    await repo.contarEvaluaciones(ALCANCE, 1);

    expect(llamadas).toHaveLength(3);
    for (const { sql, valores } of llamadas) expect(valores).toHaveLength(marcadores(sql));
  });

  it('reportes: las 10 definiciones, con filtros y sin ellos', async () => {
    const { DEFINICIONES } = await import('./reportes/reportes.definiciones.js');
    const ctx = { global: false, colegios: [11], disciplinas: [80], actorId: 1 };
    const filtros = [
      {},
      { buscar: 'ana', colegio: [11], disciplina: 80, estado: 1, desde: '2026-01-01', hasta: '2026-09-18' },
    ];

    for (const definicion of DEFINICIONES) {
      for (const f of filtros) {
        const { sql, params } = definicion.construir(f, ctx);
        expect(`${definicion.id}: ${params.length}`).toBe(`${definicion.id}: ${marcadores(sql)}`);
      }
    }
  });
});
