import { describe, expect, it } from 'vitest';
import { paramsUsados } from './sql.js';

describe('paramsUsados', () => {
  it('recorta los parametros que la consulta no menciona', () => {
    const sql = 'SELECT 1 WHERE a = $1 AND b = $2';
    expect(paramsUsados(sql, ['a', 'b', 'sobra', 'sobra'])).toEqual(['a', 'b']);
  });

  it('se queda con el marcador mas alto, no con cuantos distintos hay', () => {
    const sql = 'SELECT 1 WHERE a = $1 AND c = $3';
    expect(paramsUsados(sql, [1, 2, 3, 4])).toEqual([1, 2, 3]);
  });

  it('no inventa parametros si faltan', () => {
    expect(paramsUsados('SELECT $1, $2', [1])).toEqual([1]);
  });

  it('sin marcadores devuelve vacio', () => {
    expect(paramsUsados('SELECT now()', [1, 2])).toEqual([]);
  });
});
