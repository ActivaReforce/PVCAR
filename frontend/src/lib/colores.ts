/**
 * Colores de las actividades (0022, pedido del cliente 2026-10-06).
 *
 * Pastel a propósito: el borde ámbar de "sin entrenador" tiene que seguir
 * siendo lo primero que se ve, así que el color va solo en el fondo (100 en
 * claro, 950 translúcido en oscuro) con un borde apenas teñido. Ningún tono
 * es amarillo ni naranja, para no confundirse con ese aviso.
 *
 * Las clases van escritas enteras —nada de `bg-${color}-100`— porque
 * Tailwind solo genera las que encuentra literales en el código.
 * Los nombres tienen que coincidir con el CHECK de la migración 0022.
 */
export interface ColorActividad {
  clave: string;
  nombre: string;
  /** Fondo y borde de la tarjeta. */
  tarjeta: string;
  /** La muestra redonda del selector. */
  muestra: string;
}

export const COLORES_ACTIVIDAD: ColorActividad[] = [
  { clave: 'rosa', nombre: 'Rosa', tarjeta: 'bg-pink-100 border-pink-200 hover:bg-pink-200/70 dark:bg-pink-950/40 dark:border-pink-900 dark:hover:bg-pink-950/70', muestra: 'bg-pink-200 dark:bg-pink-800' },
  { clave: 'coral', nombre: 'Coral', tarjeta: 'bg-red-100 border-red-200 hover:bg-red-200/70 dark:bg-red-950/40 dark:border-red-900 dark:hover:bg-red-950/70', muestra: 'bg-red-200 dark:bg-red-800' },
  { clave: 'menta', nombre: 'Menta', tarjeta: 'bg-emerald-100 border-emerald-200 hover:bg-emerald-200/70 dark:bg-emerald-950/40 dark:border-emerald-900 dark:hover:bg-emerald-950/70', muestra: 'bg-emerald-200 dark:bg-emerald-800' },
  { clave: 'verde', nombre: 'Verde', tarjeta: 'bg-lime-100 border-lime-200 hover:bg-lime-200/70 dark:bg-lime-950/40 dark:border-lime-900 dark:hover:bg-lime-950/70', muestra: 'bg-lime-200 dark:bg-lime-800' },
  { clave: 'turquesa', nombre: 'Turquesa', tarjeta: 'bg-teal-100 border-teal-200 hover:bg-teal-200/70 dark:bg-teal-950/40 dark:border-teal-900 dark:hover:bg-teal-950/70', muestra: 'bg-teal-200 dark:bg-teal-800' },
  { clave: 'cielo', nombre: 'Cielo', tarjeta: 'bg-sky-100 border-sky-200 hover:bg-sky-200/70 dark:bg-sky-950/40 dark:border-sky-900 dark:hover:bg-sky-950/70', muestra: 'bg-sky-200 dark:bg-sky-800' },
  { clave: 'azul', nombre: 'Azul', tarjeta: 'bg-blue-100 border-blue-200 hover:bg-blue-200/70 dark:bg-blue-950/40 dark:border-blue-900 dark:hover:bg-blue-950/70', muestra: 'bg-blue-200 dark:bg-blue-800' },
  { clave: 'lavanda', nombre: 'Lavanda', tarjeta: 'bg-indigo-100 border-indigo-200 hover:bg-indigo-200/70 dark:bg-indigo-950/40 dark:border-indigo-900 dark:hover:bg-indigo-950/70', muestra: 'bg-indigo-200 dark:bg-indigo-800' },
  { clave: 'violeta', nombre: 'Violeta', tarjeta: 'bg-purple-100 border-purple-200 hover:bg-purple-200/70 dark:bg-purple-950/40 dark:border-purple-900 dark:hover:bg-purple-950/70', muestra: 'bg-purple-200 dark:bg-purple-800' },
  { clave: 'gris', nombre: 'Gris', tarjeta: 'bg-slate-100 border-slate-200 hover:bg-slate-200/70 dark:bg-slate-800/50 dark:border-slate-700 dark:hover:bg-slate-800/80', muestra: 'bg-slate-200 dark:bg-slate-600' },
];

const PORCLAVE = new Map(COLORES_ACTIVIDAD.map((c) => [c.clave, c]));

/** Las clases de la tarjeta, o '' si no tiene color (o es uno desconocido). */
export function claseTarjeta(clave: string | null | undefined): string {
  return clave ? (PORCLAVE.get(clave)?.tarjeta ?? '') : '';
}
