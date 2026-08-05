/**
 * Lectura de bloques COPY de un dump de pg_dump en formato texto.
 * Modulo aparte y sin efectos secundarios: lo usa backfill-auth.ts y lo va a
 * volver a usar la transformacion de datos del cutover (Fase 16), que tiene
 * que reescribir el mismo bloque de public.usuario sin usu_contrasena.
 */

import { readFileSync } from 'node:fs';

/** Deshace el escapado del formato texto de COPY. \N es NULL. */
export function desescapar(valor: string): string | null {
  if (valor === '\\N') return null;
  return valor
    .replace(/\\t/g, '\t')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
}

/**
 * Extrae las filas del bloque `COPY public.<tabla> (...) FROM stdin;`.
 * Las columnas se leen de la cabecera del propio COPY: si el orden cambia en
 * un dump futuro, esto sigue funcionando.
 *
 * pg_dump escapa los saltos de linea dentro de los valores como \n, asi que
 * partir por lineas es seguro: ninguna fila se parte en dos.
 */
export function leerBloqueCopy(
  ruta: string,
  tabla: string,
): Array<Record<string, string | null>> {
  const lineas = readFileSync(ruta, 'utf8').split('\n');
  const cabecera = `COPY public.${tabla} (`;
  const inicio = lineas.findIndex((l) => l.startsWith(cabecera));

  if (inicio === -1) {
    throw new Error(`No se encontro el bloque "${cabecera}" en ${ruta}`);
  }

  const linea = lineas[inicio];
  const columnas = linea
    .slice(linea.indexOf('(') + 1, linea.indexOf(')'))
    .split(',')
    .map((c) => c.trim());

  const filas: Array<Record<string, string | null>> = [];

  for (let i = inicio + 1; i < lineas.length; i++) {
    const cruda = lineas[i].replace(/\r$/, '');
    if (cruda === '\\.') break;
    if (cruda === '') continue;

    const valores = cruda.split('\t');
    const registro: Record<string, string | null> = {};
    columnas.forEach((col, idx) => {
      registro[col] = desescapar(valores[idx] ?? '\\N');
    });
    filas.push(registro);
  }

  return filas;
}
