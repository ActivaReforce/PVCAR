import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/error.js';

/**
 * Comprobantes de pago y contratos en el bucket `inscripciones` (migracion
 * 0014). Privado, como `usufoto`: solo el backend escribe, y se lee por URL
 * firmada de corta vida.
 *
 * A diferencia de las fotos, aqui no hay subida firmada desde el navegador:
 * el formulario es publico y emitir URLs de subida a cualquiera dejaria
 * llenar el bucket de archivos sin inscripcion detras. El comprobante viaja
 * dentro del envio y el backend lo sube solo si el envio es valido.
 */
const BUCKET = 'inscripciones';

/** Diez minutos: lo justo para abrir el archivo desde la ficha. */
const VIGENCIA_LECTURA_SEG = 10 * 60;

export const MIME_COMPROBANTE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function subirArchivo(
  carpeta: 'comprobantes' | 'contratos' | 'membretes',
  contenido: Buffer,
  mimeType: string,
  extension: string,
): Promise<string> {
  const path = `${carpeta}/${randomUUID()}.${extension}`;
  const { error } = await getSupabaseAdmin()
    .storage.from(BUCKET)
    .upload(path, contenido, { contentType: mimeType, upsert: false });

  if (error) {
    throw new ApiError(502, `No se pudo guardar el archivo: ${error.message}`);
  }
  return path;
}

/** Firma varias rutas. Una que falle se queda fuera del mapa, sin tumbar nada. */
export async function firmarArchivos(rutas: string[]): Promise<Map<string, string>> {
  const firmadas = new Map<string, string>();
  const unicas = [...new Set(rutas)];
  if (unicas.length === 0) return firmadas;

  const { data, error } = await getSupabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUrls(unicas, VIGENCIA_LECTURA_SEG);

  if (error || !data) {
    console.error('No se pudieron firmar archivos de inscripcion:', error?.message);
    return firmadas;
  }
  for (const item of data) {
    if (item.signedUrl && item.path) firmadas.set(item.path, item.signedUrl);
  }
  return firmadas;
}

/** Best-effort: un archivo huerfano en un bucket privado no es grave. */
export async function borrarArchivos(rutas: string[]): Promise<void> {
  if (rutas.length === 0) return;
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).remove(rutas);
  if (error) {
    console.error(`No se pudieron borrar ${rutas.length} archivo(s) de inscripcion:`, error.message);
  }
}

/** Descarga un archivo del bucket. null si no se pudo. */
export async function descargarArchivo(ruta: string): Promise<Buffer | null> {
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(ruta);
  if (error || !data) {
    console.error(`No se pudo descargar ${ruta}:`, error?.message);
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}
