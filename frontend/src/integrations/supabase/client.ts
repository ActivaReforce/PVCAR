import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Las claves vienen de variables de entorno (Vite). NUNCA hardcodeadas.
// La anon key es publica por diseño y se usa SOLO para Supabase Auth (login/sesion).
// Ningun dato de negocio se lee por aqui: todo pasa por el backend (@/lib/api).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa tu .env (ver .env.example).',
  );
}

/**
 * El enlace del correo de "olvidé mi contraseña" llega con
 * `#access_token=…&type=recovery` (o `#error_code=otp_expired…` si caducó).
 * supabase-js lo consume y lo BORRA de la URL al crearse el cliente, y emite
 * PASSWORD_RECOVERY una sola vez. Como /reset-password se carga en diferido,
 * llegaba tarde a las dos cosas y daba por malo un enlace bueno (2026-10-07).
 * Por eso se lee aquí, antes de crear el cliente, y se escucha desde ya.
 */
const HASH_INICIAL = typeof window !== 'undefined' ? window.location.hash : '';
let recuperacion = HASH_INICIAL.includes('type=recovery');
const errorDelEnlace = new URLSearchParams(HASH_INICIAL.replace(/^#/, '')).get('error_code');

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

supabase.auth.onAuthStateChange((evento) => {
  if (evento === 'PASSWORD_RECOVERY') recuperacion = true;
});

/** Si esta visita llegó por un enlace de recuperación de contraseña. */
export function llegoPorRecuperacion(): boolean {
  return recuperacion;
}

/** El error que trajo el enlace (`otp_expired`, …), o null. */
export function errorDeEnlace(): string | null {
  return errorDelEnlace;
}
