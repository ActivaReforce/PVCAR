/**
 * Colores de las actividades (0022; paleta sobria desde la 0023 —el cliente
 * los quiso "un poco más varoniles"—, 2026-10-06).
 *
 * Tonos apagados y fríos, muy claros: el borde ámbar de "sin entrenador"
 * tiene que seguir siendo lo primero que se ve, así que el color va solo en
 * el fondo con un borde apenas teñido, y ningún tono es amarillo ni naranja.
 * En oscuro, el mismo tono muy oscuro.
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
  { clave: 'marino', nombre: 'Marino', tarjeta: 'bg-[#dde5f0] border-[#c2cfe2] hover:bg-[#ccd8ea] dark:bg-[#1b2638] dark:border-[#2a3a55] dark:hover:bg-[#223049]', muestra: 'bg-[#9fb2cf] dark:bg-[#3d5378]' },
  { clave: 'acero', nombre: 'Acero', tarjeta: 'bg-[#e2e7ec] border-[#cbd4dd] hover:bg-[#d5dde5] dark:bg-[#1f262e] dark:border-[#323d49] dark:hover:bg-[#28313b]', muestra: 'bg-[#a9b6c3] dark:bg-[#4a5866]' },
  { clave: 'cielo', nombre: 'Cielo', tarjeta: 'bg-[#dce9f2] border-[#bfd6e7] hover:bg-[#cde0ee] dark:bg-[#14263a] dark:border-[#22405c] dark:hover:bg-[#1a324b]', muestra: 'bg-[#93b7d3] dark:bg-[#335b80]' },
  { clave: 'petroleo', nombre: 'Petróleo', tarjeta: 'bg-[#d7e7e8] border-[#b9d5d7] hover:bg-[#c8dfe0] dark:bg-[#112b2d] dark:border-[#1f4447] dark:hover:bg-[#18383b]', muestra: 'bg-[#89b5b8] dark:bg-[#2d6266]' },
  { clave: 'bosque', nombre: 'Bosque', tarjeta: 'bg-[#dae6dc] border-[#bed3c2] hover:bg-[#ccdccf] dark:bg-[#152a1c] dark:border-[#244331] dark:hover:bg-[#1c3726]', muestra: 'bg-[#8fb198] dark:bg-[#36604a]' },
  { clave: 'oliva', nombre: 'Oliva', tarjeta: 'bg-[#e3e6d6] border-[#cdd3b6] hover:bg-[#d8ddc7] dark:bg-[#252916] dark:border-[#3b4224] dark:hover:bg-[#30361d]', muestra: 'bg-[#a9b385] dark:bg-[#58623a]' },
  { clave: 'piedra', nombre: 'Piedra', tarjeta: 'bg-[#e6e3df] border-[#d3cec7] hover:bg-[#ddd9d3] dark:bg-[#29251f] dark:border-[#423c33] dark:hover:bg-[#363129]', muestra: 'bg-[#b4aca1] dark:bg-[#61584c]' },
  { clave: 'grafito', nombre: 'Grafito', tarjeta: 'bg-[#e3e3e5] border-[#cdcdd1] hover:bg-[#d8d8db] dark:bg-[#232326] dark:border-[#3a3a3f] dark:hover:bg-[#2e2e32]', muestra: 'bg-[#a8a8ae] dark:bg-[#55555c]' },
  { clave: 'indigo', nombre: 'Índigo', tarjeta: 'bg-[#e0e1f1] border-[#c5c8e5] hover:bg-[#d3d5eb] dark:bg-[#1c1d38] dark:border-[#2e3057] dark:hover:bg-[#252747]', muestra: 'bg-[#a0a4d2] dark:bg-[#454a85]' },
  { clave: 'vino', nombre: 'Vino', tarjeta: 'bg-[#ecdddf] border-[#dbc2c6] hover:bg-[#e4d0d3] dark:bg-[#33191e] dark:border-[#4f2a31] dark:hover:bg-[#412128]', muestra: 'bg-[#c2959c] dark:bg-[#7a3c47]' },
];

const PORCLAVE = new Map(COLORES_ACTIVIDAD.map((c) => [c.clave, c]));

/** Las clases de la tarjeta, o '' si no tiene color (o es uno desconocido). */
export function claseTarjeta(clave: string | null | undefined): string {
  return clave ? (PORCLAVE.get(clave)?.tarjeta ?? '') : '';
}
