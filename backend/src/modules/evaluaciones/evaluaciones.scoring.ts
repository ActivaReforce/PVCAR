import { ApiError } from '../../middleware/error.js';

/**
 * Puntuación de un intento. El único sitio del sistema donde se calcula.
 *
 * ---------------------------------------------------------------------------
 * Por qué está aquí y no en el navegador
 *
 * En el sistema viejo los cinco métodos viven en el frontend, repartidos entre
 * `mobakUtils.ts`, `timeScoring.ts` y cuatro funciones sueltas dentro de
 * `EvaluateStudentModal.tsx` (1 132 líneas). El navegador calcula la nota y la
 * manda ya calculada a la base, que la acepta sin mirarla.
 *
 * Eso significa que **la nota de un niño depende de la versión de JavaScript
 * que tenga cargada quien evalúa**. Una pestaña abierta desde antes de un
 * despliegue puntúa distinto que la de al lado, y no queda rastro de cuál fue.
 *
 * Aquí se calcula una vez, en el servidor, y el front solo lo muestra.
 *
 * ---------------------------------------------------------------------------
 * Los cinco métodos
 *
 * | id | Método            | Entrada          | Cómo puntúa                    |
 * |----|-------------------|------------------|--------------------------------|
 * | 1  | Por tiempo        | segundos         | interpolación lineal entre dos umbrales |
 * | 2  | Por logro         | sí / no          | todo o nada                    |
 * | 3  | Por escala        | entero min..max  | proporcional dentro del rango  |
 * | 4  | Mobak 6 intentos  | 0..6             | 0-2→0, 3-4→1, 5-6→2            |
 * | 5  | Mobak 2 intentos  | 0..2             | 0→0, 1→1, 2→2                  |
 *
 * Todos reparten el puntaje del parámetro entre sus intentos: un parámetro de
 * 12 puntos con 4 intentos da como mucho 3 por intento.
 */

export const METODO = {
  TIEMPO: 1,
  LOGRO: 2,
  ESCALA: 3,
  MOBAK_6: 4,
  MOBAK_2: 5,
} as const;

export type MetodoId = (typeof METODO)[keyof typeof METODO];

export interface RangoTiempo {
  /** Operador del umbral que da 0 puntos: '<', '<=', '>' o '>='. */
  evatieran_op_cero: string;
  evatieran_tiempo_cero: number;
  /** Operador del umbral que da el puntaje completo. */
  evatieran_op_full: string;
  evatieran_tiempo_full: number;
}

export interface ParametroPuntuable {
  evaparam_id: number;
  evaparam_nombre: string;
  evatipometo_id: number;
  evaparam_intentos: number;
  evaparam_puntaje: number;
  evaparam_escala_min: number | null;
  evaparam_escala_max: number | null;
  rango: RangoTiempo | null;
}

/** El valor que el evaluador registra para un intento. Solo uno según el método. */
export interface ValorIntento {
  /** Método 1, en segundos. */
  tiempo?: number | null;
  /** Método 2. */
  logro?: boolean | null;
  /** Método 3. */
  escala?: number | null;
  /** Métodos 4 y 5. */
  mobak?: number | null;
}

