import pg from 'pg';
import { env } from './env.js';

const { Pool, types } = pg;

/**
 * Las columnas `date` salen como texto `YYYY-MM-DD`, no como `Date`.
 *
 * Por defecto pg las convierte a medianoche en la zona del contenedor (UTC en
 * Railway) y el JSON lleva `2026-10-07T00:00:00.000Z`; un navegador en Ecuador
 * lo enseña como el 6. Una fecha sin hora no tiene zona y no se convierte.
 */
types.setTypeParser(types.builtins.DATE, (valor) => valor);

/**
 * Pool Postgres contra el pooler de Supabase.
 * Lazy: solo se crea cuando DATABASE_URL existe y algo lo pide.
 */
let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL no configurada — no se puede abrir el pool Postgres.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // Supabase pooler requiere SSL.
      ssl: { rejectUnauthorized: false },
    });
    pool.on('error', (err) => {
      console.error('Error inesperado en cliente idle del pool pg:', err);
    });
  }
  return pool;
}

export async function pingDb(): Promise<boolean> {
  const result = await getPool().query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
