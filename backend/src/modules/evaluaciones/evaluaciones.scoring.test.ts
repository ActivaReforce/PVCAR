import { describe, expect, it } from 'vitest';
import {
  METODO,
  columnasDelIntento,
  puntajePorIntento,
  puntuarIntento,
  sumarPuntajes,
  type ParametroPuntuable,
} from './evaluaciones.scoring.js';

/**
 * El scoring, método a método.
 *
 * Es lo único del sistema donde un error silencioso cambia la nota de un niño,
 * así que estas pruebas son la red: cada método con sus bordes, sus valores
 * intermedios y sus entradas equivocadas.
 */

function parametro(campos: Partial<ParametroPuntuable> = {}): ParametroPuntuable {
  return {
    evaparam_id: 1,
    evaparam_nombre: 'Prueba',
    evatipometo_id: METODO.LOGRO,
    evaparam_intentos: 1,
    evaparam_puntaje: 10,
    evaparam_escala_min: null,
    evaparam_escala_max: null,
    rango: null,
    ...campos,
  };
}

describe('reparto entre intentos', () => {
  it('un parametro de 12 puntos con 4 intentos vale 3 por intento', () => {
    expect(puntajePorIntento(parametro({ evaparam_puntaje: 12, evaparam_intentos: 4 }))).toBe(3);
  });

  it('con 0 intentos no divide por cero', () => {
    expect(puntajePorIntento(parametro({ evaparam_puntaje: 10, evaparam_intentos: 0 }))).toBe(10);
  });
});

describe('metodo 2 — por logro', () => {
  const p = parametro({ evatipometo_id: METODO.LOGRO, evaparam_puntaje: 10 });

  it('lo consigue: todo el puntaje del intento', () => {
    expect(puntuarIntento(p, { logro: true })).toBe(10);
  });

  it('no lo consigue: cero', () => {
    expect(puntuarIntento(p, { logro: false })).toBe(0);
  });

  it('con varios intentos reparte, y redondea a dos decimales', () => {
    const tres = parametro({
      evatipometo_id: METODO.LOGRO,
      evaparam_puntaje: 10,
      evaparam_intentos: 3,
    });
    // 10/3 = 3.333... El sistema viejo daba 3.3 aqui (redondeaba a un decimal).
    expect(puntuarIntento(tres, { logro: true })).toBe(3.33);
  });

  it('sin valor, 400', () => {
    expect(() => puntuarIntento(p, {})).toThrowError(/espera si se logró/);
  });
});

describe('metodo 3 — por escala', () => {
  const p = parametro({
    evatipometo_id: METODO.ESCALA,
    evaparam_puntaje: 10,
    evaparam_escala_min: 0,
    evaparam_escala_max: 5,
  });

  it('el minimo da cero y el maximo da todo', () => {
    expect(puntuarIntento(p, { escala: 0 })).toBe(0);
    expect(puntuarIntento(p, { escala: 5 })).toBe(10);
  });

  it('un valor intermedio interpola', () => {
    expect(puntuarIntento(p, { escala: 2 })).toBe(4);
    expect(puntuarIntento(p, { escala: 3 })).toBe(6);
  });

  it('fuera de rango se recorta, no se dispara', () => {
    expect(puntuarIntento(p, { escala: 99 })).toBe(10);
    expect(puntuarIntento(p, { escala: -4 })).toBe(0);
  });

  it('sin minimo configurado toma 0', () => {
    const sinMin = parametro({
      evatipometo_id: METODO.ESCALA,
      evaparam_puntaje: 10,
      evaparam_escala_min: null,
      evaparam_escala_max: 10,
    });
    expect(puntuarIntento(sinMin, { escala: 5 })).toBe(5);
  });

  /**
   * El frontend viejo inventaba un maximo de 10 cuando faltaba y devolvia una
   * nota plausible. Aqui es un 409: el parametro esta mal configurado y hay que
   * arreglarlo, no seguir puntuando con un supuesto.
   */
  it('sin maximo configurado no se inventa uno: 409', () => {
    const sinMax = parametro({
      evatipometo_id: METODO.ESCALA,
      evaparam_escala_min: 0,
      evaparam_escala_max: null,
    });
    expect(() => puntuarIntento(sinMax, { escala: 5 })).toThrowError(/rango no es válido/);
  });

  it('con el maximo por debajo del minimo, 409', () => {
    const alReves = parametro({
      evatipometo_id: METODO.ESCALA,
      evaparam_escala_min: 8,
      evaparam_escala_max: 3,
    });
    expect(() => puntuarIntento(alReves, { escala: 5 })).toThrowError(/rango no es válido/);
  });
});

