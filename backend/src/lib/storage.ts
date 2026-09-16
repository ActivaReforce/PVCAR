import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/error.js';

/**
 * Fotos de usuario en el bucket `usufoto`.
 *
 * El bucket es PRIVADO (migracion 0003). En la prod vieja es publico: las 61
 * fotos se ven con la URL, sin sesion. Aqui el navegador nunca habla con
 * Storage con una key: el backend firma URLs de corta vida.
 *
 * La subida tambien va firmada. Es la unica forma de no meter multipart en el
 * API: el backend emite una URL de subida de un solo uso para una ruta que el
 * elige, y el navegador sube el archivo directo a Storage.
 */
const BUCKET = 'usufoto';

/** Una hora: sobra para pintar una lista y no deja URLs utiles por ahi. */
const VIGENCIA_LECTURA_SEG = 60 * 60;

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface SubidaFirmada {
  /** Ruta que hay que guardar despues en la columna de foto. */
  path: string;
  signedUrl: string;
  token: string;
}

/**
 * Carpetas del bucket. Una por tipo de sujeto: las fotos de personas y las de
 * los contactos de un colegio no se mezclan, y asi la ruta guardada dice de
 * quien es sin mirar la fila.
 */
export const CARPETAS = ['usuarios', 'colegios'] as const;
export type Carpeta = (typeof CARPETAS)[number];

/** Valida una ruta guardada: carpeta conocida y nombre sin sorpresas. */
export function rutaValida(valor: string, carpeta: Carpeta): boolean {
  return new RegExp(`^${carpeta}/[A-Za-z0-9._-]{1,120}$`).test(valor);
}

/**
 * Nombre nuevo en cada subida (uuid), nunca el id del usuario: si la ruta
 * fuera fija, el navegador seguiria mostrando la foto vieja desde su cache y
 * el usuario creeria que no se guardo.
 */
export async function firmarSubidaFoto(
  mimeType: string,
  carpeta: Carpeta = 'usuarios',
): Promise<SubidaFirmada> {
  const extension = EXTENSIONES[mimeType];
  if (!extension) {
    throw new ApiError(400, 'Formato no admitido. Solo jpeg, png o webp.');
  }

  const path = `${carpeta}/${randomUUID()}.${extension}`;
  const { data, error } = await getSupabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new ApiError(502, `No se pudo preparar la subida: ${error?.message ?? 'sin detalle'}`);
  }

  return { path, signedUrl: data.signedUrl, token: data.token };
}

/** True si el valor guardado es una URL absoluta del sistema viejo. */
function esUrlHeredada(valor: string): boolean {
  return valor.startsWith('http://') || valor.startsWith('https://');
}

/**
 * Firma varias rutas de una vez. Las fotos de la prod vieja estan guardadas
 * como URL absoluta del proyecto antiguo: se devuelven tal cual hasta que se
 * reemplacen, porque firmarlas no tendria sentido.
 */
export async function firmarFotos(rutas: Array<string | null>): Promise<Map<string, string>> {
  const firmables = [
    ...new Set(rutas.filter((r): r is string => r !== null && !esUrlHeredada(r))),
  ];
  const firmadas = new Map<string, string>();

  if (firmables.length === 0) return firmadas;

  const { data, error } = await getSupabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUrls(firmables, VIGENCIA_LECTURA_SEG);

  if (error || !data) {
    // Una foto que no se puede firmar no debe tumbar la pantalla entera.
    console.error('No se pudieron firmar las fotos:', error?.message);
    return firmadas;
  }

  for (const item of data) {
    if (item.signedUrl && item.path) {
      firmadas.set(item.path, item.signedUrl);
    }
  }
  return firmadas;
}

/** Firma una sola ruta. Devuelve null si no hay foto. */
export async function firmarFoto(ruta: string | null): Promise<string | null> {
  if (!ruta) return null;
  if (esUrlHeredada(ruta)) return ruta;
  const firmadas = await firmarFotos([ruta]);
  return firmadas.get(ruta) ?? null;
}

/** Borra el objeto anterior al reemplazar o quitar la foto. Best-effort. */
export async function borrarFoto(ruta: string | null): Promise<void> {
  if (!ruta || esUrlHeredada(ruta)) return;
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).remove([ruta]);
  if (error) {
    console.error(`No se pudo borrar la foto ${ruta}:`, error.message);
  }
}
