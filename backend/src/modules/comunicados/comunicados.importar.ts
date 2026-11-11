import ExcelJS from 'exceljs';
import { ApiError } from '../../middleware/error.js';

/**
 * Importar contactos desde un Excel (.xlsx) o un CSV.
 *
 * No se exige un formato: en cada fila se busca la celda con un correo y el
 * nombre es la primera otra celda con texto. Así sirve lo mismo una lista
 * "Nombre | Correo" que "Correo | Nombre" o una exportación con más columnas.
 * Una fila sin correo pero con la palabra correo/email es la cabecera y se
 * salta; una fila con texto y sin correo válido se enseña como mal escrita.
 */

export const MAX_FILAS = 5000;

const CORREO = /^[^\s@<>()[\]",;:]+@[^\s@<>()[\]",;:]+\.[a-z]{2,}$/i;
const CORREO_DENTRO = /[^\s@<>()[\]",;:]+@[^\s@<>()[\]",;:]+\.[a-z]{2,}/i;
const CABECERA = /^(correo|e-?mail|mail|nombres?|name|apellidos?)\b/i;

export function esCorreo(texto: string): boolean {
  return CORREO.test(texto.trim());
}

export interface FilaLeida {
  fila: number;
  nombre: string;
  correo: string | null;
  /** La fila tal cual, para enseñarla si está mal. */
  texto: string;
}

/** CSV con comillas; el separador se adivina por la primera línea (; , o tab). */
export function leerCsv(texto: string): string[][] {
  const limpio = texto.startsWith(String.fromCharCode(0xfeff)) ? texto.slice(1) : texto;
  const primera = limpio.split(/\r?\n/, 1)[0] ?? '';
  const cuenta = (c: string) => primera.split(c).length - 1;
  const sep = [';', ',', '\t'].reduce((a, b) => (cuenta(b) > cuenta(a) ? b : a), ',');

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]!;
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else celda += c;
  }
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

async function leerXlsx(buffer: Buffer): Promise<string[][]> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ApiError(400, 'No se pudo leer el Excel. Guárdalo como .xlsx o como CSV y vuelve a intentarlo.');
  }
  const hoja = libro.worksheets[0];
  if (!hoja) return [];
  const filas: string[][] = [];
  hoja.eachRow({ includeEmpty: true }, (row) => {
    const celdas: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      celdas.push(String(cell.text ?? '').trim());
    });
    filas.push(celdas);
  });
  return filas;
}

/** Saca de cada fila el correo y el nombre. */
export function interpretar(filas: string[][]): FilaLeida[] {
  const salida: FilaLeida[] = [];
  filas.forEach((celdas, i) => {
    const limpias = celdas.map((c) => c.replace(/\s+/g, ' ').trim());
    const conTexto = limpias.filter(Boolean);
    if (conTexto.length === 0) return;

    let correo: string | null = null;
    let indiceCorreo = -1;
    limpias.forEach((c, j) => {
      if (correo) return;
      const hallado = CORREO_DENTRO.exec(c)?.[0];
      if (hallado && esCorreo(hallado)) {
        correo = hallado.toLowerCase();
        indiceCorreo = j;
      }
    });

    if (!correo && conTexto.some((c) => CABECERA.test(c)) && salida.length === 0) return;

    let nombre = limpias.find((c, j) => j !== indiceCorreo && c && !c.includes('@')) ?? '';
    // "Ana Pérez <ana@x.com>" en una sola celda: el nombre es lo de antes.
    if (!nombre && indiceCorreo >= 0) {
      nombre = (limpias[indiceCorreo] ?? '').replace(CORREO_DENTRO, '').replace(/[<>()"]/g, '').trim();
    }
    salida.push({ fila: i + 1, nombre: nombre.slice(0, 120), correo, texto: conTexto.join(' · ').slice(0, 200) });
  });
  return salida;
}

/** Lee el archivo que subió el Propietario (base64) y devuelve sus filas. */
export async function leerArchivo(nombreArchivo: string, base64: string): Promise<FilaLeida[]> {
  const buffer = Buffer.from(base64, 'base64');
  const ext = nombreArchivo.toLowerCase().split('.').pop() ?? '';
  let filas: string[][];
  if (ext === 'xlsx') filas = await leerXlsx(buffer);
  else if (ext === 'csv' || ext === 'txt') filas = leerCsv(buffer.toString('utf8'));
  else if (ext === 'xls') throw new ApiError(400, 'El formato .xls antiguo no se puede leer. Guárdalo como .xlsx o CSV.');
  else throw new ApiError(400, 'Sube un archivo .xlsx o .csv.');

  const leidas = interpretar(filas);
  if (leidas.length > MAX_FILAS) {
    throw new ApiError(400, `El archivo tiene ${leidas.length} filas; el máximo por importación es ${MAX_FILAS}.`);
  }
  return leidas;
}

export interface FilaContacto {
  nombre: string;
  correo: string;
}

export interface Revision {
  nuevos: FilaContacto[];
  repetidosArchivo: Array<FilaContacto & { fila: number }>;
  yaContactos: FilaContacto[];
  yaRepresentantes: Array<FilaContacto & { representante: string }>;
  invalidos: Array<{ fila: number; texto: string }>;
}

/** Reparte las filas en los grupos que ve el Propietario antes de confirmar. */
export function clasificar(
  filas: FilaLeida[],
  contactos: Set<string>,
  representantes: Map<string, string>,
): Revision {
  const r: Revision = { nuevos: [], repetidosArchivo: [], yaContactos: [], yaRepresentantes: [], invalidos: [] };
  const vistos = new Set<string>();
  for (const f of filas) {
    if (!f.correo) {
      r.invalidos.push({ fila: f.fila, texto: f.texto });
      continue;
    }
    const fila = { nombre: f.nombre, correo: f.correo };
    if (vistos.has(f.correo)) {
      r.repetidosArchivo.push({ ...fila, fila: f.fila });
      continue;
    }
    vistos.add(f.correo);
    if (contactos.has(f.correo)) r.yaContactos.push(fila);
    else if (representantes.has(f.correo)) {
      r.yaRepresentantes.push({ ...fila, representante: representantes.get(f.correo) ?? '' });
    } else r.nuevos.push(fila);
  }
  return r;
}
