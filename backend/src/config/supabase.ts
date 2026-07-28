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
