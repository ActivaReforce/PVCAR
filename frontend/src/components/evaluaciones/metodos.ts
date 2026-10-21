import { METODO, type RangoTiempo } from '@/api/evaluaciones';

/**
 * Los cinco métodos, con lo que hay que saber de cada uno para pintarlo.
 *
 * Un solo sitio. En el sistema viejo el `evatipometo_id` iba suelto —`=== 1`,
 * `=== 4 || === 5`— en tres archivos y dentro de un componente de 1 132 líneas,
 * y las tablas de puntuación Mobak estaban escritas a mano en el JSX del aviso.
 */
export interface PintaMetodo {
  id: number;
  nombre: string;
  /** Qué registra el evaluador, dicho en una línea. */
  registra: string;
  /** Lo que hay que configurar al crear el parámetro. */
  configura: string | null;
}

export const METODOS: Record<number, PintaMetodo> = {
  [METODO.TIEMPO]: {
    id: METODO.TIEMPO,
    nombre: 'Por tiempo',
    registra: 'Un tiempo en minutos y segundos',
    configura: 'Dos umbrales: uno da 0 puntos y otro el puntaje completo',
  },
  [METODO.LOGRO]: {
    id: METODO.LOGRO,
    nombre: 'Por logro',
    registra: 'Lo consiguió o no',
    configura: null,
  },
  [METODO.ESCALA]: {
    id: METODO.ESCALA,
    nombre: 'Por escala',
    registra: 'Un valor dentro de la escala',
    configura: 'El mínimo y el máximo de la escala',
  },
  [METODO.MOBAK_6]: {
    id: METODO.MOBAK_6,
    nombre: 'Mobak de 6',
    registra: 'Una puntuación de 0 a 6',
    configura: null,
  },
  [METODO.MOBAK_2]: {
    id: METODO.MOBAK_2,
    nombre: 'Mobak de 2',
    registra: 'Una puntuación de 0 a 2',
    configura: null,
  },
};

export const esMobak = (metodoId: number) =>
  metodoId === METODO.MOBAK_6 || metodoId === METODO.MOBAK_2;

export const topeMobak = (metodoId: number) => (metodoId === METODO.MOBAK_6 ? 6 : 2);

/**
 * Cómo se agrupa la puntuación Mobak, para enseñarlo junto a los botones.
 *
 * El de 6 agrupa (0-2→0, 3-4→1, 5-6→2) y el de 2 va uno a uno. Lo que sale es
 * la proporción del puntaje del parámetro, no un número absoluto: un parámetro
 * Mobak de 10 puntos da 10 con la puntuación máxima, no 2.
 */
export function brutoMobak(metodoId: number, puntuacion: number): number {
  if (metodoId === METODO.MOBAK_6) {
    if (puntuacion <= 2) return 0;
    if (puntuacion <= 4) return 1;
    return 2;
  }
  return Math.max(0, Math.min(2, puntuacion));
}

/** Operador de un umbral de tiempo, dicho con palabras. */
export const etiquetaOperador = (op: string): string => {
  if (op === '<') return 'menor que';
  if (op === '<=') return 'menor o igual que';
  if (op === '>') return 'mayor que';
  return 'mayor o igual que';
};

