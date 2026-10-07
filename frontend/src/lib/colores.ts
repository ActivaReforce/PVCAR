/**
 * Colores de las actividades (0022; paleta sobria desde la 0023 —el cliente
 * los quiso "un poco más varoniles"—, 2026-10-06).
 *
 * Tonos apagados y fríos, muy claros: el borde ámbar de "sin entrenador"
 * tiene que seguir siendo lo primero que se ve, así que el color va solo en
 * el fondo con un borde apenas teñido, y ningún tono es amarillo ni naranja.
 * En oscuro, el mismo tono muy oscuro.
 *
 * Diseñados en OKLCH y medidos (ΔE2000 entre fondos): ningún par baja de 7
 * en claro ni en oscuro. La primera versión tenía los azules a 4,3 y el
 * cliente no los distinguía; ahora se separan por tono **y** por
 * profundidad: Marino azul lleno, Acero gris azulado más oscuro, Cielo cian
 * claro, Índigo hacia el violeta.
 *
 * Las clases van escritas enteras —nada de `bg-[${hex}]` armado— porque
 * Tailwind solo genera las que encuentra literales en el código.
 * Los nombres tienen que coincidir con el CHECK de la migración 0023.
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
  { clave: 'marino', nombre: 'Marino', tarjeta: 'bg-[#c6d8f8] border-[#afc5ec] hover:bg-[#bbcff1] dark:bg-[#132342] dark:border-[#24375b] dark:hover:bg-[#1b2d4e]', muestra: 'bg-[#7498da] dark:bg-[#34538f]' },
  { clave: 'acero', nombre: 'Acero', tarjeta: 'bg-[#bccdda] border-[#a5bbca] hover:bg-[#b1c4d2] dark:bg-[#142633] dark:border-[#263b49] dark:hover:bg-[#1d303e]', muestra: 'bg-[#6c91ac] dark:bg-[#365a72]' },
  { clave: 'cielo', nombre: 'Cielo', tarjeta: 'bg-[#cef3fc] border-[#b3e1ec] hover:bg-[#c1e9f4] dark:bg-[#002a34] dark:border-[#083f4a] dark:hover:bg-[#00343f]', muestra: 'bg-[#63b9cd] dark:bg-[#006174]' },
  { clave: 'petroleo', nombre: 'Petróleo', tarjeta: 'bg-[#c0e8e1] border-[#a5d6cf] hover:bg-[#b3dfd8] dark:bg-[#002c27] dark:border-[#02423c] dark:hover:bg-[#003731]', muestra: 'bg-[#51b1a6] dark:bg-[#00655c]' },
  { clave: 'bosque', nombre: 'Bosque', tarjeta: 'bg-[#cae7cf] border-[#b1d5b8] hover:bg-[#bedec3] dark:bg-[#0a2c14] dark:border-[#1d4126] dark:hover:bg-[#14361d]', muestra: 'bg-[#70b07d] dark:bg-[#246436]' },
  { clave: 'oliva', nombre: 'Oliva', tarjeta: 'bg-[#e7e7c5] border-[#d4d4aa] hover:bg-[#dddeb8] dark:bg-[#272600] dark:border-[#3b3a0d] dark:hover:bg-[#313004]', muestra: 'bg-[#aaa95d] dark:bg-[#5b5900]' },
  { clave: 'piedra', nombre: 'Piedra', tarjeta: 'bg-[#e9dbd2] border-[#d8c7bb] hover:bg-[#e0d1c7] dark:bg-[#2e2118] dark:border-[#44342a] dark:hover:bg-[#392a21]', muestra: 'bg-[#b59885] dark:bg-[#694f3e]' },
  { clave: 'grafito', nombre: 'Grafito', tarjeta: 'bg-[#ecedee] border-[#d8d9db] hover:bg-[#e2e3e4] dark:bg-[#232425] dark:border-[#373839] dark:hover:bg-[#2d2e2f]', muestra: 'bg-[#abacaf] dark:bg-[#545558]' },
  { clave: 'indigo', nombre: 'Índigo', tarjeta: 'bg-[#dbd1f6] border-[#c9bce9] hover:bg-[#d2c6ef] dark:bg-[#281b40] dark:border-[#3d2f58] dark:hover:bg-[#32254c]', muestra: 'bg-[#a188d6] dark:bg-[#5e458c]' },
  { clave: 'vino', nombre: 'Vino', tarjeta: 'bg-[#f4d0d6] border-[#e5bac1] hover:bg-[#ecc6cb] dark:bg-[#39181f] dark:border-[#502b32] dark:hover:bg-[#442229]', muestra: 'bg-[#cb8491] dark:bg-[#7e3f4c]' },
];

const PORCLAVE = new Map(COLORES_ACTIVIDAD.map((c) => [c.clave, c]));

/** Las clases de la tarjeta, o '' si no tiene color (o es uno desconocido). */
export function claseTarjeta(clave: string | null | undefined): string {
  return clave ? (PORCLAVE.get(clave)?.tarjeta ?? '') : '';
}