describe('metodo 1 — por tiempo', () => {
  /** Una carrera: 30s o mas es 0; 10s o menos es todo. 10 puntos. */
  const carrera = parametro({
    evatipometo_id: METODO.TIEMPO,
    evaparam_puntaje: 10,
    rango: {
      evatieran_op_cero: '>=',
      evatieran_tiempo_cero: 30,
      evatieran_op_full: '<=',
      evatieran_tiempo_full: 10,
    },
  });

  it('en el umbral de cero o peor, cero', () => {
    expect(puntuarIntento(carrera, { tiempo: 30 })).toBe(0);
    expect(puntuarIntento(carrera, { tiempo: 45 })).toBe(0);
  });

  it('en el umbral completo o mejor, todo', () => {
    expect(puntuarIntento(carrera, { tiempo: 10 })).toBe(10);
    expect(puntuarIntento(carrera, { tiempo: 4 })).toBe(10);
  });

  it('el punto medio da la mitad', () => {
    // 20s esta a mitad de camino entre 30 y 10.
    expect(puntuarIntento(carrera, { tiempo: 20 })).toBe(5);
  });

  it('interpola y redondea a dos decimales', () => {
    // (25-30)/(10-30) = 0.25 -> 2.5
    expect(puntuarIntento(carrera, { tiempo: 25 })).toBe(2.5);
    // (13-30)/(10-30) = 0.85 -> 8.5
    expect(puntuarIntento(carrera, { tiempo: 13 })).toBe(8.5);
    // (17-30)/(10-30) = 0.65 -> 6.5
    expect(puntuarIntento(carrera, { tiempo: 17 })).toBe(6.5);
  });

  it('funciona al reves: una prueba de aguante', () => {
    // Menos de 60s es 0; 180s o mas es todo.
    const aguante = parametro({
      evatipometo_id: METODO.TIEMPO,
      evaparam_puntaje: 12,
      rango: {
        evatieran_op_cero: '<=',
        evatieran_tiempo_cero: 60,
        evatieran_op_full: '>=',
        evatieran_tiempo_full: 180,
      },
    });
    expect(puntuarIntento(aguante, { tiempo: 60 })).toBe(0);
    expect(puntuarIntento(aguante, { tiempo: 180 })).toBe(12);
    expect(puntuarIntento(aguante, { tiempo: 120 })).toBe(6);
  });

  it('reparte entre intentos', () => {
    const dos = parametro({
      evatipometo_id: METODO.TIEMPO,
      evaparam_puntaje: 10,
      evaparam_intentos: 2,
      rango: carrera.rango,
    });
    expect(puntuarIntento(dos, { tiempo: 20 })).toBe(2.5);
    expect(puntuarIntento(dos, { tiempo: 4 })).toBe(5);
  });

  it('un parametro por tiempo sin umbrales configurados es un 409, no un 0', () => {
    const sinRango = parametro({ evatipometo_id: METODO.TIEMPO, rango: null });
    expect(() => puntuarIntento(sinRango, { tiempo: 20 })).toThrowError(/no tiene umbrales/);
  });

  it('sin tiempo, 400', () => {
    expect(() => puntuarIntento(carrera, {})).toThrowError(/espera un tiempo/);
  });
});

