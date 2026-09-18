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

/**
 * Guardias de arranque de produccion.
 *
 * Las tres variables de abajo son `optional()` en el esquema a proposito: sin
 * eso no se puede arrancar el backend en local para mirar el scaffold, ni
 * correr las pruebas, que no tocan ni Supabase ni Postgres. Pero en produccion
 * faltar una no es una opcion, y hasta ahora el fallo aparecia en la primera
 * peticion que las necesitara -- un 500 en caliente, no un arranque que no
 * arranca.
 *
 * Y el CORS sale de FRONTEND_ORIGIN, que la escribe una persona en el
 * dashboard de Railway. Un `*`, un `localhost` olvidado o un `http://` pelado
 * ahi abren el API a cualquier pagina; el navegador manda la cookie de sesion
 * a un origen permitido sin preguntar. Se comprueba al arrancar, que es el
 * unico momento en que alguien esta mirando.
 *
 * Solo en produccion: en dev y en test estorbaria.
 */
export function fallosDeProduccion(
  secretos: Record<'SUPABASE_SERVICE_ROLE_KEY' | 'SUPABASE_ANON_KEY' | 'DATABASE_URL', string | undefined>,
  origenes: readonly string[],
): string[] {
  const fallos: string[] = [];

  for (const [clave, valor] of Object.entries(secretos)) {
    if (!valor) {
      fallos.push(`falta ${clave}`);
    }
  }

  if (origenes.length === 0) {
    fallos.push('FRONTEND_ORIGIN vacio');
  }

  for (const origen of origenes) {
    if (origen === '*') {
      fallos.push('FRONTEND_ORIGIN no puede ser "*" en produccion');
      continue;
    }
    let url: URL;
    try {
      url = new URL(origen);
    } catch {
      fallos.push(`FRONTEND_ORIGIN tiene un origen que no es una URL: ${origen}`);
      continue;
    }
    if (url.protocol !== 'https:') {
      fallos.push(`FRONTEND_ORIGIN debe ser https en produccion: ${origen}`);
    }
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]') {
      fallos.push(`FRONTEND_ORIGIN no puede apuntar a localhost en produccion: ${origen}`);
    }
    // Un origen lleva esquema + host + puerto y nada mas. Con path o barra al
    // final, el `includes()` del CORS no casaria nunca y TODO el frontend
    // daria 403 -- un fallo total que solo aparece en produccion.
    if (url.pathname !== '/' || origen.endsWith('/')) {
      fallos.push(`FRONTEND_ORIGIN va sin barra ni ruta al final: ${origen}`);
    }
  }

  return fallos;
}

if (env.NODE_ENV === 'production') {
  const fallos = fallosDeProduccion(
    {
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
      DATABASE_URL: env.DATABASE_URL,
    },
    allowedOrigins,
  );
  if (fallos.length > 0) {
    console.error('❌ Configuracion de produccion invalida:');
    for (const fallo of fallos) {
      console.error(`   - ${fallo}`);
    }
    process.exit(1);
  }
}

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
