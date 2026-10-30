import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import { auditar } from '../../lib/auditoria.js';
import { hoyEc } from '../../lib/fecha.js';
import { enTransaccion } from '../../lib/tx.js';
import { armarPagina, type Pagina } from '../../lib/paginacion.js';
import {
  MIME_COMPROBANTE,
  borrarArchivos,
  firmarArchivos,
  subirArchivo,
} from '../../lib/storageInscripciones.js';
import { describirDisciplina, esPersonal, firmaDeImagenValida } from '../inscripciones/inscripciones.service.js';
import {
  familias,
  mesDe,
  mesesDeLaFamilia,
  nombreDeMes,
  type ColegioCobro,
  type HijoCobro,
  type Mes,
  type MesDelHijo,
} from './mensualidades.calculo.js';
import * as repo from './mensualidades.repository.js';
import type { ListarPagosQuery, PagarInput } from './mensualidades.schemas.js';

/**
 * Mensualidades (docs/mensualidades.md, cliente 2026-10-30).
 *
 *   representante ──pagar──▶ pendiente ──aprobar──▶ aprobado
 *                                │
 *                                └──rechazar──▶ rechazado (con motivo; sus meses
 *                                               vuelven a deberse) ──volver a
 *                                               intentar──▶ ∅
 *
 * Qué se debe no se guarda: se calcula cada vez con las disciplinas activas,
 * la configuración de cada colegio y las cuotas ya pagadas
 * (mensualidades.calculo.ts). Lo que se guarda es lo pagado, congelado.
 */

// ---------------------------------------------------------------------------
// Qué debe cada alumno

interface Calculo {
  alumnos: Map<number, repo.AlumnoConDisciplinas>;
  meses: Map<number, MesDelHijo[]>;
  colegios: repo.ColegioConCobro[];
  config: repo.ConfigMensualidades;
  hoy: string;
}

const aHijo = (a: repo.AlumnoConDisciplinas): HijoCobro => ({
  nino_id: a.nino_id,
  nombre: a.nombre,
  col_id: a.col_id,
  disciplinas: a.disciplinas.map((d) => ({
    colacthor_id: d.colacthor_id,
    nombre: describirDisciplina(d),
    inicio: d.inicio,
    porInscripcion: d.por_inscripcion,
  })),
});

/**
 * Los meses de los alumnos activos. Con `soloDe`, solo las familias de esos
 * niños (el descuento de hermano se calcula con la familia entera).
 */
async function calcular(soloDe: number[] | null): Promise<Calculo> {
  const [config, colegios, todos] = await Promise.all([repo.obtenerConfig(), repo.colegios(), repo.alumnosActivos()]);
  const hoy = hoyEc();
  const porColegio = new Map<number, ColegioCobro>(colegios.map((c) => [c.col_id, c]));
  const grupos = familias(todos).filter((f) => soloDe === null || f.some((a) => soloDe.includes(a.nino_id)));
  const ids = grupos.flat().map((a) => a.nino_id);
  const cuotas = await repo.cuotasDe(ids);

  const meses = new Map<number, MesDelHijo[]>();
  for (const grupo of grupos) {
    const deGrupo = new Set(grupo.map((a) => a.nino_id));
    const r = mesesDeLaFamilia(
      grupo.map(aHijo),
      porColegio,
      cuotas.filter((c) => deGrupo.has(c.nino_id)),
      hoy,
    );
    for (const [id, lista] of r) meses.set(id, lista);
  }
  return { alumnos: new Map(grupos.flat().map((a) => [a.nino_id, a])), meses, colegios, config, hoy };
}

const DEBE = new Set(['pendiente', 'atrasado']);

// ---------------------------------------------------------------------------
// El representante

export interface PagoVista {
  menpag_id: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fecha: string;
  total: number;
  motivo: string | null;
  cuotas: Array<{ nombre: string; col_nombre: string; mes: Mes; total: number }>;
}

export interface MisMensualidades {
  cuenta_bancaria: string | null;
  /** Sus hijos por colegio, con todos sus meses (pagados y por pagar). */
  colegios: Array<{
    col_id: number;
    col_nombre: string;
    /** Hasta qué día del mes se paga en ese colegio. */
    dia_limite: number;
    hijos: Array<{ nino_id: number; nombre: string; meses: MesDelHijo[] }>;
  }>;
  pagos: PagoVista[];
}

