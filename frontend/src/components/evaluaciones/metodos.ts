import { METODO } from '@/api/evaluaciones';

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

/** Segundos → "m:ss", que es como se lee un tiempo de prueba física. */
export function enMinutos(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