describe('metodo 4 — Mobak de 6 intentos', () => {
  /** Configurado como en los datos reales: 2 puntos, 1 intento. */
  const p = parametro({
    evatipometo_id: METODO.MOBAK_6,
    evaparam_puntaje: 2,
    evaparam_intentos: 1,
  });

  it('agrupa 0-2 en 0, 3-4 en 1 y 5-6 en 2', () => {
    expect(puntuarIntento(p, { mobak: 0 })).toBe(0);
    expect(puntuarIntento(p, { mobak: 2 })).toBe(0);
    expect(puntuarIntento(p, { mobak: 3 })).toBe(1);
    expect(puntuarIntento(p, { mobak: 4 })).toBe(1);
    expect(puntuarIntento(p, { mobak: 5 })).toBe(2);
    expect(puntuarIntento(p, { mobak: 6 })).toBe(2);
  });

  /**
   * El arreglo: el sistema viejo devolvia 0, 1 o 2 literales e ignoraba el
   * puntaje del parametro, asi que este caso daba 1 sobre un maximo de 10 y el
   * total de la evaluacion prometia puntos inalcanzables.
   */
  it('escala al puntaje configurado del parametro', () => {
    const rico = parametro({
      evatipometo_id: METODO.MOBAK_6,
      evaparam_puntaje: 10,
      evaparam_intentos: 1,
    });
    expect(puntuarIntento(rico, { mobak: 6 })).toBe(10);
    expect(puntuarIntento(rico, { mobak: 3 })).toBe(5);
    expect(puntuarIntento(rico, { mobak: 1 })).toBe(0);
  });

  it('una puntuacion fuera de 0-6 se rechaza', () => {
    expect(() => puntuarIntento(p, { mobak: 7 })).toThrowError(/de 0 a 6/);
    expect(() => puntuarIntento(p, { mobak: -1 })).toThrowError(/de 0 a 6/);
  });
});

describe('metodo 5 — Mobak de 2 intentos', () => {
  const p = parametro({
    evatipometo_id: METODO.MOBAK_2,
    evaparam_puntaje: 2,
    evaparam_intentos: 1,
  });

  it('0, 1 y 2 valen 0, 1 y 2', () => {
    expect(puntuarIntento(p, { mobak: 0 })).toBe(0);
    expect(puntuarIntento(p, { mobak: 1 })).toBe(1);
    expect(puntuarIntento(p, { mobak: 2 })).toBe(2);
  });

  it('el tope es 2', () => {
    expect(() => puntuarIntento(p, { mobak: 3 })).toThrowError(/de 0 a 2/);
  });
});

describe('cada metodo escribe solo su columna', () => {
  it('tiempo', () => {
    const p = parametro({ evatipometo_id: METODO.TIEMPO });
    expect(columnasDelIntento(p, { tiempo: 20, logro: true, escala: 3, mobak: 5 })).toEqual({
      tiempo: 20,
      logro: null,
      num: null,
      mobak: null,
    });
  });

  it('logro', () => {
    const p = parametro({ evatipometo_id: METODO.LOGRO });
    expect(columnasDelIntento(p, { tiempo: 20, logro: true })).toEqual({
      tiempo: null,
      logro: true,
      num: null,
      mobak: null,
    });
  });

  it('escala va a evaint_num', () => {
    const p = parametro({ evatipometo_id: METODO.ESCALA });
    expect(columnasDelIntento(p, { escala: 3 })).toEqual({
      tiempo: null,
      logro: null,
      num: 3,
      mobak: null,
    });
  });

  it('mobak', () => {
    const p = parametro({ evatipometo_id: METODO.MOBAK_6 });
    expect(columnasDelIntento(p, { mobak: 5 })).toEqual({
      tiempo: null,
      logro: null,
      num: null,
      mobak: 5,
    });
  });
});

describe('suma del alumno', () => {
  it('suma y redondea a dos decimales', () => {
    expect(sumarPuntajes([3.33, 3.33, 3.33])).toBe(9.99);
    expect(sumarPuntajes([])).toBe(0);
    expect(sumarPuntajes([0.1, 0.2])).toBe(0.3);
  });
});

describe('metodo desconocido', () => {
  it('no puntua a ciegas', () => {
    const raro = parametro({ evatipometo_id: 99 });
    expect(() => puntuarIntento(raro, { logro: true })).toThrowError(/Método de evaluación/);
  });
});
