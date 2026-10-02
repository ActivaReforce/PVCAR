/**
 * Lo que cuesta una inscripción (migración 0015).
 *
 * Reglas del cliente (2026-10-02):
 *   - Cada colegio tiene un precio por disciplina; dentro del colegio todas
 *     cuestan lo mismo.
 *   - Si en el mismo envío se inscriben hermanos, los hermanos tienen un
 *     descuento (porcentaje del colegio de cada hermano).
 *   - Una casilla por colegio decide si el descuento cubre todas las
 *     disciplinas del hermano o solo la primera.
 *
 * Quién paga completo: el alumno con el importe más alto. Si fuera "el
 * primero del formulario", el orden en que se escriben los hijos cambiaría
 * el total, y eso no es una regla de negocio sino un accidente.
 *
 * Todo en centavos enteros: con decimales de coma flotante, 3 × 28,30 da
 * 84,89999… y el contrato diría una cifra que no es.
 */

export interface PrecioColegio {
  precio: number;
  descuentoHermano: number;
  descuentoSoloPrimera: boolean;
}

export interface CobroAlumno {
  precio_disciplina: number;
  disciplinas: number;
  subtotal: number;
  /** Porcentaje aplicado; 0 si paga completo. */
  descuento_pct: number;
  descuento_solo_primera: boolean;
  descuento: number;
  total: number;
  /** Es el que paga completo cuando hay hermanos. */
  paga_completo: boolean;
}

export interface Cobro {
  alumnos: CobroAlumno[];
  total: number;
}

const aCentavos = (dolares: number) => Math.round(dolares * 100);
const aDolares = (centavos: number) => centavos / 100;

export function calcularCobro(
  alumnos: Array<{ colId: number; disciplinas: number }>,
  precios: Map<number, PrecioColegio>,
): Cobro {
  const base = alumnos.map((a) => {
    const p = precios.get(a.colId);
    if (!p) throw new Error(`El colegio ${a.colId} no tiene precio configurado`);
    const precio = aCentavos(p.precio);
    return { p, precio, n: a.disciplinas, subtotal: precio * a.disciplinas };
  });

  // El de importe más alto paga completo; en empate, el primero.
  let principal = 0;
  base.forEach((b, i) => {
    if (b.subtotal > base[principal]!.subtotal) principal = i;
  });
  const hayHermanos = base.length > 1;

  const resultado = base.map((b, i) => {
    const conDescuento = hayHermanos && i !== principal && b.p.descuentoHermano > 0;
    const sobre = b.p.descuentoSoloPrimera ? b.precio : b.subtotal;
    const descuento = conDescuento ? Math.round((sobre * b.p.descuentoHermano) / 100) : 0;
    return {
      precio_disciplina: aDolares(b.precio),
      disciplinas: b.n,
      subtotal: aDolares(b.subtotal),
      descuento_pct: conDescuento ? b.p.descuentoHermano : 0,
      descuento_solo_primera: b.p.descuentoSoloPrimera,
      descuento: aDolares(descuento),
      total: aDolares(b.subtotal - descuento),
      paga_completo: !hayHermanos || i === principal,
      _centavos: b.subtotal - descuento,
    };
  });

  return {
    alumnos: resultado.map(({ _centavos, ...resto }) => resto),
    total: aDolares(resultado.reduce((s, r) => s + r._centavos, 0)),
  };
}

const MONEDA = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });

export function dinero(dolares: number): string {
  return MONEDA.format(dolares);
}

/** "10 % por hermano, en todas sus disciplinas", o "Sin descuento". */
export function textoDescuento(c: CobroAlumno): string {
  if (c.descuento_pct === 0) return 'Sin descuento';
  return `${c.descuento_pct} % por hermano, ${c.descuento_solo_primera ? 'en su primera disciplina' : 'en todas sus disciplinas'} (${dinero(c.descuento)})`;
}
