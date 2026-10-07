import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ESTADO, ROL } from '../../lib/constants.js';
import { CONJUNTOS, construir, filtrosDe } from './historico.definiciones.js';
import { GRAFICAS_HISTORICO, SQL_INDICADORES, parametrosResumen } from './historico.resumen.js';

/**
 * Data anterior, sin base de datos.
 *
 * Lo que se comprueba: que solo entran los roles globales, que el WHERE se
 * arma con los parámetros justos, que el orden pedido no puede meter texto en
 * el SQL y que lo que sale son solo las columnas declaradas.
 *
 * Las consultas se ejecutaron además una a una contra una copia local de
 * `archivo` (2026-10-02): los 15 conjuntos con y sin filtros, cada filtro por
 * separado, y las 9 consultas del resumen.
 */

const llamadas: Array<{ sql: string; params: unknown[] }> = [];

const query = vi.fn(async (sql: string, params: unknown[] = []) => {
  llamadas.push({ sql, params });
  if (sql.includes('count(*)::int AS total')) return { rows: [{ total: 3 }] };
  return {
    rows: [{ usu_id: '7', usu_nombre: 'Ana', usu_correo: 'a@b.c', usu_telefono: '', cedula: '', roles: 'X', estado: 'Activo', fecha_creacion: '2026-01-01', _secreto: 'no' }],
  };
});

vi.mock('../../config/db.js', () => ({ getPool: () => ({ query }) }));

const service = await import('./historico.service.js');

function actor(roles: number[]) {
  return {
    authUserId: 'x',
    usuario: {
      usu_id: 1,
      usu_nombre: 'Prueba',
      usu_correo: 'p@activareforce.com',
      est_id: ESTADO.ACTIVO,
      roles: roles.map((rol_id) => ({ rol_id })),
      permisos: [],
    },
    permisos: [],
  } as never;
}

beforeEach(() => {
  llamadas.length = 0;
});

describe('quién entra', () => {
  it('Propietario y Admin sí', () => {
    expect(() => service.exigirGlobal(actor([ROL.PROPIETARIO]))).not.toThrow();
    expect(() => service.exigirGlobal(actor([ROL.ADMIN]))).not.toThrow();
  });

  it('un coordinador o un entrenador no, aunque tengan reportes:ver', () => {
    expect(() => service.exigirGlobal(actor([ROL.COORDINADOR]))).toThrow(/Propietario y Admin/);
    expect(() => service.exigirGlobal(actor([ROL.ENTRENADOR]))).toThrow(/Propietario y Admin/);
  });

  it('con varios roles basta con que uno sea global', () => {
    expect(() => service.exigirGlobal(actor([ROL.ENTRENADOR, ROL.ADMIN]))).not.toThrow();
  });
});

describe('construir', () => {
  it('sin filtros no hay WHERE ni parámetros', () => {
    for (const c of CONJUNTOS) {
      const { sql, params } = construir(c, {});
      expect(params).toEqual([]);
      expect(sql).not.toMatch(/\$\d/);
    }
  });

  it('con todos los filtros, tantos valores como marcadores y sin huecos', () => {
    const todos = {
      buscar: 'ana', colegio: 1, actividad: 2, entrenador: 3, estado: 1, asistencia: 2, rol: 3,
      desde: '2026-01-01', hasta: '2026-02-01',
    };
    for (const c of CONJUNTOS) {
      const { sql, params } = construir(c, todos);
      const marcadores = new Set([...sql.matchAll(/\$(\d+)/g)].map(([, n]) => Number(n)));
      expect(params.length).toBe(filtrosDe(c).length);
      expect([...marcadores].sort((a, b) => a - b)).toEqual(params.map((_, i) => i + 1));
    }
  });

  it('un filtro que el conjunto no admite se ignora, no rompe', () => {
    const colegios = CONJUNTOS.find((c) => c.id === 'colegios')!;
    expect(construir(colegios, { asistencia: 1, rol: 2 }).params).toEqual([]);
  });

  it('una búsqueda en blanco no filtra', () => {
    const alumnos = CONJUNTOS.find((c) => c.id === 'alumnos')!;
    expect(construir(alumnos, { buscar: '   ' }).params).toEqual([]);
  });

  it('todos los SELECT leen solo de archivo', () => {
    for (const c of CONJUNTOS) {
      expect(c.select).not.toMatch(/\bpublic\./);
      expect(c.select).toMatch(/archivo\./);
    }
  });
});