const vistaDePago = (p: repo.PagoFila): PagoVista => ({
  menpag_id: p.menpag_id,
  estado: p.estado,
  fecha: p.fecha,
  total: p.total,
  motivo: p.motivo,
  cuotas: p.detalle.map((c) => ({ nombre: c.nombre, col_nombre: c.col_nombre, mes: c.mes, total: c.total })),
});

export async function misMensualidades(actor: AuthUser): Promise<MisMensualidades> {
  const usuId = actor.usuario.usu_id;
  const hijos = await repo.hijosDe(usuId);
  const [calculo, pagos] = await Promise.all([calcular(hijos), repo.pagosDe(usuId)]);

  const colegios = new Map<number, MisMensualidades['colegios'][number]>();
  for (const id of hijos) {
    const a = calculo.alumnos.get(id);
    const meses = calculo.meses.get(id) ?? [];
    if (!a || meses.length === 0) continue;
    const col = colegios.get(a.col_id) ?? {
      col_id: a.col_id,
      col_nombre: a.col_nombre,
      dia_limite: calculo.colegios.find((c) => c.col_id === a.col_id)?.diaLimite ?? 10,
      hijos: [],
    };
    col.hijos.push({ nino_id: id, nombre: a.nombre, meses });
    colegios.set(a.col_id, col);
  }
  return {
    cuenta_bancaria: calculo.config.cuenta_bancaria,
    colegios: [...colegios.values()].sort((x, y) => x.col_nombre.localeCompare(y.col_nombre)),
    pagos: pagos.map(vistaDePago),
  };
}

const aCentavos = (d: number) => Math.round(d * 100);

export async function pagar(
  actor: AuthUser,
  input: PagarInput,
  meta: { ip: string | null; navegador: string | null },
): Promise<{ menpag_id: number; total: number }> {
  const usuId = actor.usuario.usu_id;
  const hijos = await repo.hijosDe(usuId);
  if (hijos.length === 0) throw new ApiError(403, 'Tu cuenta no tiene hijos inscritos.');

  const claves = new Set(input.cuotas.map((c) => `${c.nino_id}|${c.mes}`));
  if (claves.size !== input.cuotas.length) throw new ApiError(400, 'Un mes está repetido.');

  const calculo = await calcular(hijos);
  const detalle: repo.CuotaDetalle[] = [];
  for (const pedida of input.cuotas) {
    const a = calculo.alumnos.get(pedida.nino_id);
    const mes = hijos.includes(pedida.nino_id)
      ? calculo.meses.get(pedida.nino_id)?.find((m) => m.mes === pedida.mes)
      : undefined;
    if (!a || !mes || !DEBE.has(mes.estado)) {
      throw new ApiError(409, 'Uno de los meses elegidos ya está pagado o en revisión. Recarga la página.');
    }
    detalle.push({
      nino_id: a.nino_id,
      nombre: a.nombre,
      col_id: a.col_id,
      col_nombre: a.col_nombre,
      mes: mes.mes,
      disciplinas: mes.disciplinas,
      subtotal: mes.subtotal,
      descuento: mes.descuento,
      iva: mes.iva,
      total: mes.total,
    });
  }
  const suma = (f: (c: repo.CuotaDetalle) => number) => detalle.reduce((s, c) => s + aCentavos(f(c)), 0);
  const total = suma((c) => c.total);
  if (total !== aCentavos(input.total)) {
    throw new ApiError(409, 'El valor a pagar cambió mientras llenabas. Recarga la página para ver el nuevo.');
  }

  const comprobante = Buffer.from(input.comprobante.base64, 'base64');
  if (comprobante.length > 2 * 1024 * 1024) throw new ApiError(400, 'El comprobante pesa más de 2 MB.');
  if (!firmaDeImagenValida(comprobante, input.comprobante.mime)) {
    throw new ApiError(400, 'El comprobante no es una imagen válida.');
  }
  const ruta = await subirArchivo('comprobantes', comprobante, input.comprobante.mime, MIME_COMPROBANTE[input.comprobante.mime]!);

  try {
    const id = await enTransaccion(async (client) => {
      const nuevo = await repo.crearPago(client, {
        usuId,
        comprobante: ruta,
        subtotal: (suma((c) => c.subtotal) - suma((c) => c.descuento)) / 100,
        iva: suma((c) => c.iva) / 100,
        total: total / 100,
        cuotas: detalle,
        ...meta,
      });
      await auditar(
        {
          actor,
          accion: 'crear',
          entidad: 'mensualidad_pago',
          entidadId: nuevo,
          detalle: { total: total / 100, cuotas: detalle.map((c) => `${c.nombre} ${c.mes}`) },
        },
        client,
      );
      return nuevo;
    });
    return { menpag_id: id, total: total / 100 };
  } catch (err) {
    await borrarArchivos([ruta]);
    if ((err as { code?: string }).code === '23505') {
      throw new ApiError(409, 'Uno de los meses elegidos ya está pagado o en revisión. Recarga la página.');
    }
    throw err;
  }
}