/** Dos decimales, que es la precisión de `evaint_puntaje_obtenido`. */
function aDosDecimales(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Lo que vale un intento como máximo.
 *
 * El sistema viejo repartía así en tiempo y escala, pero en **logro** hacía
 * `Math.round(x * 10) / 10` — un decimal— y en Mobak ni siquiera repartía (ver
 * abajo). Aquí es la misma cuenta para los cinco y el redondeo también.
 */
export function puntajePorIntento(parametro: ParametroPuntuable): number {
  return parametro.evaparam_puntaje / Math.max(1, parametro.evaparam_intentos);
}

function cumple(valor: number, operador: string, umbral: number): boolean {
  switch (operador) {
    case '>':
      return valor > umbral;
    case '>=':
      return valor >= umbral;
    case '<':
      return valor < umbral;
    case '<=':
      return valor <= umbral;
    default:
      throw new ApiError(500, `Operador de rango desconocido: ${operador}`);
  }
}

/**
 * Método 1 — por tiempo.
 *
 * Dos umbrales: uno da 0 puntos y otro el máximo del intento. Entre los dos,
 * interpolación lineal. La dirección la marcan los operadores: `> 30s → 0` con
 * `<= 20s → todo` es una carrera (menos tiempo, más puntos); al revés es una
 * prueba de aguante.
 *
 * El CHECK `evaluacion_tiempo_rangos_check` del esquema ya obliga a que los dos
 * operadores apunten en sentidos contrarios y a que los tiempos estén en el
 * orden correcto, así que aquí no hay que defenderse de un rango imposible.
 */
function porTiempo(segundos: number, rango: RangoTiempo, maximo: number): number {
  if (cumple(segundos, rango.evatieran_op_cero, rango.evatieran_tiempo_cero)) return 0;
  if (cumple(segundos, rango.evatieran_op_full, rango.evatieran_tiempo_full)) {
    return aDosDecimales(maximo);
  }

  const { evatieran_tiempo_cero: cero, evatieran_tiempo_full: full } = rango;
  if (cero === full) return 0;

  // (distancia recorrida desde el umbral de 0) / (distancia total entre umbrales)
  const proporcion = (segundos - cero) / (full - cero);
  return aDosDecimales(Math.max(0, Math.min(1, proporcion)) * maximo);
}

/**
 * Métodos 4 y 5 — Mobak.
 *
 * MOBAK puntúa de 0 a 2 por ítem; el método 4 recoge 6 intentos y los agrupa
 * (0-2→0, 3-4→1, 5-6→2) y el 5 recoge de 0 a 2 directamente.
 *
 * **Lo que cambia respecto al sistema viejo:** allí el resultado eran esos 0, 1
 * o 2 puntos *literales*, ignorando `evaparam_puntaje`. Un parámetro Mobak
 * configurado con 10 puntos nunca podía dar más de 2, así que
 * `eva_puntaje_total` prometía un máximo inalcanzable y los porcentajes de los
 * informes salían mal. Aquí el 0-2 se escala al puntaje del intento.
 *
 * Es compatible con todos los datos reales: los tres parámetros Mobak que hay
 * en producción están configurados con 2 puntos y 1 intento, y con eso
 * `(bruto / 2) * 2 = bruto`, exactamente lo de antes.
 */
function porMobak(metodo: number, puntuacion: number, maximo: number): number {
  let bruto: number;

  if (metodo === METODO.MOBAK_6) {
    if (puntuacion <= 2) bruto = 0;
    else if (puntuacion <= 4) bruto = 1;
    else bruto = 2;
  } else {
    bruto = Math.max(0, Math.min(2, puntuacion));
  }

  return aDosDecimales((bruto / 2) * maximo);
}

/**
 * Método 3 — por escala.
 *
 * Proporcional entre el mínimo y el máximo configurados. Si no hay mínimo se
 * toma 0, que es lo que hacía el frontend viejo; el máximo, en cambio, **no**
 * se inventa: allí caía a 10 por defecto y con un parámetro mal configurado eso
 * daba una nota plausible y silenciosamente equivocada.
 */
function porEscala(valor: number, parametro: ParametroPuntuable, maximo: number): number {
  const min = parametro.evaparam_escala_min ?? 0;
  const max = parametro.evaparam_escala_max;

  if (max === null || max <= min) {
    throw new ApiError(
      409,
      `El parámetro "${parametro.evaparam_nombre}" es por escala pero su rango no es válido`,
    );
  }

  const proporcion = (valor - min) / (max - min);
  return aDosDecimales(Math.max(0, Math.min(1, proporcion)) * maximo);
}

/**
 * El puntaje de un intento.
 *
 * Lanza 400 si el valor que llega no corresponde al método del parámetro: es
 * la puerta que impide guardar "logro: true" en un parámetro por tiempo y
 * quedarse con 0 puntos sin que nadie se entere.
 */
export function puntuarIntento(parametro: ParametroPuntuable, valor: ValorIntento): number {
  const maximo = puntajePorIntento(parametro);

  switch (parametro.evatipometo_id) {
    case METODO.TIEMPO: {
      if (valor.tiempo === null || valor.tiempo === undefined) {
        throw new ApiError(400, `"${parametro.evaparam_nombre}" espera un tiempo`);
      }
      if (!parametro.rango) {
        throw new ApiError(
          409,
          `El parámetro "${parametro.evaparam_nombre}" es por tiempo pero no tiene umbrales configurados`,
        );
      }
      return porTiempo(valor.tiempo, parametro.rango, maximo);
    }

    case METODO.LOGRO: {
      if (valor.logro === null || valor.logro === undefined) {
        throw new ApiError(400, `"${parametro.evaparam_nombre}" espera si se logró o no`);
      }
      return valor.logro ? aDosDecimales(maximo) : 0;
    }

    case METODO.ESCALA: {
      if (valor.escala === null || valor.escala === undefined) {
        throw new ApiError(400, `"${parametro.evaparam_nombre}" espera un valor de la escala`);
      }
      return porEscala(valor.escala, parametro, maximo);
    }

    case METODO.MOBAK_6:
    case METODO.MOBAK_2: {
      if (valor.mobak === null || valor.mobak === undefined) {
        throw new ApiError(400, `"${parametro.evaparam_nombre}" espera una puntuación Mobak`);
      }
      const tope = parametro.evatipometo_id === METODO.MOBAK_6 ? 6 : 2;
      if (valor.mobak < 0 || valor.mobak > tope) {
        throw new ApiError(
          400,
          `"${parametro.evaparam_nombre}" admite una puntuación de 0 a ${tope}`,
        );
      }
      return porMobak(parametro.evatipometo_id, valor.mobak, maximo);
    }

    default:
      throw new ApiError(409, `Método de evaluación desconocido: ${parametro.evatipometo_id}`);
  }
}

/**
 * Deja en el intento solo la columna que corresponde a su método.
 *
 * `evaluacion_intento` tiene una columna por método (`evaint_tiempo`,
 * `evaint_logro`, `evaint_num`, `evaint_mobak`) y el sistema viejo las
 * escribía **todas** en cada insert, con null en las que no tocaban pero
 * también con valores viejos al corregir. Un parámetro que cambiara de método
 * dejaba filas con dos columnas llenas y ninguna forma de saber cuál valía.
 */
export function columnasDelIntento(
  parametro: ParametroPuntuable,
  valor: ValorIntento,
): { tiempo: number | null; logro: boolean | null; num: number | null; mobak: number | null } {
  const vacio = { tiempo: null, logro: null, num: null, mobak: null };

  switch (parametro.evatipometo_id) {
    case METODO.TIEMPO:
      return { ...vacio, tiempo: valor.tiempo ?? null };
    case METODO.LOGRO:
      return { ...vacio, logro: valor.logro ?? null };
    case METODO.ESCALA:
      return { ...vacio, num: valor.escala ?? null };
    case METODO.MOBAK_6:
    case METODO.MOBAK_2:
      return { ...vacio, mobak: valor.mobak ?? null };
    default:
      return vacio;
  }
}

/** El total de un alumno: la suma de sus intentos, a dos decimales. */
export function sumarPuntajes(puntajes: number[]): number {
  return aDosDecimales(puntajes.reduce((total, p) => total + p, 0));
}
