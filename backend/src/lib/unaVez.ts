/**
 * Que un mismo envío se procese una sola vez aunque llegue dos.
 *
 * El formulario de inscripción reintenta solo cuando falla la conexión
 * (2026-10-20: un papá en el iPhone perdió el envío y tuvo que llenarlo todo
 * otra vez). Pero un fallo de conexión no dice si el envío llegó: puede
 * haberse perdido solo la respuesta. Sin esto, el reintento crearía una
 * segunda inscripción o, peor, le diría "ya tienes cuenta" justo por la
 * cuenta que acaba de crear la primera.
 *
 * El navegador manda la misma clave (`Idempotency-Key`) en todos los intentos
 * de un envío. Si llega una clave ya vista, se devuelve el resultado de la
 * primera —o se espera a que termine si todavía está en curso—. Si la primera
 * falló, se olvida, para que el reintento pueda volver a probar.
 *
 * Vive en memoria: Railway corre una sola instancia y basta con cubrir los
 * minutos de un reintento. Un reinicio la vacía, que es lo mismo que no tenerla.
 */

const DURA_MS = 15 * 60_000;
const TOPE = 1000;

const vistos = new Map<string, { vence: number; resultado: Promise<unknown> }>();

/** Una clave válida: la que genera el navegador, sin nada raro. */
export function claveValida(valor: string | undefined): string | null {
  return valor && /^[A-Za-z0-9-]{16,64}$/.test(valor) ? valor : null;
}

function limpiar(ahora: number): void {
  for (const [clave, v] of vistos) {
    if (v.vence <= ahora) vistos.delete(clave);
  }
  // Por si alguien manda claves sin parar: se van las más viejas.
  while (vistos.size > TOPE) {
    const primera = vistos.keys().next().value;
    if (primera === undefined) break;
    vistos.delete(primera);
  }
}

export function unaVez<T>(clave: string | null, hacer: () => Promise<T>): Promise<T> {
  if (!clave) return hacer();

  const ahora = Date.now();
  limpiar(ahora);

  const previo = vistos.get(clave);
  if (previo) return previo.resultado as Promise<T>;

  const resultado = hacer();
  vistos.set(clave, { vence: ahora + DURA_MS, resultado });
  resultado.catch(() => vistos.delete(clave));
  return resultado;
}
