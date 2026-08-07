import type { PoolClient } from 'pg';
import { getPool } from '../config/db.js';

/**
 * Ejecuta una funcion dentro de una transaccion y devuelve su resultado.
 *
 * Por que hace falta: en el sistema viejo guardar un usuario dispara hasta
 * seis escrituras sueltas (transiciones de rol, update de usuario, delete de
 * usuario_rol, insert de usuario_rol, insert/update en entrenador o padre).
 * Si falla la cuarta, el usuario se queda SIN NINGUN ROL y nadie lo deshace.
 *
 * Regla del sistema nuevo: una operacion de negocio = una transaccion.
 *
 * El cliente se toma del pool y se devuelve siempre, tambien si el callback
 * revienta: un client sin release deja la conexion colgada hasta el timeout.
 */
export async function enTransaccion<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Fallo el ROLLBACK:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}