/** "Volver a intentar": borra el rechazado, con su motivo y su comprobante. */
export async function descartarRechazado(actor: AuthUser, id: number): Promise<void> {
  const ruta = await enTransaccion(async (client) => {
    const p = await repo.obtenerPago(id, client);
    if (!p || p.usu_id !== actor.usuario.usu_id) throw new ApiError(404, 'Pago no encontrado');
    if (p.estado !== 'rechazado') throw new ApiError(409, 'Solo se descarta un pago rechazado.');
    await repo.borrarPago(client, id);
    return p.comprobante;
  });
  await borrarArchivos([ruta]);
}

// ---------------------------------------------------------------------------
// El personal

export function exigirPersonal(actor: AuthUser): void {
  if (!esPersonal(actor)) throw new ApiError(403, 'Solo el personal de Activa Reforce puede hacer esto');
}

export interface PagoListado extends Omit<repo.PagoFila, 'comprobante'> {
  meses: string[];
  alumnos: string[];
}

const listado = ({ comprobante: _c, ...p }: repo.PagoFila): PagoListado => ({
  ...p,
  meses: [...new Set(p.detalle.map((c) => nombreDeMes(c.mes)))],
  alumnos: [...new Set(p.detalle.map((c) => c.nombre))],
});

export async function listarPagos(
  query: ListarPagosQuery,
): Promise<Pagina<PagoListado> & { conteos: { pendientes: number } }> {
  const [{ items, total }, pendientes] = await Promise.all([repo.listarPagos(query), repo.contarPendientes()]);
  return { ...armarPagina(items.map(listado), total, query), conteos: { pendientes } };
}

export async function verPago(id: number): Promise<PagoListado & { comprobante_url: string | null }> {
  const p = await repo.obtenerPago(id);
  if (!p || p.estado === 'rechazado') throw new ApiError(404, 'Pago no encontrado');
  const firmadas = await firmarArchivos([p.comprobante]);
  return { ...listado(p), comprobante_url: firmadas.get(p.comprobante) ?? null };
}

export async function aprobarPago(actor: AuthUser, id: number): Promise<void> {
  await enTransaccion(async (client) => {
    const p = await repo.obtenerPago(id, client);
    if (!p || p.estado === 'rechazado') throw new ApiError(404, 'Pago no encontrado');
    if (p.estado !== 'pendiente') throw new ApiError(409, 'Este pago ya está aprobado.');
    await repo.aprobarPago(client, id, actor.usuario.usu_id);
    await auditar({ actor, accion: 'editar', entidad: 'mensualidad_pago', entidadId: id, detalle: { aprobado: true } }, client);
  });
}

export async function rechazarPago(actor: AuthUser, id: number, motivo: string): Promise<void> {
  await enTransaccion(async (client) => {
    const p = await repo.obtenerPago(id, client);
    if (!p || p.estado === 'rechazado') throw new ApiError(404, 'Pago no encontrado');
    if (p.estado !== 'pendiente') throw new ApiError(409, 'Un pago aprobado no se rechaza.');
    await repo.rechazarPago(client, id, actor.usuario.usu_id, motivo);
    await auditar(
      { actor, accion: 'eliminar', entidad: 'mensualidad_pago', entidadId: id, detalle: { rechazado: true, motivo } },
      client,
    );
  });
}

