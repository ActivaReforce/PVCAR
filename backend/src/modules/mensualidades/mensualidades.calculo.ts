import { IVA_PCT, calcularCobro, type PrecioColegio } from '../inscripciones/inscripciones.precios.js';

/**
 * Qué meses debe cada alumno y cuánto (docs/mensualidades.md). Puro: sin
 * base ni reloj, para poder probarlo.
 *
 * Reglas del cliente (2026-11-16):
 *   - La inscripción paga un mes: el que eligió el representante en el
 *     formulario (el alumno empieza ese mes). Las mensualidades corren desde
 *     el siguiente. Una disciplina dada de alta a mano, sin inscripción, se
 *     cobra desde el mes del alta.
 *   - Cada colegio cobra solo sus meses marcados, con año (el año en curso
 *     y, si lo abrió, el siguiente). Los demás quedan en pausa.
 *   - Se puede pagar por adelantado cualquier mes marcado, pero en orden:
 *     no se elige un mes si el anterior del mismo alumno sigue por pagar.
 *   - Un mes sin pagar es "pendiente" hasta su día límite y "atrasado"
 *     después; los meses anteriores sin pagar, atrasados. Los futuros,
 *     pendientes. Un mes en revisión no está atrasado.
 *   - El importe de cada alumno se calcula con toda la familia (la misma
 *     regla de hermanos de la inscripción), no con lo que se marca para
 *     pagar: así desmarcar a un hijo resta exactamente lo suyo.
 *
 * Un mes en que una disciplina entra por inscripción y otra ya venía (se le
 * añadió una al alumno), la cuota cobra solo la que venía, con la parte
 * proporcional de su importe: dentro de un colegio todas valen lo mismo.
 */

export type Mes = string; // 'YYYY-MM-01'

export interface ColegioCobro extends PrecioColegio {
  /** Meses que cobra, con año, ordenados. Vacío = no cobra. */
  meses: Mes[];
  /** Hasta qué día del mes se paga sin atraso. */
  diaLimite: number;
}

export interface DisciplinaDelHijo {
  colacthor_id: number;
  nombre: string;
  /**
   * Por inscripción: el mes que pagó la inscripción. A mano: el mes del
   * alta, que ya se cobra.
   */
  inicio: Mes;
  /** Vino por una inscripción aprobada: su primer mes ya está pagado. */
  porInscripcion: boolean;
}

export interface HijoCobro {
  nino_id: number;
  nombre: string;
  col_id: number;
  disciplinas: DisciplinaDelHijo[];
}

export interface CuotaRegistrada {
  nino_id: number;
  mes: Mes;
  estado: 'pendiente' | 'aprobado';
  menpag_id: number;
  /** Día (Ecuador) en que se envió el pago, 'YYYY-MM-DD'. */
  fecha_pago: string;
  disciplinas: string[];
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
}

export type EstadoMes = 'inscripcion' | 'pagado' | 'revision' | 'pendiente' | 'atrasado';

export interface MesDelHijo {
  mes: Mes;
  estado: EstadoMes;
  /** Las que se cobran ese mes (vacío si lo cubre entero la inscripción). */
  disciplinas: string[];
  /** Las que pagó la inscripción ese mes. */
  inscripcion: string[];
  subtotal: number;
  descuento: number;
  iva: number;
  /** Con IVA. 0 si lo cubre la inscripción. */
  total: number;
  menpag_id: number | null;
  /** Pagado o en revisión: el día en que se envió el pago. */
  pagado_el: string | null;
}

export const mesDe = (fecha: string): Mes => `${fecha.slice(0, 7)}-01`;

/**
 * El primer mes de la plataforma (cliente, 2026-11-16): todo lo que existía
 * hasta noviembre de 2026 —inscrito en octubre o noviembre, o dado de alta
 * a mano— es el pago de noviembre. El dinero de las inscripciones de octubre
 * también cuenta en noviembre.
 */
export const PRIMER_MES: Mes = '2026-11-01';

export function sumarMeses(mes: Mes, n: number): Mes {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}

export const cobraEn = (col: ColegioCobro, mes: Mes): boolean => col.meses.includes(mes);

