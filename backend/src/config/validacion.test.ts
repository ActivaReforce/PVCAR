import { describe, expect, it } from 'vitest';
import { fallosDeProduccion } from './validacion.js';

/**
 * El guardia de arranque de produccion.
 *
 * Comprueba lo que una persona escribe a mano en el dashboard de Railway, que
 * es donde se cometen estos errores. Falla al arrancar y no en la primera
 * peticion, porque en el arranque alguien esta mirando los logs.
 */

const SECRETOS = {
  SUPABASE_SERVICE_ROLE_KEY: 'clave',
  SUPABASE_ANON_KEY: 'clave',
  DATABASE_URL: 'postgres://x',
};

describe('fallosDeProduccion', () => {
  it('no se queja de una configuracion buena', () => {
    expect(fallosDeProduccion(SECRETOS, ['https://pvcar.vercel.app'])).toEqual([]);
  });

  it('admite varios origenes https', () => {
    const fallos = fallosDeProduccion(SECRETOS, [
      'https://pvcar.vercel.app',
      'https://activareforce.com',
    ]);
    expect(fallos).toEqual([]);
  });

  it('nombra cada secreto que falta', () => {
    const fallos = fallosDeProduccion(
      { SUPABASE_SERVICE_ROLE_KEY: undefined, SUPABASE_ANON_KEY: 'x', DATABASE_URL: undefined },
      ['https://pvcar.vercel.app'],
    );
    expect(fallos).toEqual(['falta SUPABASE_SERVICE_ROLE_KEY', 'falta DATABASE_URL']);
  });

  it('rechaza el comodin', () => {
    const fallos = fallosDeProduccion(SECRETOS, ['*']);
    expect(fallos).toHaveLength(1);
    expect(fallos[0]).toContain('"*"');
  });

  it('rechaza http pelado', () => {
    const fallos = fallosDeProduccion(SECRETOS, ['http://pvcar.vercel.app']);
    expect(fallos.some((f) => f.includes('https'))).toBe(true);
  });

  it('rechaza localhost, que es el olvido tipico al copiar la variable de dev', () => {
    const fallos = fallosDeProduccion(SECRETOS, ['https://pvcar.vercel.app', 'http://localhost:5173']);
    expect(fallos.some((f) => f.includes('localhost'))).toBe(true);
  });

  it('rechaza la barra final: con ella el CORS no casa y todo el frontend da 403', () => {
    const fallos = fallosDeProduccion(SECRETOS, ['https://pvcar.vercel.app/']);
    expect(fallos.some((f) => f.includes('barra'))).toBe(true);
  });

  it('rechaza un origen con ruta', () => {
    const fallos = fallosDeProduccion(SECRETOS, ['https://pvcar.vercel.app/app']);
    expect(fallos.some((f) => f.includes('barra'))).toBe(true);
  });

  it('rechaza lo que no es una URL', () => {
    const fallos = fallosDeProduccion(SECRETOS, ['pvcar.vercel.app']);
    expect(fallos.some((f) => f.includes('no es una URL'))).toBe(true);
  });

  it('se queja de la lista vacia', () => {
    expect(fallosDeProduccion(SECRETOS, [])).toEqual(['FRONTEND_ORIGIN vacio']);
  });
});
