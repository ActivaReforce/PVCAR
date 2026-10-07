import imageCompression from 'browser-image-compression';

/**
 * Las opciones son las de la propia librería, no una copia a mano.
 *
 * Antes eran un tipo local que se pasaba con `as any` porque no encajaba con
 * el de `browser-image-compression`. Los dos `any` tapaban justo lo que
 * importa: si la librería renombra una opción, esto tiene que dejar de
 * compilar en vez de comprimir con los valores por defecto sin avisar.
 */
export type CompressionOptions = Parameters<typeof imageCompression>[1];

/**
 * El tope por defecto NO es arbitrario: el bucket `usufoto` rechaza cualquier
 * objeto de más de 512 000 bytes (migración 0003). 0,4 MB deja margen para
 * que la cabecera del formato no se coma el límite.
 */
const POR_DEFECTO: CompressionOptions = {
  maxSizeMB: 0.4,
  maxWidthOrHeight: 800,
  initialQuality: 0.8,
  useWebWorker: true,
};

/**
 * Comprime una foto antes de subirla. Si falla, devuelve el original: el
 * bucket dirá que no si se pasa de tamaño, y ese mensaje es más útil que
 * romper la subida aquí.
 */
export const compressImage = async (
  file: File,
  options: CompressionOptions = {},
): Promise<File> => {
  try {
    return await imageCompression(file, { ...POR_DEFECTO, ...options });
  } catch (err) {
    console.warn('No se pudo comprimir la foto, se sube el original:', err);
    return file;
  }
};