export const debe = (e: EstadoMes) => e === 'pendiente' || e === 'atrasado';

/** El estado de un mes sin pagar, visto el día `hoy`. */
export function estadoSinPagar(mes: Mes, hoy: string, diaLimite: number): 'pendiente' | 'atrasado' {
  const actual = mesDe(hoy);
  if (mes < actual) return 'atrasado';
  if (mes === actual && Number(hoy.slice(8, 10)) > diaLimite) return 'atrasado';
  return 'pendiente';
}

const centavos = (d: number) => Math.round(d * 100);
const dolares = (c: number) => c / 100;

interface Activo {
  hijo: HijoCobro;
  col: ColegioCobro;
  cobradas: string[];
  inscripcion: string[];
}

/** Desde qué mes cuenta una disciplina para la familia (incluido el que pagó la inscripción). */
const vigenteEn = (d: DisciplinaDelHijo, mes: Mes) => d.inicio <= mes;

/**
 * Los meses de cada hijo de una familia: todos los meses marcados de su
 * colegio desde que empezó (también los futuros, que se pueden pagar por
 * adelantado), más los que ya tienen cuota aunque hoy no tocaran (cambió
 * la configuración). Ordenados del más antiguo al más nuevo.
 */
export function mesesDeLaFamilia(
  hijos: HijoCobro[],
  colegios: Map<number, ColegioCobro>,
  registradas: CuotaRegistrada[],
  hoy: string,
): Map<number, MesDelHijo[]> {
  const todosLosMeses = new Set<Mes>();
  for (const h of hijos) {
    const col = colegios.get(h.col_id);
    if (!col || h.disciplinas.length === 0) continue;
    const primero = h.disciplinas.reduce((m, d) => (d.inicio < m ? d.inicio : m), h.disciplinas[0]!.inicio);
    for (const m of col.meses) if (m >= primero) todosLosMeses.add(m);
  }

  const resultado = new Map<number, MesDelHijo[]>(hijos.map((h) => [h.nino_id, []]));
  const registro = new Map(registradas.map((r) => [`${r.nino_id}|${r.mes}`, r]));

  for (const mes of [...todosLosMeses].sort()) {
    const activos: Activo[] = [];
    for (const h of hijos) {
      const col = colegios.get(h.col_id);
      if (!col || !cobraEn(col, mes)) continue;
      const vigentes = h.disciplinas.filter((d) => vigenteEn(d, mes));
      if (vigentes.length === 0) continue;
      activos.push({
        hijo: h,
        col,
        cobradas: vigentes.filter((d) => !(d.porInscripcion && d.inicio === mes)).map((d) => d.nombre),
        inscripcion: vigentes.filter((d) => d.porInscripcion && d.inicio === mes).map((d) => d.nombre),
      });
    }
    if (activos.length === 0) continue;

    const cobro = calcularCobro(
      activos.map((a) => ({ colId: a.hijo.col_id, disciplinas: a.cobradas.length + a.inscripcion.length })),
      new Map(activos.map((a) => [a.hijo.col_id, a.col])),
      IVA_PCT,
    );

    activos.forEach((a, i) => {
      const c = cobro.alumnos[i]!;
      const n = a.cobradas.length + a.inscripcion.length;
      const parte = (dolar: number) => Math.round((centavos(dolar) * a.cobradas.length) / n);
      const subtotal = parte(c.subtotal);
      const descuento = parte(c.descuento);
      const neto = subtotal - descuento;
      const iva = Math.round((neto * IVA_PCT) / 100);
      const ya = registro.get(`${a.hijo.nino_id}|${mes}`);
      const base = { mes, inscripcion: a.inscripcion };
      let fila: MesDelHijo;
      if (ya) {
        fila = {
          ...base,
          estado: ya.estado === 'aprobado' ? 'pagado' : 'revision',
          disciplinas: ya.disciplinas,
          subtotal: ya.subtotal,
          descuento: ya.descuento,
          iva: ya.iva,
          total: ya.total,
          menpag_id: ya.menpag_id,
          pagado_el: ya.fecha_pago,
        };
        registro.delete(`${a.hijo.nino_id}|${mes}`);
      } else if (a.cobradas.length === 0) {
        fila = {
          ...base,
          estado: 'inscripcion',
          disciplinas: [],
          subtotal: 0,
          descuento: 0,
          iva: 0,
          total: 0,
          menpag_id: null,
          pagado_el: null,
        };
      } else {
        fila = {
          ...base,
          estado: estadoSinPagar(mes, hoy, a.col.diaLimite),
          disciplinas: a.cobradas,
          subtotal: dolares(subtotal),
          descuento: dolares(descuento),
          iva: dolares(iva),
          total: dolares(neto + iva),
          menpag_id: null,
          pagado_el: null,
        };
      }
      resultado.get(a.hijo.nino_id)!.push(fila);
    });
  }

  // Lo ya pagado que hoy no saldría (se cambió la configuración): no se pierde.
  for (const r of registro.values()) {
    resultado.get(r.nino_id)?.push({
      mes: r.mes,
      estado: r.estado === 'aprobado' ? 'pagado' : 'revision',
      disciplinas: r.disciplinas,
      inscripcion: [],
      subtotal: r.subtotal,
      descuento: r.descuento,
      iva: r.iva,
      total: r.total,
      menpag_id: r.menpag_id,
      pagado_el: r.fecha_pago,
    });
  }
  for (const lista of resultado.values()) lista.sort((a, b) => a.mes.localeCompare(b.mes));
  return resultado;
}

