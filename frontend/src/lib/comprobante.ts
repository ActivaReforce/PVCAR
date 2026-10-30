import { ApiError } from '@/lib/api';
import { compressImage } from '@/lib/imageCompression';

/**
 * El comprobante de pago: la misma preparación que en el formulario de
 * inscripción (Inscripcion.tsx), para el pago de las mensualidades.
 */

/** JPEG siempre: una captura del banco en PNG pesa diez veces más. Lanza un texto si no sirve. */
export async function prepararComprobante(archivo: File): Promise<File> {
  if (!archivo.type.startsWith('image/')) throw new Error('El comprobante tiene que ser una foto o captura (imagen).');
  const comprimido = await compressImage(archivo, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1800,
    initialQuality: 0.85,
    fileType: 'image/jpeg',
  });
  if (comprimido.size > 2 * 1024 * 1024) {
    throw new Error('La imagen pesa demasiado incluso comprimida. Prueba con una captura.');
  }
  return comprimido;
}

export function aBase64(archivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });
}

export function nuevaClave(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const azar = () => Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${azar()}-${azar()}`;
}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

/** Reintenta si no llegó respuesta o Railway se reiniciaba (502–504). Un error del servidor no se repite. */
export async function conReintentos<T>(hacer: () => Promise<T>): Promise<T> {
  const pausas = [1500, 3000];
  for (let intento = 0; ; intento++) {
    try {
      return await hacer();
    } catch (err) {
      const reintentable = !(err instanceof ApiError) || [502, 503, 504].includes(err.status);
      if (!reintentable || intento >= pausas.length) throw err;
      await esperar(pausas[intento]);
    }
  }
}
