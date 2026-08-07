import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error('Falta VITE_API_URL. Revisa tu .env (ver .env.example).');
}

/**
 * VITE_API_URL YA incluye el prefijo /api/v1 (asi esta sembrada en Vercel, en
 * los dos ambientes). Las rutas que se le pasan a este cliente van sin el:
 * '/usuarios', no '/api/v1/usuarios'.
 *
 * Duplicarlo costo una tanda de pruebas: la llamada salia a
 * .../api/v1/api/v1/usuarios y el backend contestaba 404 "Recurso no
 * encontrado", que parece que falta el endpoint y no que sobra el prefijo.
 * Por si vuelve a pasar, aqui se quita.
 */
function normalizarRuta(path: string): string {
  return path.startsWith('/api/v1/') ? path.slice('/api/v1'.length) : path;
}

/** Forma estandar de respuesta del backend: { data, error }. */
export interface ApiResponse<T> {
  data: T | null;
  error: { message: string; details?: unknown } | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiFetchOptions {
  /**
   * Si es false, un 401 NO cierra la sesion local.
   * Lo necesita /auth/login: ahi un 401 significa "contrasena incorrecta",
   * no "tu sesion murio", y firmar la salida en ese caso borraria la sesion
   * de quien ya estaba dentro y se equivoco al reautenticarse.
   */
  signOutOn401?: boolean;
}

/**
 * Cliente fetch contra el backend PVCAR.
 * Adjunta el JWT de Supabase Auth si hay sesion activa.
 * Un 401 cierra la sesion local: el token murio o fue revocado.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  { signOutOn401 = true }: ApiFetchOptions = {},
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const res = await fetch(`${API_URL}${normalizarRuta(path)}`, { ...init, headers });

  if (res.status === 401 && signOutOn401) {
    await supabase.auth.signOut();
  }

  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(res.status, `Respuesta no-JSON del servidor (${res.status})`);
  }

  if (!res.ok || body.error) {
    throw new ApiError(res.status, body.error?.message ?? 'Error desconocido', body.error?.details);
  }

  return body.data as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(
      path,
      { method: 'POST', body: body ? JSON.stringify(body) : undefined },
      options,
    ),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  /**
   * DELETE con cuerpo: el borrado permanente manda el texto de confirmacion.
   * No es lo mas ortodoxo del REST, pero la alternativa —mandarlo por la
   * query string— lo dejaria escrito en los logs del servidor.
   */
  delete: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
};