/**
 * Los meses que no se pueden pagar todavía porque falta uno anterior del
 * mismo alumno. Devuelve el primer mes que falta, o null si el orden está
 * bien: lo elegido tiene que ser, por alumno, los primeros meses por pagar.
 */
export function mesQueFalta(meses: MesDelHijo[], elegidos: Set<Mes>): Mes | null {
  let saltado: Mes | null = null;
  for (const m of meses) {
    if (!debe(m.estado)) continue;
    if (elegidos.has(m.mes)) {
      if (saltado) return saltado;
    } else if (!saltado) {
      saltado = m.mes;
    }
  }
  return null;
}

/** Los meses atrasados de un alumno: lo que lo deja ausente en Asistencias. */
export const mesesAtrasados = (meses: MesDelHijo[]): Mes[] =>
  meses.filter((m) => m.estado === 'atrasado').map((m) => m.mes);

/**
 * Familias: los alumnos unidos por algún representante en común. El
 * descuento de hermano se calcula dentro de cada una, la mire quien la mire.
 */
export function familias<T extends { nino_id: number; representantes: number[] }>(hijos: T[]): T[][] {
  const padre = new Map<number, number>(hijos.map((h) => [h.nino_id, h.nino_id]));
  const raiz = (x: number): number => {
    let r = x;
    while (padre.get(r) !== r) r = padre.get(r)!;
    padre.set(x, r);
    return r;
  };
  const primeroDe = new Map<number, number>();
  for (const h of hijos) {
    for (const u of h.representantes) {
      const otro = primeroDe.get(u);
      if (otro === undefined) primeroDe.set(u, h.nino_id);
      else padre.set(raiz(h.nino_id), raiz(otro));
    }
  }
  const grupos = new Map<number, T[]>();
  for (const h of hijos) {
    const r = raiz(h.nino_id);
    grupos.set(r, [...(grupos.get(r) ?? []), h]);
  }
  return [...grupos.values()];
}

const NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** "Noviembre 2026". */
export function nombreDeMes(mes: Mes): string {
  return `${NOMBRES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
}

/** "diciembre", "enero y febrero 2027"… para frases. */
export function listaDeMeses(meses: Mes[]): string {
  const ordenados = [...new Set(meses)].sort();
  const anos = new Set(ordenados.map((m) => m.slice(0, 4)));
  const nombres = ordenados.map((m) => {
    const n = NOMBRES[Number(m.slice(5, 7)) - 1]!.toLowerCase();
    return anos.size > 1 ? `${n} ${m.slice(0, 4)}` : n;
  });
  const texto = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : (nombres[0] ?? '');
  return anos.size === 1 ? `${texto} ${[...anos][0]}` : texto;
}
