import { env } from '../../config/env.js';

/**
 * Lo poco de Resend que usa Comunicados: contactos, segmentos y broadcasts.
 *
 * Va con RESEND_API_KEY_BROADCASTS (acceso completo); la key de siempre solo
 * envía y Resend le contesta 401 `restricted_api_key` en estas rutas.
 *
 * El límite de Resend es de 10 peticiones por segundo **por cuenta**, sumando
 * todas las keys (también la de los correos de Inscripciones y la de dev). Se
 * deja aire: una petición cada 150 ms como mucho (~6,6 por segundo). Un 429
 * espera lo que diga `retry-after` y repite; un 5xx o un corte de red, igual
 * con espera creciente. Lo demás (4xx) es definitivo y sube como ResendError.
 *
 * Resend exige un User-Agent: sin él contesta 403 (código 1010).
 */

const BASE = 'https://api.resend.com';
const ENTRE_PETICIONES_MS = 150;
const REINTENTOS = 4;

export class ResendError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ResendError';
  }

  /** 429, 5xx o red: vale la pena volver a intentarlo más tarde. */
  get pasajero(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

let ultima = 0;
let cadena: Promise<void> = Promise.resolve();

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Turno: las peticiones salen en fila, con 150 ms entre una y otra. */
function turno(): Promise<void> {
  const mio = cadena.then(async () => {
    const espera = ultima + ENTRE_PETICIONES_MS - Date.now();
    if (espera > 0) await dormir(espera);
    ultima = Date.now();
  });
  cadena = mio.catch(() => undefined);
  return mio;
}

export function hayClave(): boolean {
  return Boolean(env.RESEND_API_KEY_BROADCASTS);
}

export interface Respuesta<T> {
  status: number;
  data: T | null;
}

/**
 * Una llamada. Devuelve el 404 como respuesta (no como error): "no existe" es
 * algo que el envío necesita saber, no un fallo.
 */
export async function llamar<T>(
  metodo: 'GET' | 'POST' | 'DELETE' | 'PATCH',
  ruta: string,
  cuerpo?: unknown,
): Promise<Respuesta<T>> {
  const clave = env.RESEND_API_KEY_BROADCASTS;
  if (!clave) throw new ResendError(401, 'Falta RESEND_API_KEY_BROADCASTS en Railway');

  let ultimoError: ResendError | null = null;
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    await turno();
    let res: Response;
    try {
      res = await fetch(`${BASE}${ruta}`, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${clave}`,
          'Content-Type': 'application/json',
          'User-Agent': 'pvcar-comunicados/1.0',
        },
        ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      ultimoError = new ResendError(0, `Sin respuesta de Resend: ${(err as Error).message}`);
      await dormir(1000 * 2 ** intento);
      continue;
    }

    if (res.status === 404) return { status: 404, data: null };

    const texto = await res.text();
    let json: unknown = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      json = null;
    }

    if (res.ok) return { status: res.status, data: json as T };

    const mensaje =
      (json as { message?: string } | null)?.message ?? (texto.slice(0, 300) || `HTTP ${res.status}`);
    ultimoError = new ResendError(res.status, `Resend respondió ${res.status}: ${mensaje}`);
    if (!ultimoError.pasajero) throw ultimoError;

    const retry = Number(res.headers.get('retry-after'));
    await dormir(Number.isFinite(retry) && retry > 0 ? retry * 1000 : 1000 * 2 ** intento);
  }
  throw ultimoError ?? new ResendError(0, 'Resend no respondió');
}

// ---------------------------------------------------------------------------
// Las llamadas concretas
// ---------------------------------------------------------------------------

const enc = encodeURIComponent;

/** ¿Ya existe ese correo como contacto en Resend? */
export async function existeContacto(correo: string): Promise<boolean> {
  const r = await llamar<{ id: string }>('GET', `/contacts/${enc(correo)}`);
  return r.status !== 404;
}

/** Crea el contacto ya dentro del segmento. */
export async function crearContacto(correo: string, nombre: string, segmentoId: string): Promise<void> {
  await llamar('POST', '/contacts', {
    email: correo,
    ...(nombre ? { first_name: nombre.slice(0, 100) } : {}),
    segments: [{ id: segmentoId }],
  });
}

/** Mete en el segmento un contacto que ya existía, sin cambiarle nada. */
export async function anadirASegmento(correo: string, segmentoId: string): Promise<void> {
  await llamar('POST', `/contacts/${enc(correo)}/segments/${enc(segmentoId)}`);
}

/** Borra un contacto. Si ya no está, da igual. */
export async function borrarContacto(correo: string): Promise<void> {
  await llamar('DELETE', `/contacts/${enc(correo)}`);
}

export async function crearSegmento(nombre: string): Promise<string> {
  const r = await llamar<{ id: string }>('POST', '/segments', { name: nombre });
  if (!r.data?.id) throw new ResendError(500, 'Resend no devolvió el id del segmento');
  return r.data.id;
}

export async function borrarSegmento(id: string): Promise<void> {
  await llamar('DELETE', `/segments/${enc(id)}`);
}

export interface NuevoBroadcast {
  segmentoId: string;
  de: string;
  responderA: string | null;
  asunto: string;
  html: string;
  nombre: string;
}

/** Crea el broadcast y lo manda en el acto (`send: true`). */
export async function enviarBroadcast(b: NuevoBroadcast): Promise<string> {
  const r = await llamar<{ id: string }>('POST', '/broadcasts', {
    segment_id: b.segmentoId,
    from: b.de,
    subject: b.asunto,
    html: b.html,
    name: b.nombre,
    ...(b.responderA ? { reply_to: b.responderA } : {}),
    send: true,
  });
  if (!r.data?.id) throw new ResendError(500, 'Resend no devolvió el id del broadcast');
  return r.data.id;
}

export interface EstadoBroadcast {
  /** draft | scheduled | queued | sending | sent | canceled (null si ya no existe). */
  status: string | null;
  sent_at: string | null;
}

export async function estadoBroadcast(id: string): Promise<EstadoBroadcast> {
  const r = await llamar<{ status?: string; sent_at?: string | null }>('GET', `/broadcasts/${enc(id)}`);
  return { status: r.data?.status ?? null, sent_at: r.data?.sent_at ?? null };
}