/** Segundos → "m:ss", que es como se lee un tiempo de prueba física. */
export function enMinutos(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Puntaje en vivo (2026-10-15)
//
// Mismo cálculo que el backend (`modules/evaluaciones/evaluaciones.scoring.ts`):
// `aDosDecimales`, interpolación lineal con los umbrales, Mobak agrupado, etc.
// Se replica aquí para enseñar el puntaje mientras se evalúa; al guardar, el
// servidor es el que vale.

function aDos(v: number): number {
  return Math.round(v * 100) / 100;
}

function cumple(valor: number, op: string, umbral: number): boolean {
  if (op === '>') return valor > umbral;
  if (op === '>=') return valor >= umbral;
  if (op === '<') return valor < umbral;
  if (op === '<=') return valor <= umbral;
  return false;
}

export interface ParametroVivo {
  evatipometo_id: number;
  evaparam_intentos: number;
  evaparam_puntaje: number;
  evaparam_escala_min: number | null;
  evaparam_escala_max: number | null;
  rango: {
    evatieran_op_cero: string;
    evatieran_tiempo_cero: number;
    evatieran_op_full: string;
    evatieran_tiempo_full: number;
  } | null;
}

export interface IntentoVivo {
  tiempo: number | null;
  logro: boolean | null;
  escala: number | null;
  mobak: number | null;
}

/** Lo que vale un intento como máximo. */
export function puntajePorIntento(p: ParametroVivo): number {
  return p.evaparam_puntaje / Math.max(1, p.evaparam_intentos);
}

/** Puntaje de un intento ya registrado. Null si falta el valor del método. */
export function puntuarIntento(p: ParametroVivo, i: IntentoVivo): number | null {
  const maximo = puntajePorIntento(p);
  if (p.evatipometo_id === METODO.TIEMPO) {
    if (i.tiempo === null || !p.rango) return null;
    const r = p.rango;
    if (cumple(i.tiempo, r.evatieran_op_cero, r.evatieran_tiempo_cero)) return 0;
    if (cumple(i.tiempo, r.evatieran_op_full, r.evatieran_tiempo_full)) return aDos(maximo);
    const cero = r.evatieran_tiempo_cero;
    const full = r.evatieran_tiempo_full;
    if (cero === full) return 0;
    const proporcion = (i.tiempo - cero) / (full - cero);
    return aDos(Math.max(0, Math.min(1, proporcion)) * maximo);
  }
  if (p.evatipometo_id === METODO.LOGRO) {
    if (i.logro === null) return null;
    return i.logro ? aDos(maximo) : 0;
  }
  if (p.evatipometo_id === METODO.ESCALA) {
    if (i.escala === null) return null;
    const min = p.evaparam_escala_min ?? 0;
    const max = p.evaparam_escala_max;
    if (max === null || max <= min) return null;
    const prop = (i.escala - min) / (max - min);
    return aDos(Math.max(0, Math.min(1, prop)) * maximo);
  }
  if (esMobak(p.evatipometo_id)) {
    if (i.mobak === null) return null;
    const bruto = brutoMobak(p.evatipometo_id, i.mobak);
    return aDos((bruto / 2) * maximo);
  }
  return null;
}

/** Suma de los intentos puntuables de un parámetro. */
export function puntajeDeParametro(p: ParametroVivo, intentos: IntentoVivo[]): number {
  let total = 0;
  for (const i of intentos) {
    const n = puntuarIntento(p, i);
    if (n !== null) total += n;
  }
  return aDos(total);
}

// ---------------------------------------------------------------------------
// Lo que se registra en cada intento (2026-10-16), compartido por la pantalla
// de evaluar y la vista previa.

/** Lo registrado para un intento, antes de mandarlo. */
export interface Registro {
  tiempo: string;
  logro: boolean | null;
  escala: number | null;
  mobak: number | null;
}

export const vacio = (): Registro => ({ tiempo: '', logro: null, escala: null, mobak: null });

/** Lo que hace falta de un parámetro para pintar sus controles. */
export interface ParametroCampos {
  evatipometo_id: number;
  evaparam_escala_min?: number | null;
  evaparam_escala_max?: number | null;
  rango?: RangoTiempo | null;
}

/** "1:30" o "90" → 90 segundos. */
export function aSegundos(texto: string): number | null {
  const limpio = texto.trim();
  if (!limpio) return null;
  if (limpio.includes(':')) {
    const [m, s] = limpio.split(':');
    const minutos = Number(m);
    const segundos = Number(s);
    if (Number.isNaN(minutos) || Number.isNaN(segundos)) return null;
    return minutos * 60 + segundos;
  }
  const n = Number(limpio);
  return Number.isNaN(n) ? null : n;
}

/** Un intento cuenta como registrado si su método tiene valor. */
export function estaRegistrado(p: ParametroCampos, r: Registro): boolean {
  if (p.evatipometo_id === METODO.TIEMPO) return aSegundos(r.tiempo) !== null;
  if (p.evatipometo_id === METODO.LOGRO) return r.logro !== null;
  if (p.evatipometo_id === METODO.ESCALA) return r.escala !== null;
  return r.mobak !== null;
}

/** El registro, solo con el valor de su método, listo para puntuar o mandar. */
export function aIntentoVivo(p: ParametroCampos, r: Registro): IntentoVivo {
  return {
    tiempo: p.evatipometo_id === METODO.TIEMPO ? aSegundos(r.tiempo) : null,
    logro: p.evatipometo_id === METODO.LOGRO ? r.logro : null,
    escala: p.evatipometo_id === METODO.ESCALA ? r.escala : null,
    mobak: esMobak(p.evatipometo_id) ? r.mobak : null,
  };
}

export const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