describe('consultar', () => {
  it('el orden pedido solo entra si es una columna declarada', async () => {
    await service.consultar('usuarios', {
      page: 1, limit: 50, dir: 'desc', orden: 'usu_nombre; DROP TABLE x',
    } as never);
    const pagina = llamadas.find((l) => l.sql.includes('LIMIT'))!;
    expect(pagina.sql).not.toContain('DROP');
    expect(pagina.sql).toContain('ORDER BY r.usu_nombre');

    llamadas.length = 0;
    await service.consultar('usuarios', { page: 1, limit: 50, dir: 'desc', orden: 'usu_correo' } as never);
    expect(llamadas.find((l) => l.sql.includes('LIMIT'))!.sql).toContain('r."usu_correo" DESC NULLS LAST');
  });

  it('proyecta las columnas declaradas y convierte los números', async () => {
    const r = await service.consultar('usuarios', { page: 2, limit: 10, dir: 'asc' } as never);
    expect(Object.keys(r.filas[0]!)).toEqual(r.columnas.map((c) => c.clave));
    expect(r.filas[0]!.usu_id).toBe(7);
    expect(r.total).toBe(3);
    expect(r.totalPages).toBe(1);
    const pagina = llamadas.find((l) => l.sql.includes('LIMIT'))!;
    expect(pagina.params.slice(-2)).toEqual([10, 10]);
  });

  it('un conjunto que no existe da 404', async () => {
    await expect(service.consultar('nada', { page: 1, limit: 5, dir: 'asc' } as never)).rejects.toThrow(
      /no existe/,
    );
  });
});

describe('resumen', () => {
  it('cada consulta recibe exactamente los marcadores que usa', () => {
    for (const sql of [SQL_INDICADORES, ...GRAFICAS_HISTORICO.map((g) => g.sql)]) {
      const mayor = Math.max(0, ...[...sql.matchAll(/\$(\d+)/g)].map(([, n]) => Number(n)));
      expect(parametrosResumen(sql, { colegio: 1, desde: '2026-01-01', hasta: '2026-02-01' })).toHaveLength(mayor);
    }
  });

  it('las gráficas con escala de asistencia llevan los cuatro estados en el orden de la paleta', () => {
    for (const g of GRAFICAS_HISTORICO.filter((x) => x.escala === 'asistencia')) {
      expect(g.series.map((s) => s.clave)).toEqual(['presente', 'tarde', 'justificado', 'ausente']);
    }
  });
});

describe('el xlsx', () => {
  /** Se genera de verdad y se vuelve a leer: ver la misma prueba en Reportes. */
  async function generar(fn: (s: NodeJS.WritableStream) => Promise<unknown>) {
    const { PassThrough } = await import('node:stream');
    const ExcelJS = (await import('exceljs')).default;
    const salida = new PassThrough();
    const trozos: Buffer[] = [];
    salida.on('data', (t: Buffer) => trozos.push(t));
    await fn(salida);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(Buffer.concat(trozos) as never);
    return libro;
  }

  it('un conjunto: su hoja con cabecera fija y autofiltro, y la de información', async () => {
    const libro = await generar((s) =>
      service.exportar(actor([ROL.PROPIETARIO]), 'usuarios', { dir: 'asc' } as never, s as never),
    );
    expect(libro.worksheets.map((h) => h.name)).toEqual(['Usuarios', 'Información']);
    const hoja = libro.worksheets[0]!;
    expect(hoja.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(hoja.autoFilter).toBeTruthy();
    expect(hoja.getRow(2).getCell(1).value).toBe(7);
  });

  it('todo: una hoja por conjunto más la de información', async () => {
    const libro = await generar((s) => service.exportarTodo(actor([ROL.ADMIN]), s as never));
    expect(libro.worksheets).toHaveLength(CONJUNTOS.length + 1);
  });
});
