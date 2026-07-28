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

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
