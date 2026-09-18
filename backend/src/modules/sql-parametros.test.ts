/**
 * Todo el SQL de los repositorios, sin base de datos.
 *
 * Se finge el pool, se llama a cada funcion exportada y se recoge el SQL que
 * genera. Con eso se comprueba lo unico que Postgres no perdona y que ninguna
 * prueba de servicio ve, porque los repositorios van siempre fingidos:
 *
 *   1. tantos valores como marcadores  -> `bind message supplies 8 parameters,
 *      but prepared statement "" requires 6`
 *   2. sin huecos entre $1 y $n        -> `no se pudo determinar el tipo del
 *      parametro $6`
 *
 * Las dos tumbaron pantallas enteras con un 500 (Disciplinas, Entrenadores y
 * Estudiantes, 2026-09-18) y las dos son invisibles hasta que alguien abre la
 * pantalla.
 *
 * Con PVCAR_VOLCAR_SQL=1 ademas escribe `dump-sql.json` en la raiz del repo.
 * Sirve para el barrido completo: levantar un Postgres de usar y tirar con las
 * migraciones de `db/migrations`, hacer `PREPARE` de cada consulta y que el
 * propio motor valide tablas, columnas y tipos. Esta contado en
 * `docs/barrido-sql.md`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';

const capturado: Array<{ modulo: string; fn: string; variante: number; sql: string; params: number }> = [];
let actual = { modulo: '', fn: '', variante: 0 };

/** Fila fingida: cualquier campo devuelve 1, para que la funcion siga adelante. */
const fila = new Proxy({} as Record<string, unknown>, {
  get: (_o, clave) => (clave === 'then' ? undefined : 1),
  has: () => true,
});

const query = vi.fn(async (sql: string, params: unknown[] = []) => {
  capturado.push({ ...actual, sql, params: params.length });
  return { rows: [fila, fila], rowCount: 1 };
});

vi.mock('../config/db.js', () => ({ getPool: () => ({ query }) }));

const cliente = { query };
const ALCANCE = { global: false, colegios: [1], disciplinas: [1] };

