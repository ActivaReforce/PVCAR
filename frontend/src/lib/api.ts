import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error('Falta VITE_API_URL. Revisa tu .env (ver .env.example).');
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

/**
 * Cliente fetch contra el backend PVCAR.
 * Adjunta el JWT de Supabase Auth si hay sesion activa.
 * Un 401 cierra la sesion local: el token murio o fue revocado.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
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
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
