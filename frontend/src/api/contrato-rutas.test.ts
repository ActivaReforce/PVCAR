import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * El contrato entre el cliente y el backend, comprobado leyendo los dos.
 *
 * Una llamada a una ruta que no existe devuelve 404 "Recurso no encontrado",
 * que parece un endpoint sin construir y suele ser un prefijo de mas o un
 * nombre cambiado en uno de los dos lados. No lo ve ni el compilador —las
 * rutas son texto— ni las pruebas de servicio, que van por debajo del router.
 *
 * Tambien se comprueba el orden: en Express gana la primera que encaja, asi
 * que `/disciplinas/dias` declarada despues de `/disciplinas/:id` nunca se
 * alcanza y "dias" acaba de id.
 */

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..', '..');

interface Ruta {
  metodo: string;
  ruta: string;
  router: string;
}

function rutasDelBackend(): Ruta[] {
  const app = readFileSync(join(raiz, 'backend', 'src', 'app.ts'), 'utf8');
  const prefijos = new Map<string, string>();
  for (const [, pref, router] of app.matchAll(/api\.use\('(\/[a-z]+)',\s*(\w+)Router\)/g)) {
    prefijos.set(router!, pref!);
  }
  for (const [, router] of app.matchAll(/api\.use\((\w+)Router\)/g)) {
    if (!prefijos.has(router!)) prefijos.set(router!, '');
  }

  const archivos = import.meta.glob('../../../backend/src/modules/*/*.routes.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  const rutas: Ruta[] = [];
  for (const [, fuente] of Object.entries(archivos).sort(([a], [b]) => a.localeCompare(b))) {
    for (const [, router, metodo, camino] of fuente.matchAll(
      /(\w+)Router\.(get|post|patch|put|delete)\(\s*'([^']*)'/g,
    )) {
      const prefijo = prefijos.get(router!);
      if (prefijo === undefined) continue;
      rutas.push({
        metodo: metodo!.toUpperCase(),
        ruta: (prefijo + camino!).replace(/\/$/, '') || prefijo,
        router: router!,
      });
    }
  }
  return rutas;
}

/** `api.metodo<Tipo>('/ruta')`, con el generico posiblemente anidado. */
function llamadasDelCliente(): Array<{ metodo: string; ruta: string; archivo: string }> {
  const archivos = import.meta.glob('../**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  const llamadas: Array<{ metodo: string; ruta: string; archivo: string }> = [];
  for (const [archivo, fuente] of Object.entries(archivos)) {
    if (archivo.endsWith('contrato-rutas.test.ts')) continue;
    for (const encontrado of fuente.matchAll(/api\.(get|post|patch|put|delete|descargar)\b/g)) {
      let i = encontrado.index! + encontrado[0].length;
      const salta = () => {
        while (i < fuente.length && /\s/.test(fuente[i]!)) i++;
      };
      salta();
      if (fuente[i] === '<') {
        let nivel = 0;
        while (i < fuente.length) {
          if (fuente[i] === '<') nivel++;
          else if (fuente[i] === '>' && --nivel === 0) {
            i++;
            break;
          }
          i++;
        }
      }
      salta();
      if (fuente[i] !== '(') continue;
      i++;
      salta();
      const comilla = fuente[i];
      if (comilla !== '`' && comilla !== "'" && comilla !== '"') continue;
      i++;
      let ruta = '';
      while (i < fuente.length && fuente[i] !== comilla) ruta += fuente[i++];
      llamadas.push({
        metodo: encontrado[1]!.toUpperCase() === 'DESCARGAR' ? 'POST' : encontrado[1]!.toUpperCase(),
        ruta,
        archivo,
      });
    }
  }
  return llamadas;
}

/**
 * Quita las interpolaciones: `${id}` es un segmento, `${queryString(f)}` no.
 * Se queda con la lectura mas probable, que es la que sale al navegador.
 */
function comoLlegaAlServidor(ruta: string): string {
  let salida = '';
  let i = 0;
  while (i < ruta.length) {
    if (ruta.startsWith('${', i)) {
      let nivel = 1;
      i += 2;
      let dentro = '';
      while (i < ruta.length && nivel > 0) {
        if (ruta[i] === '{') nivel++;
        else if (ruta[i] === '}') nivel--;
        if (nivel > 0) dentro += ruta[i];
        i++;
      }
      const esQuery = dentro.includes('queryString') || dentro.includes('?');
      salida += esQuery ? '' : 'X';
    } else {
      salida += ruta[i++];
    }
  }
  return salida.split('?')[0]!.replace(/\/$/, '') || '/';
}

const patron = (ruta: string) => new RegExp(`^${ruta.replace(/:[A-Za-z_]+/g, '[^/]+')}$`);

describe('contrato de rutas entre el cliente y el backend', () => {
  const rutas = rutasDelBackend();
  const llamadas = llamadasDelCliente();

  it('encuentra las dos partes', () => {
    expect(rutas.length).toBeGreaterThan(100);
    expect(llamadas.length).toBeGreaterThan(100);
  });

  it('cada llamada del cliente da con una ruta del backend', () => {
    const huerfanas = llamadas
      .filter(({ metodo, ruta }) => {
        const camino = comoLlegaAlServidor(ruta);
        return !rutas.some((r) => r.metodo === metodo && patron(r.ruta).test(camino));
      })
      .map(({ metodo, ruta, archivo }) => `${metodo} ${ruta} (${archivo})`);

    expect(huerfanas).toEqual([]);
  });

  it('ninguna ruta literal queda tapada por un :param declarado antes', () => {
    const tapadas: string[] = [];
    rutas.forEach((r, i) => {
      if (r.ruta.includes(':')) return;
      const antes = rutas
        .slice(0, i)
        .find(
          (p) =>
            p.router === r.router &&
            p.metodo === r.metodo &&
            p.ruta.includes(':') &&
            patron(p.ruta).test(r.ruta),
        );
      if (antes) tapadas.push(`${r.metodo} ${r.ruta} la tapa ${antes.ruta}`);
    });

    expect(tapadas).toEqual([]);
  });
});
