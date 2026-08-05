import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, requireSecret } from './env.js';

/**
 * Cliente admin de Supabase con service-role.
 * Ignora RLS. Solo backend. Lazy para no exigir el secreto en scaffold.
 */
let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!admin) {
    const serviceRole = requireSecret('SUPABASE_SERVICE_ROLE_KEY');
    admin = createClient(env.SUPABASE_URL, serviceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return admin;
}

/**
 * Cliente con anon key. Sirve para las operaciones de Supabase Auth que
 * NO son de administracion: signInWithPassword y resetPasswordForEmail.
 * Se usa la anon key y no el service-role a proposito: son llamadas de
 * usuario final y el service-role no debe viajar en ellas.
 *
 * persistSession: false — el backend no guarda sesion de nadie. La sesion
 * que devuelve el login se le entrega al navegador y muere aqui.
 */
let anon: SupabaseClient | null = null;

export function getSupabaseAnon(): SupabaseClient {
  if (!anon) {
    const anonKey = requireSecret('SUPABASE_ANON_KEY');
    anon = createClient(env.SUPABASE_URL, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return anon;
}
