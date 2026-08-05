import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  // Uno o varios origenes separados por coma (localhost + preview de Vercel, por ejemplo).
  FRONTEND_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  SUPABASE_URL: z.string().url(),
  // Secretos: opcionales en arranque local de scaffold; requeridos en runtime real.
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

  DATABASE_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables de entorno invalidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/** Origenes permitidos por CORS, ya separados y limpios. */
export const allowedOrigins: string[] = env.FRONTEND_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Origen canonico del frontend: el PRIMERO de FRONTEND_ORIGIN.
 * Con el se arma el enlace del correo de recuperacion de contrasena, asi que
 * el orden de la variable importa: el primero debe ser el dominio real del
 * ambiente (pvcar.vercel.app en production, dev-pvcar.vercel.app en development).
 */
export const frontendBaseUrl: string =
  allowedOrigins[0] ?? 'http://localhost:5173';

/** Lanza si falta un secreto que un endpoint requiere en runtime. */
export function requireSecret(
  key: 'SUPABASE_SERVICE_ROLE_KEY' | 'SUPABASE_ANON_KEY' | 'DATABASE_URL',
): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Falta variable de entorno requerida: ${key}`);
  }
  return value;
}
