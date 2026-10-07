/**
 * Lo que cuesta una inscripción, al mes (migración 0015).
 *
 * Reglas del cliente (2026-10-02):
 *   - Cada colegio tiene un precio mensual por disciplina; dentro del
 *     colegio todas cuestan lo mismo.
 *   - Si en el mismo envío se inscriben hermanos, **lidera** el que más
 *     disciplinas tiene: paga completo, y su número de disciplinas es el
 *     cupo de descuento de cada hermano. Si el que lidera va a 1, el hermano
 *     tiene descuento en 1; si va a 5, el hermano lo tiene en hasta 5.
 *   - El descuento es un porcentaje, el del colegio de cada hermano.
 *
 * Empate en disciplinas: lidera el de importe más alto, y si sigue el
 * empate, el primero. Así el orden en que se escriben los hijos no cambia
 * el total salvo cuando de verdad da igual.
 *
 * IVA (decisión del 2026-10-05): se suma y se muestra. Se calcula sobre lo
 * que paga cada alumno, ya con su descuento, y el total es la suma.
 *
 * Todo en centavos enteros: con decimales de coma flotante, 3 × 28,30 da
 * 84,89999… y el contrato diría una cifra que no es.
 */

/** El IVA de Ecuador. Decisión del cliente (2026-10-05): siempre 15 %, no se configura. */
export const IVA_PCT = 15;

export interface PrecioColegio {
  precio: number;
  descuentoHermano: number;
}

export interface CobroAlumno {
  precio_disciplina: number;
  disciplinas: number;
  subtotal: number;
  /** Porcentaje aplicado; 0 si lidera o no hay hermanos. */
  descuento_pct: number;
  /** Cuántas de sus disciplinas llevan el descuento. */
  disciplinas_con_descuento: number;
  descuento: number;
  total: number;
  /** Es el que lidera (paga completo) cuando hay hermanos. */
  paga_completo: boolean;
  iva_pct: number;
  iva: number;
  /** Lo que paga al mes con IVA. `total` es sin IVA. */
  total_con_iva: number;
}

export interface Cobro {
  alumnos: CobroAlumno[];
  /** Sin IVA, con los descuentos. */
  subtotal: number;
  iva: number;
  /** Lo que se paga al mes, con IVA. */
  total: number;
}

const aCentavos = (dolares: number) => Math.round(dolares * 100);
const aDolares = (centavos: number) => centavos / 100;

export function calcularCobro(
  alumnos: Array<{ colId: number; disciplinas: number }>,
  precios: Map<number, PrecioColegio>,
  ivaPct: number,
): Cobro {
  const base = alumnos.map((a) => {
    const p = precios.get(a.colId);
    if (!p) throw new Error(`El colegio ${a.colId} no tiene precio configurado`);
    const precio = aCentavos(p.precio);
    return { p, precio, n: a.disciplinas, subtotal: precio * a.disciplinas };
  });

  let lider = 0;
  base.forEach((b, i) => {
    const l = base[lider]!;
    if (b.n > l.n || (b.n === l.n && b.subtotal > l.subtotal)) lider = i;
  });
  const hayHermanos = base.length > 1;
  const cupo = base[lider]?.n ?? 0;

  const resultado = base.map((b, i) => {
    const conDescuento = hayHermanos && i !== lider && b.p.descuentoHermano > 0;
    const cubiertas = conDescuento ? Math.min(b.n, cupo) : 0;
    const descuento = Math.round((b.precio * cubiertas * b.p.descuentoHermano) / 100);
    const neto = b.subtotal - descuento;
    const iva = Math.round((neto * ivaPct) / 100);
    return {
      precio_disciplina: aDolares(b.precio),
      disciplinas: b.n,
      subtotal: aDolares(b.subtotal),
      descuento_pct: conDescuento ? b.p.descuentoHermano : 0,
      disciplinas_con_descuento: cubiertas,
      descuento: aDolares(descuento),
      total: aDolares(neto),
      paga_completo: !hayHermanos || i === lider,
      iva_pct: ivaPct,
      iva: aDolares(iva),
      total_con_iva: aDolares(neto + iva),
      _neto: neto,
      _iva: iva,
    };
  });

  const neto = resultado.reduce((s, r) => s + r._neto, 0);
  const iva = resultado.reduce((s, r) => s + r._iva, 0);
  return {
    alumnos: resultado.map(({ _neto, _iva, ...resto }) => resto),
    subtotal: aDolares(neto),
    iva: aDolares(iva),
    total: aDolares(neto + iva),
  };
}

const MONEDA = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });

export function dinero(dolares: number): string {
  return MONEDA.format(dolares);
}

/** "10 % por hermano en 2 disciplinas ($9,00)", o "Sin descuento". */
export function textoDescuento(c: CobroAlumno): string {
  if (c.descuento_pct === 0) return 'Sin descuento';
  const n = c.disciplinas_con_descuento;
  return `${c.descuento_pct} % por hermano en ${n} disciplina${n === 1 ? '' : 's'} (${dinero(c.descuento)})`;
}