export interface AlumnoDelMes {
  nino_id: number;
  nombre: string;
  representantes: string[];
  estado: MesDelHijo['estado'];
  disciplinas: string[];
  inscripcion: string[];
  total: number;
}

export interface ColegioDelMes {
  col_id: number;
  col_nombre: string;
  /** El colegio cobra este mes (no está en pausa ni sin configurar). */
  cobra: boolean;
  alumnos: AlumnoDelMes[];
  totales: {
    pagados: number;
    inscripcion: number;
    revision: number;
    pendientes: number;
    atrasados: number;
    recaudado: number;
    en_revision: number;
    por_cobrar: number;
  };
}

/** El estado de un mes (por defecto, el actual), alumno por alumno y por colegio. */
export async function estadoDelMes(mesPedido: string | undefined, colegio: number | undefined) {
  const calculo = await calcular(null);
  const actual = mesDe(calculo.hoy);
  const mes = mesPedido ? `${mesPedido}-01` : actual;
  if (mes > actual) throw new ApiError(400, 'Solo se consultan el mes en curso y los anteriores.');

  const resultado: ColegioDelMes[] = calculo.colegios
    .filter((c) => !colegio || c.col_id === colegio)
    .map((c) => ({
      col_id: c.col_id,
      col_nombre: c.col_nombre,
      cobra: c.desde !== null && mes >= c.desde && c.meses.includes(Number(mes.slice(5, 7))),
      alumnos: [],
      totales: { pagados: 0, inscripcion: 0, revision: 0, pendientes: 0, atrasados: 0, recaudado: 0, en_revision: 0, por_cobrar: 0 },
    }));
  const porId = new Map(resultado.map((c) => [c.col_id, c]));

  for (const [ninoId, meses] of calculo.meses) {
    const m = meses.find((x) => x.mes === mes);
    const a = calculo.alumnos.get(ninoId);
    const col = a ? porId.get(a.col_id) : undefined;
    if (!m || !a || !col) continue;
    col.alumnos.push({
      nino_id: ninoId,
      nombre: a.nombre,
      representantes: a.representantes_nombres,
      estado: m.estado,
      disciplinas: m.disciplinas,
      inscripcion: m.inscripcion,
      total: m.total,
    });
    const t = col.totales;
    const c = aCentavos(m.total);
    if (m.estado === 'pagado') {
      t.pagados++;
      t.recaudado += c;
    } else if (m.estado === 'inscripcion') t.inscripcion++;
    else if (m.estado === 'revision') {
      t.revision++;
      t.en_revision += c;
    } else {
      if (m.estado === 'pendiente') t.pendientes++;
      else t.atrasados++;
      t.por_cobrar += c;
    }
  }
  for (const c of resultado) {
    c.alumnos.sort((x, y) => x.nombre.localeCompare(y.nombre));
    c.totales.recaudado /= 100;
    c.totales.en_revision /= 100;
    c.totales.por_cobrar /= 100;
  }
  return { mes, actual, colegios: resultado };
}

// ---------------------------------------------------------------------------
// Configuración

/** Lo de cada colegio con valores: sus días y sus meses de cobro (0041, 0042). */
export async function config() {
  const [c, colegios] = await Promise.all([repo.obtenerConfig(), repo.colegios()]);
  return {
    recordatorio: c.recordatorio,
    colegios: colegios.map((x) => ({
      col_id: x.col_id,
      col_nombre: x.col_nombre,
      meses: x.meses,
      desde: x.desde,
      dia_limite: x.diaLimite,
      dia_corte: x.diaCorte,
    })),
  };
}

export async function guardarCobroColegio(actor: AuthUser, colId: number, c: repo.CobroDelColegio): Promise<void> {
  if (c.desde !== null && c.meses.length === 0) throw new ApiError(400, 'Marca al menos un mes de cobro.');
  await enTransaccion(async (client) => {
    const hecho = await repo.guardarCobroColegio(client, colId, c);
    if (!hecho) throw new ApiError(404, 'Ese colegio no tiene valores configurados.');
    await auditar(
      { actor, accion: 'editar', entidad: 'mensualidad_colegio', entidadId: colId, detalle: { ...c } },
      client,
    );
  });
}