function valorDe(tipo: string, booleano: boolean): unknown {
  const t = tipo.trim();
  if (t.includes('PoolClient')) return cliente;
  if (t.includes('Alcance')) return ALCANCE;
  if (/Query\b/.test(t) || /^\{/.test(t) || /Input\b/.test(t)) {
    return {
      page: 1, limit: 25, buscar: 'a', orden: undefined, dir: 'asc',
      colegio: [1], actividad: [1], disciplina: 1, dia: 1, estado: 1, grado: 1,
      rol: [1], sinRol: booleano, sinEntrenador: booleano, sinAsignar: booleano,
      sinDisciplinas: booleano, categoria: 'x', desde: '2026-01-01', hasta: '2026-09-18',
      historial: booleano, colacthorId: 1, fecha: '2026-09-18', nino_id: 1, usu_id: 1,
    };
  }
  if (t.includes('number[]')) return [1];
  if (t.includes('string[]')) return ['x'];
  if (t.includes('boolean')) return booleano;
  if (t.includes('number')) return 1;
  if (t.includes('string')) return '2026-09-18';
  return {};
}

/** Parte la lista de parametros por comas de primer nivel. */
function partirParametros(texto: string): string[] {
  const partes: string[] = [];
  let nivel = 0;
  let actualTexto = '';
  for (const c of texto) {
    if ('<([{'.includes(c)) nivel++;
    if ('>)]}'.includes(c)) nivel--;
    if (c === ',' && nivel === 0) {
      partes.push(actualTexto);
      actualTexto = '';
    } else actualTexto += c;
  }
  if (actualTexto.trim()) partes.push(actualTexto);
  return partes.filter((p) => p.trim().length > 0);
}

it('cada consulta manda tantos valores como marcadores, y sin huecos', async () => {
  const aqui = dirname(fileURLToPath(import.meta.url));
  const base = aqui;
  const errores: string[] = [];

  // `import.meta.glob` lo resuelve Vite en tiempo de compilacion; tsc no lo
  // conoce, de ahi el cast.
  const repositorios = (
    import.meta as unknown as {
      glob: (patron: string) => Record<string, () => Promise<Record<string, unknown>>>;
    }
  ).glob('./*/*.repository.ts');

  for (const [ruta, cargar] of Object.entries(repositorios)) {
    const carpeta = ruta.split('/')[1] ?? '';
    const archivo = join(base, carpeta, `${carpeta}.repository.ts`);
    const fuente = readFileSync(archivo, 'utf8');
    const modulo = (await cargar()) as Record<string, unknown>;

    for (const coincidencia of fuente.matchAll(/export async function (\w+)\(([\s\S]*?)\)\s*:/g)) {
      const nombre = coincidencia[1] ?? '';
      const params = coincidencia[2] ?? '';
      const fn = modulo[nombre];
      if (typeof fn !== 'function') continue;
      const tipos = partirParametros(params).map((p) => p.split(':').slice(1).join(':') || 'number');

      for (const [variante, booleano] of [true, false].entries()) {
        actual = { modulo: carpeta, fn: nombre, variante };
        try {
          await fn(...tipos.map((t) => valorDe(t, booleano)));
        } catch (err) {
          errores.push(`${carpeta}.${nombre} v${variante}: ${(err as Error).message}`);
        }
      }
    }
  }

  // Lo que no vive en un repositorio: alcance, auditoria y las definiciones de reportes.
  actual = { modulo: 'lib', fn: 'alcanceDe', variante: 0 };
  const { alcanceDe } = await import('../lib/alcance.js');
  for (const roles of [[{ rol_id: 3 }], [{ rol_id: 2 }, { rol_id: 5 }]]) {
    try {
      await alcanceDe({ usu_id: 1, roles } as never);
    } catch (err) {
      errores.push(`lib.alcanceDe: ${(err as Error).message}`);
    }
  }

  actual = { modulo: 'lib', fn: 'auditar', variante: 0 };
  const { auditar } = await import('../lib/auditoria.js');
  try {
    await auditar(
      {
        actor: { usuario: { usu_id: 1, usu_correo: 'a@b.c' } },
        accion: 'crear',
        entidad: 'x',
        entidadId: '1',
        detalle: {},
      } as never,
      cliente as never,
    );
  } catch (err) {
    errores.push(`lib.auditar: ${(err as Error).message}`);
  }

  const { DEFINICIONES } = await import('./reportes/reportes.definiciones.js');
  const ctx = { global: false, colegios: [1], disciplinas: [1], actorId: 1 };
  for (const definicion of DEFINICIONES) {
    for (const [variante, f] of [
      {},
      { buscar: 'a', colegio: [1], disciplina: 1, estado: 1, desde: '2026-01-01', hasta: '2026-09-18' },
    ].entries()) {
      actual = { modulo: 'reportes', fn: definicion.id, variante };
      const { sql, params } = definicion.construir(f, ctx);
      capturado.push({ ...actual, sql, params: params.length });
    }
  }

  if (process.env.PVCAR_VOLCAR_SQL === '1') {
    writeFileSync(
      join(aqui, '..', '..', '..', 'dump-sql.json'),
      JSON.stringify({ capturado, errores }, null, 2),
    );
  }

  // Si el arnes deja de recorrer los modulos, esto lo canta.
  expect(capturado.length).toBeGreaterThan(300);

  const malas = capturado
    .map(({ modulo, fn, sql, params }) => {
      const marcadores = [...sql.matchAll(/\$(\d+)/g)].map(([, n]) => Number(n));
      const mayor = Math.max(0, ...marcadores);
      const usados = new Set(marcadores);
      const huecos = Array.from({ length: mayor }, (_, i) => i + 1).filter((n) => !usados.has(n));

      if (params === mayor && huecos.length === 0) return null;
      return `${modulo}.${fn}: manda ${params} valores, la consulta usa hasta $${mayor}${
        huecos.length > 0 ? `, sin usar ${huecos.map((n) => `$${n}`).join(', ')}` : ''
      }`;
    })
    .filter((m): m is string => m !== null);

  expect(malas).toEqual([]);
});
