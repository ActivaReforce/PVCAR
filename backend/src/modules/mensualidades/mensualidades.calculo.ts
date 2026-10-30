import { IVA_PCT, calcularCobro, type PrecioColegio } from '../inscripciones/inscripciones.precios.js';

/**
 * Qué meses debe cada alumno y cuánto (docs/mensualidades.md). Puro: sin
 * base ni reloj, para poder probarlo.
 *
 * Reglas del cliente (2026-10-30):
 *   - La inscripción paga el primer mes de lo que trae. Enviada desde el
 *     día de corte (hora de Ecuador), paga el mes siguiente: quien se
 *     inscribe el 25 de enero empieza en febrero.
 *   - Cada colegio cobra solo sus meses marcados; los demás quedan en pausa.
 *     Y solo desde su "cobrar desde": lo inscrito antes cubre ese mes.
 *   - Un mes sin pagar sale hasta que se pague: el del mes en curso es
 *     "pendiente" hasta el día límite y "atrasado" después; los anteriores,
 *     atrasados. Nada se bloquea. No se paga por adelantado.
 *   - El importe de cada alumno se calcula con toda la familia (la misma
 *     regla de hermanos de la inscripción), no con lo que se marca para
 *     pagar: así desmarcar a un hijo resta exactamente lo suyo.
 *
 * Un mes en que una disciplina entra por inscripción y otra ya venía (se le
 * añadió una al alumno), la cuota cobra solo la que venía, con la parte
 * proporcional de su importe: dentro de un colegio todas valen lo mismo.
 */

export type Mes = string; // 'YYYY-MM-01'

export interface ConfigCobro {
  diaLimite: number;
  diaCorte: number;
}

export interface ColegioCobro extends PrecioColegio {
  /** 1-12. Vacío = no cobra. */
  meses: number[];
  /** Primer mes que cobra. null = no cobra. */
  desde: Mes | null;
}

export interface DisciplinaDelHijo {
  colacthor_id: number;
  nombre: string;
  /** Fecha (Ecuador) de la inscripción que la trajo, o del alta a mano. */
  inicio: string;
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
}

export const mesDe = (fecha: string): Mes => `${fecha.slice(0, 7)}-01`;

export function sumarMeses(mes: Mes, n: number): Mes {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}

const numeroDeMes = (mes: Mes) => Number(mes.slice(5, 7));

export const cobraEn = (col: ColegioCobro, mes: Mes): boolean =>
  col.desde !== null && mes >= col.desde && col.meses.includes(numeroDeMes(mes));

/** El primer mes que paga una disciplina que empezó en `fecha`. null si el colegio no cobra. */
export function primerMes(fecha: string, col: ColegioCobro, diaCorte: number): Mes | null {
  if (col.desde === null || col.meses.length === 0) return null;
  let mes = mesDe(fecha);
  if (Number(fecha.slice(8, 10)) >= diaCorte) mes = sumarMeses(mes, 1);
  if (mes < col.desde) mes = col.desde;
  for (let i = 0; i < 12; i++) {
    if (col.meses.includes(numeroDeMes(mes))) return mes;
    mes = sumarMeses(mes, 1);
  }
  return null;
}

const centavos = (d: number) => Math.round(d * 100);
const dolares = (c: number) => c / 100;

interface Activo {
  hijo: HijoCobro;
  col: ColegioCobro;
  cobradas: string[];
  inscripcion: string[];
}

/**
 * Los meses de cada hijo de una familia, desde su primer mes hasta el de
 * `hoy`, más los que ya tienen cuota aunque hoy no tocaran (cambió la
 * configuración). Ordenados del más antiguo al más nuevo.
 */
export function mesesDeLaFamilia(
  hijos: HijoCobro[],
  colegios: Map<number, ColegioCobro>,
  registradas: CuotaRegistrada[],
  config: ConfigCobro,
  hoy: string,
): Map<number, MesDelHijo[]> {
  const actual = mesDe(hoy);
  const dia = Number(hoy.slice(8, 10));

  // Cada disciplina con su primer mes.
  const inicios = new Map<number, Array<{ d: DisciplinaDelHijo; desde: Mes }>>();
  const todosLosMeses = new Set<Mes>();
  for (const h of hijos) {
    const col = colegios.get(h.col_id);
    const lista: Array<{ d: DisciplinaDelHijo; desde: Mes }> = [];
    if (col) {
      for (const d of h.disciplinas) {
        const desde = primerMes(d.inicio, col, config.diaCorte);
        if (desde !== null && desde <= actual) lista.push({ d, desde });
      }
    }
    inicios.set(h.nino_id, lista);
    const primero = lista.reduce<Mes | null>((m, x) => (m === null || x.desde < m ? x.desde : m), null);
    if (primero) for (let m = primero; m <= actual; m = sumarMeses(m, 1)) todosLosMeses.add(m);
  }

  const resultado = new Map<number, MesDelHijo[]>(hijos.map((h) => [h.nino_id, []]));
  const registro = new Map(registradas.map((r) => [`${r.nino_id}|${r.mes}`, r]));

  for (const mes of [...todosLosMeses].sort()) {
    const activos: Activo[] = [];
    for (const h of hijos) {
      const col = colegios.get(h.col_id);
      if (!col || !cobraEn(col, mes)) continue;
      const vigentes = inicios.get(h.nino_id)!.filter((x) => x.desde <= mes);
      if (vigentes.length === 0) continue;
      activos.push({
        hijo: h,
        col,
        cobradas: vigentes.filter((x) => !(x.d.porInscripcion && x.desde === mes)).map((x) => x.d.nombre),
        inscripcion: vigentes.filter((x) => x.d.porInscripcion && x.desde === mes).map((x) => x.d.nombre),
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
        };
        registro.delete(`${a.hijo.nino_id}|${mes}`);
      } else if (a.cobradas.length === 0) {
        fila = { ...base, estado: 'inscripcion', disciplinas: [], subtotal: 0, descuento: 0, iva: 0, total: 0, menpag_id: null };
      } else {
        const atrasado = mes < actual || dia > config.diaLimite;
        fila = {
          ...base,
          estado: atrasado ? 'atrasado' : 'pendiente',
          disciplinas: a.cobradas,
          subtotal: dolares(subtotal),
          descuento: dolares(descuento),
          iva: dolares(iva),
          total: dolares(neto + iva),
          menpag_id: null,
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
    });
  }
  for (const lista of resultado.values()) lista.sort((a, b) => a.mes.localeCompare(b.mes));
  return resultado;
}

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

/** "Noviembre 2026". */
export function nombreDeMes(mes: Mes): string {
  const nombres = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${nombres[numeroDeMes(mes) - 1]} ${mes.slice(0, 4)}`;
}
