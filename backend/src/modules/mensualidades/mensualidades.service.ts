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
import { ROL } from '../../lib/constants.js';
import { frontendBaseUrl } from '../../config/env.js';
import { escaparHtml } from '../../lib/correo.js';
import { configuracion, enviarComo } from '../correos/correos.service.js';
import {
  describirDisciplina,
  esPersonal,
  firmaDeImagenValida,
  normalizarNombre,
} from '../inscripciones/inscripciones.service.js';
import {
  PRIMER_MES,
  debe,
  familias,
  mesDe,
  mesQueFalta,
  mesesAtrasados,
  mesesDeLaFamilia,
  nombreDeMes,
  type ColegioCobro,
  type EstadoMes,
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
 *                                └──rechazar──▶ ∅ (se borra con su comprobante:
 *                                               como si nunca se hubiera
 *                                               subido; sus meses vuelven a
 *                                               deberse. Cliente, 2026-11-16)
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

/**
 * Lo dado de alta a mano hasta noviembre de 2026 entra como lo inscrito:
 * noviembre pagado (PRIMER_MES). Después, una alta a mano cobra su primer mes.
 */
const aHijo = (a: repo.AlumnoConDisciplinas): HijoCobro => ({
  nino_id: a.nino_id,
  nombre: a.nombre,
  col_id: a.col_id,
  disciplinas: a.disciplinas.map((d) => {
    const inicio = mesDe(d.inicio);
    const deArranque = inicio <= PRIMER_MES;
    return {
      colacthor_id: d.colacthor_id,
      nombre: describirDisciplina(d),
      inicio: deArranque && inicio < PRIMER_MES ? PRIMER_MES : inicio,
      porInscripcion: d.por_inscripcion || deArranque,
      pagadoEl: d.pagado_el,
    };
  }),
});

/**
 * Los meses de los alumnos activos. Con `soloDe`, solo las familias de esos
 * niños (el descuento de hermano se calcula con la familia entera). `hoy`
 * decide qué está atrasado: Asistencias lo pide con la fecha de la clase.
 */
async function calcular(soloDe: number[] | null, hoy: string = hoyEc()): Promise<Calculo> {
  const [config, colegios, todos] = await Promise.all([repo.obtenerConfig(), repo.colegios(), repo.alumnosActivos()]);
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

// ---------------------------------------------------------------------------
// El representante

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
}

export async function misMensualidades(actor: AuthUser): Promise<MisMensualidades> {
  const usuId = actor.usuario.usu_id;
  const hijos = await repo.hijosDe(usuId);
  const calculo = await calcular(hijos);

  const colegios = new Map<number, MisMensualidades['colegios'][number]>();
  for (const id of hijos) {
    const a = calculo.alumnos.get(id);
    const meses = calculo.meses.get(id) ?? [];
    if (!a || meses.length === 0) continue;
    const col = colegios.get(a.col_id) ?? {
      col_id: a.col_id,
      col_nombre: a.col_nombre,
      dia_limite: calculo.colegios.find((c) => c.col_id === a.col_id)?.diaLimite ?? 5,
      hijos: [],
    };
    col.hijos.push({ nino_id: id, nombre: a.nombre, meses });
    colegios.set(a.col_id, col);
  }
  return {
    cuenta_bancaria: calculo.config.cuenta_bancaria,
    colegios: [...colegios.values()].sort((x, y) => x.col_nombre.localeCompare(y.col_nombre)),
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
    if (!a || !mes || !debe(mes.estado)) {
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
  // En orden: no se paga un mes si el anterior del mismo alumno sigue por pagar.
  for (const id of new Set(input.cuotas.map((c) => c.nino_id))) {
    const elegidos = new Set(input.cuotas.filter((c) => c.nino_id === id).map((c) => c.mes));
    const falta = mesQueFalta(calculo.meses.get(id) ?? [], elegidos);
    if (falta) {
      const nombre = calculo.alumnos.get(id)?.nombre ?? 'tu hijo';
      throw new ApiError(400, `Primero marca ${nombreDeMes(falta)} de ${nombre}, que está pendiente.`);
    }
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
    // Aviso al equipo (lista de 'mensualidades_aviso'), después del COMMIT.
    void avisarPagoNuevo(actor.usuario.usu_nombre, actor.usuario.usu_correo, detalle, total / 100);
    return { menpag_id: id, total: total / 100 };
  } catch (err) {
    await borrarArchivos([ruta]);
    if ((err as { code?: string }).code === '23505') {
      throw new ApiError(409, 'Uno de los meses elegidos ya está pagado o en revisión. Recarga la página.');
    }
    throw err;
  }
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
  void avisarPagoAprobado(id);
}

// ---------------------------------------------------------------------------
// Correos de pagos (0045)

const tablaDePago = (cuotas: repo.CuotaDetalle[]) =>
  cuotas
    .map(
      (c) => `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;">${escaparHtml(c.nombre)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;">${escaparHtml(nombreDeMes(c.mes))}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;">${escaparHtml(c.col_nombre)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">$${c.total.toFixed(2)}</td>
      </tr>`,
    )
    .join('');

const lineasDePago = (cuotas: repo.CuotaDetalle[]) =>
  cuotas.map((c) => `${c.nombre} · ${nombreDeMes(c.mes)} · ${c.col_nombre}: $${c.total.toFixed(2)}`);

/** Al equipo: llegó un pago de mensualidad por revisar. Nunca lanza. */
async function avisarPagoNuevo(nombre: string, correo: string, cuotas: repo.CuotaDetalle[], total: number) {
  try {
    const enlace = `${frontendBaseUrl}/inscripciones`;
    const asunto = `Pago de mensualidad por revisar: ${nombre} — $${total.toFixed(2)}`;
    const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;padding:16px;">
      <h2 style="margin:0 0 8px 0;font-size:18px;">Pago de mensualidad por revisar</h2>
      <p style="margin:0 0 12px 0;font-size:15px;"><strong>${escaparHtml(nombre)}</strong> (${escaparHtml(correo)}) envió un pago de <strong>$${total.toFixed(2)}</strong>.</p>
      <table style="border-collapse:collapse;font-size:14px;">${tablaDePago(cuotas)}</table>
      <p style="margin:12px 0 0 0;font-size:13px;">Revísalo en <a href="${escaparHtml(enlace)}">${escaparHtml(enlace)}</a> → Mensualidades → Por revisar.</p>
    </body></html>`;
    const texto = [asunto, '', ...lineasDePago(cuotas), '', `Revísalo en ${enlace}`].join('\n');
    await enviarComo('mensualidades_aviso', { asunto, html, texto });
  } catch (err) {
    console.error('Aviso de pago de mensualidad no enviado:', err);
  }
}

/** Al representante, si está encendido en 'mensualidades_aviso': su pago quedó aprobado. Nunca lanza. */
async function avisarPagoAprobado(id: number) {
  try {
    const config = await configuracion('mensualidades_aviso');
    if (!config?.notificar_representante) return;
    const p = await repo.obtenerPago(id);
    if (!p?.representante_correo) return;
    const asunto = `Tu pago de mensualidad fue aprobado — $${p.total.toFixed(2)}`;
    const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;padding:16px;">
      <h2 style="margin:0 0 8px 0;font-size:18px;color:#047857;">Pago aprobado</h2>
      <p style="margin:0 0 12px 0;font-size:15px;">Hola ${escaparHtml(p.representante_nombre ?? '')}, aprobamos tu pago de <strong>$${p.total.toFixed(2)}</strong>. Estos meses quedan pagados:</p>
      <table style="border-collapse:collapse;font-size:14px;">${tablaDePago(p.detalle)}</table>
      <p style="margin:12px 0 0 0;font-size:13px;">Gracias.</p>
    </body></html>`;
    const texto = [asunto, '', ...lineasDePago(p.detalle)].join('\n');
    await enviarComo('mensualidades_aviso', { asunto, html, texto, para: p.representante_correo });
  } catch (err) {
    console.error('Correo de pago aprobado no enviado:', err);
  }
}

/**
 * Rechazar (cliente, 2026-11-16): el pago se borra entero, con sus meses y
 * su comprobante, como si nunca se hubiera subido; el representante puede
 * volver a pagar esos meses. El personal lo contacta por fuera (la pantalla
 * le da teléfono, correo y WhatsApp). No se guarda nada del rechazo, ni en
 * auditoría (cliente, 2026-11-16).
 */
export async function rechazarPago(_actor: AuthUser, id: number): Promise<void> {
  await borrarPagoEntero(id, (p) => {
    if (p.estado !== 'pendiente') throw new ApiError(409, 'Un pago aprobado no se rechaza: se anula.');
  });
}

/**
 * Anular un pago ya aprobado (cliente, 2026-11-16): el mismo efecto que
 * rechazar —se borra entero, sin registro, y sus meses vuelven a deberse—.
 * Solo el Propietario y con el nombre del representante escrito a mano,
 * como Anular inscripción.
 */
export async function anularPago(actor: AuthUser, id: number, confirmacion: string): Promise<void> {
  if (!actor.usuario.roles.some((r) => r.rol_id === ROL.PROPIETARIO)) {
    throw new ApiError(403, 'Solo el Propietario puede anular un pago aprobado');
  }
  await borrarPagoEntero(id, (p) => {
    if (p.estado !== 'aprobado') throw new ApiError(409, 'Solo se anula un pago aprobado: uno por revisar se rechaza.');
    if (!p.representante_nombre || normalizarNombre(confirmacion) !== normalizarNombre(p.representante_nombre)) {
      throw new ApiError(400, 'El nombre escrito no coincide con el del representante');
    }
  });
}

/** Borra el pago con sus meses y, tras el COMMIT, su comprobante. `exigir` lanza si no toca. */
async function borrarPagoEntero(id: number, exigir: (p: repo.PagoFila) => void): Promise<void> {
  const ruta = await enTransaccion(async (client) => {
    const p = await repo.obtenerPago(id, client);
    if (!p || p.estado === 'rechazado') throw new ApiError(404, 'Pago no encontrado');
    exigir(p);
    await repo.borrarPago(client, id);
    return p.comprobante;
  });
  await borrarArchivos([ruta]);
}

export interface AlumnoDelMes {
  nino_id: number | null;
  nombre: string;
  representantes: string[];
  /** Representantes con teléfono y correo, para contactarlos (vacío si está de baja). */
  contactos: repo.Contacto[];
  /** null: ese mes no tiene cobro; sale porque pagó en él otros meses. */
  estado: MesDelHijo['estado'] | null;
  disciplinas: string[];
  inscripcion: string[];
  /** Lo que vale el mes: lo pagado o lo que debe. */
  valor: number;
  /** Pagado o en revisión: el día del pago. */
  pagado_el: string | null;
  /**
   * El pago de mensualidad que se abre al pulsar la fila: el de este mes o,
   * si no, el que entró este mes. Null si no hay ninguno (2026-11-16).
   */
  menpag_id: number | null;
  /** Lo que entró este mes por este alumno (aprobado o en revisión), sea del mes que sea. */
  recibido: number;
  /** La parte de `recibido` que sigue en revisión. */
  recibido_revision: number;
  /** Los otros meses que pagó con lo recibido este mes. */
  cubre: Mes[];
  /** Tiene una inscripción enviada este mes que aún no se aprueba. */
  inscripcion_en_revision: boolean;
  /** Ya no está activo: sale solo porque su dinero entró este mes. */
  baja: boolean;
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
    /** Aprobado y enviado en este mes, sea del mes que sea (caja): mensualidades e inscripciones. */
    recaudado: number;
    /** En revisión, enviado en este mes: mensualidades e inscripciones. */
    en_revision: number;
    /** Lo que se debe de este mes. */
    por_cobrar: number;
  };
}

/**
 * El estado de un mes (por defecto, el actual), alumno por alumno y por
 * colegio. El dinero va por fecha de pago (cliente, 2026-11-16): quien pagó
 * $300 el 16 de noviembre por diciembre, enero y febrero suma $300 en
 * noviembre, y en diciembre, enero y febrero sale pagado con $0 recibido.
 */
export async function estadoDelMes(mesPedido: string | undefined, colegio: number | undefined) {
  const actual = mesDe(hoyEc());
  const mes = mesPedido ? `${mesPedido}-01` : actual;
  const porMes = await estadoDeMeses([mes], colegio ? [colegio] : null);
  return { mes, actual, colegios: porMes.get(mes)! };
}

/**
 * El estado de varios meses de una vez, con un solo cálculo: lo usa también
 * el reporte de Mensualidades (Reportes → Pagos), para que cuadre con esta
 * pantalla. `colegios` null = todos.
 */
export async function estadoDeMeses(meses: Mes[], colegios: number[] | null): Promise<Map<Mes, ColegioDelMes[]>> {
  const calculo = await calcular(null, hoyEc());
  const cobros = await Promise.all(
    meses.map(async (mes) => {
      const [mensualidades, inscripciones] = await Promise.all([
        repo.cobradoEn(mes),
        repo.inscripcionesCobradasEn(mes),
      ]);
      return [...mensualidades, ...inscripciones];
    }),
  );
  return new Map(meses.map((mes, i) => [mes, armarMes(calculo, mes, cobros[i]!, colegios)]));
}

function armarMes(calculo: Calculo, mes: Mes, cobrado: repo.CuotaCobrada[], colegios: number[] | null): ColegioDelMes[] {
  const resultado: ColegioDelMes[] = calculo.colegios
    .filter((c) => !colegios || colegios.includes(c.col_id))
    .map((c) => ({
      col_id: c.col_id,
      col_nombre: c.col_nombre,
      cobra: c.meses.includes(mes),
      alumnos: [],
      totales: { pagados: 0, inscripcion: 0, revision: 0, pendientes: 0, atrasados: 0, recaudado: 0, en_revision: 0, por_cobrar: 0 },
    }));
  const porId = new Map(resultado.map((c) => [c.col_id, c]));

  // Lo que entró este mes, por alumno.
  const claveDe = (colId: number, ninoId: number | null, nombre: string) => `${colId}|${ninoId ?? `n:${nombre}`}`;
  const entradas = new Map<string, repo.CuotaCobrada[]>();
  for (const c of cobrado) {
    if (c.col_id === null || !porId.has(c.col_id)) continue;
    const k = claveDe(c.col_id, c.nino_id, c.nombre);
    entradas.set(k, [...(entradas.get(k) ?? []), c]);
  }
  const sacarEntradas = (col: ColegioDelMes, k: string) => {
    const lista = entradas.get(k) ?? [];
    entradas.delete(k);
    const pago = lista.find((c) => c.menpag_id !== null)?.menpag_id ?? null;
    for (const c of lista) {
      if (c.estado === 'aprobado') col.totales.recaudado += aCentavos(c.total);
      else col.totales.en_revision += aCentavos(c.total);
    }
    return {
      recibido: lista.reduce((s, c) => s + aCentavos(c.total), 0) / 100,
      recibido_revision: lista.filter((c) => c.estado !== 'aprobado').reduce((s, c) => s + aCentavos(c.total), 0) / 100,
      cubre: [...new Set(lista.map((c) => c.mes).filter((m) => m !== mes))].sort(),
      inscripcion_en_revision: lista.some((c) => c.tipo === 'inscripcion' && c.estado === 'pendiente'),
      menpag_id: pago,
    };
  };

  for (const [ninoId, meses] of calculo.meses) {
    const m = meses.find((x) => x.mes === mes);
    const a = calculo.alumnos.get(ninoId);
    const col = a ? porId.get(a.col_id) : undefined;
    if (!a || !col) continue;
    const k = claveDe(col.col_id, ninoId, a.nombre);
    if (!m && !entradas.has(k)) continue;
    col.alumnos.push({
      baja: false,
      nino_id: ninoId,
      nombre: a.nombre,
      representantes: a.representantes_nombres,
      contactos: a.contactos,
      estado: m?.estado ?? null,
      disciplinas: m?.disciplinas ?? [],
      inscripcion: m?.inscripcion ?? [],
      valor: m?.total ?? 0,
      pagado_el: m?.pagado_el ?? null,
      ...(() => {
        const dinero = sacarEntradas(col, k);
        return { ...dinero, menpag_id: m?.menpag_id ?? dinero.menpag_id };
      })(),
    });
    if (!m) continue;
    const t = col.totales;
    if (m.estado === 'pagado') t.pagados++;
    else if (m.estado === 'inscripcion') t.inscripcion++;
    else if (m.estado === 'revision') t.revision++;
    else {
      if (m.estado === 'pendiente') t.pendientes++;
      else t.atrasados++;
      t.por_cobrar += aCentavos(m.total);
    }
  }
  /**
   * Lo que entró de alumnos que no salen arriba: dados de baja (el dinero
   * entró y tiene que cuadrar) o inscripciones aún sin aprobar. Con su estado
   * real de este mes si pagaron este mes; si no, "pagó otros meses".
   */
  for (const [k, lista] of [...entradas]) {
    const primera = lista[0]!;
    const col = porId.get(primera.col_id!)!;
    const deEsteMes = lista.filter((c) => c.mes === mes);
    const aprobada = (tipo: repo.CuotaCobrada['tipo']) => deEsteMes.some((c) => c.tipo === tipo && c.estado === 'aprobado');
    const estado: AlumnoDelMes['estado'] = aprobada('inscripcion')
      ? 'inscripcion'
      : aprobada('mensualidad')
        ? 'pagado'
        : deEsteMes.some((c) => c.tipo === 'mensualidad')
          ? 'revision'
          : null;
    col.alumnos.push({
      baja: lista.some((c) => c.tipo === 'mensualidad' || c.estado === 'aprobado'),
      nino_id: primera.nino_id,
      nombre: primera.nombre,
      representantes: [],
      contactos: [],
      estado,
      disciplinas: [],
      inscripcion: [],
      valor: 0,
      pagado_el: null,
      ...sacarEntradas(col, k),
    });
  }
  for (const c of resultado) {
    c.alumnos.sort((x, y) => x.nombre.localeCompare(y.nombre));
    c.totales.recaudado /= 100;
    c.totales.en_revision /= 100;
    c.totales.por_cobrar /= 100;
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Reportes → Pagos → Mensualidades

export type EstadoRegistro = EstadoMes | 'inscripcion_revision';

/** Un mes de un alumno: lo que vale, cómo está y, si se pagó, con qué y cuándo. */
export interface RegistroMensual {
  mes: Mes;
  col_id: number | null;
  col_nombre: string;
  nino_id: number | null;
  alumno: string;
  estado: EstadoRegistro;
  /** Lo que vale ese mes para ese alumno (con IVA): lo pagado o lo que debe. */
  valor: number;
  pagado_con: 'inscripcion' | 'mensualidad' | null;
  /** Día (Ecuador) del pago. */
  fecha_pago: string | null;
  /** Mes en que entró el dinero. */
  mes_pago: Mes | null;
  /** El dinero ya está aprobado (si no, en revisión). */
  aprobado: boolean;
  disciplinas: string[];
  representante: string;
  cedula: string;
  telefono: string;
  correo: string;
  baja: boolean;
  /** Un mes que aún no llega y está sin pagar. */
  futuro: boolean;
}

/**
 * Lo que se debe, alumno por alumno y mes por mes (pendiente o atrasado), con
 * su desglose y el representante: para el Excel de facturación de
 * Mensualidades (2026-11-18). Mismo cálculo que el Estado del mes.
 */
export interface Deuda {
  nino_id: number;
  alumno: string;
  col_id: number;
  col_nombre: string;
  mes: Mes;
  estado: 'pendiente' | 'atrasado';
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  disciplinas: string[];
  contacto: repo.Contacto | null;
  /** Un mes que aún no llega. */
  futuro: boolean;
}

export async function deudas(colegios: number[] | null): Promise<Deuda[]> {
  const hoy = hoyEc();
  const actual = mesDe(hoy);
  const calculo = await calcular(null, hoy);
  const salida: Deuda[] = [];
  for (const [ninoId, meses] of calculo.meses) {
    const a = calculo.alumnos.get(ninoId);
    if (!a || (colegios && !colegios.includes(a.col_id))) continue;
    for (const m of meses) {
      if (m.estado !== 'pendiente' && m.estado !== 'atrasado') continue;
      salida.push({
        nino_id: ninoId,
        alumno: a.nombre,
        col_id: a.col_id,
        col_nombre: a.col_nombre,
        mes: m.mes,
        estado: m.estado,
        subtotal: m.subtotal,
        descuento: m.descuento,
        iva: m.iva,
        total: m.total,
        disciplinas: m.disciplinas.map(soloActividad),
        contacto: a.contactos[0] ?? null,
        futuro: m.mes > actual,
      });
    }
  }
  return salida;
}

/** "Danza — Martes y Jueves 15:00–16:00" → "Danza". */
const soloActividad = (d: string) => d.split(' — ')[0]!;

/**
 * Una fila por alumno y por mes que le corresponde (cliente, 2026-11-16),
 * para Reportes → Pagos → Mensualidades: todos los meses de cobro de cada
 * alumno (los que aún no llegan y siguen sin pagar, con `futuro`); lo pagado
 * por alumnos que ya no están activos; y las inscripciones aún sin aprobar. El valor nunca es 0: un mes
 * pagado por la inscripción vale la parte del alumno en ella.
 */
export async function registrosMensuales(colegios: number[] | null): Promise<RegistroMensual[]> {
  const hoy = hoyEc();
  const actual = mesDe(hoy);
  const [calculo, registros] = await Promise.all([calcular(null, hoy), repo.registrosDePago()]);

  const pendientes = new Map<string, repo.RegistroDePago[]>();
  const clave = (tipo: string, nino: number | null, nombre: string, mes: Mes) => `${tipo}|${nino ?? `n:${nombre}`}|${mes}`;
  for (const r of registros) {
    const k = clave(r.tipo, r.nino_id, r.nombre, r.mes);
    pendientes.set(k, [...(pendientes.get(k) ?? []), r]);
  }
  const sacar = (tipo: string, nino: number, nombre: string, mes: Mes) => {
    const k = clave(tipo, nino, nombre, mes);
    const lista = pendientes.get(k) ?? [];
    pendientes.delete(k);
    return lista;
  };
  const ultimo = <T>(lista: T[], f: (x: T) => string | null) =>
    lista.map(f).filter((x): x is string => Boolean(x)).sort().at(-1) ?? null;
  const sumar = (lista: repo.RegistroDePago[]) => lista.reduce((s, r) => s + aCentavos(r.total), 0) / 100;

  const filas: RegistroMensual[] = [];
  for (const [ninoId, meses] of calculo.meses) {
    const a = calculo.alumnos.get(ninoId);
    if (!a) continue;
    const contacto = a.contactos[0];
    const base = {
      col_id: a.col_id,
      col_nombre: a.col_nombre,
      nino_id: ninoId,
      alumno: a.nombre,
      representante: contacto?.nombre ?? a.representantes_nombres[0] ?? '',
      cedula: contacto?.cedula ?? '',
      telefono: contacto?.telefono ?? '',
      correo: contacto?.correo ?? '',
      baja: false,
      futuro: false,
    };
    for (const m of meses) {
      if (m.estado === 'pagado' || m.estado === 'revision') {
        const regs = sacar('mensualidad', ninoId, a.nombre, m.mes);
        filas.push({
          ...base,
          mes: m.mes,
          estado: m.estado,
          valor: regs.length > 0 ? sumar(regs) : m.total,
          pagado_con: 'mensualidad',
          fecha_pago: ultimo(regs, (r) => r.fecha_pago) ?? m.pagado_el,
          mes_pago: ultimo(regs, (r) => r.mes_pago) ?? (m.pagado_el ? mesDe(m.pagado_el) : null),
          aprobado: m.estado === 'pagado',
          disciplinas: m.disciplinas.map(soloActividad),
        });
      } else if (m.estado === 'inscripcion') {
        const regs = sacar('inscripcion', ninoId, a.nombre, m.mes);
        filas.push({
          ...base,
          mes: m.mes,
          estado: 'inscripcion',
          valor: sumar(regs),
          pagado_con: 'inscripcion',
          fecha_pago: ultimo(regs, (r) => r.fecha_pago) ?? m.pagado_el,
          mes_pago: ultimo(regs, (r) => r.mes_pago),
          aprobado: true,
          disciplinas: m.inscripcion.map(soloActividad),
        });
      } else {
        filas.push({
          ...base,
          mes: m.mes,
          estado: m.estado,
          valor: m.total,
          pagado_con: null,
          fecha_pago: null,
          mes_pago: null,
          aprobado: false,
          disciplinas: m.disciplinas.map(soloActividad),
          futuro: m.mes > actual,
        });
      }
    }
  }

  // Lo pagado que no salió arriba: alumnos de baja, inscripciones sin aprobar, meses fuera de la configuración.
  for (const regs of pendientes.values()) {
    const r = regs[0]!;
    const activo = r.nino_id !== null ? calculo.alumnos.get(r.nino_id) : undefined;
    const contacto = activo?.contactos[0];
    const aprobado = r.estado === 'aprobado';
    filas.push({
      mes: r.mes,
      col_id: r.col_id,
      col_nombre: r.col_nombre,
      nino_id: r.nino_id,
      alumno: r.nombre,
      estado:
        r.tipo === 'inscripcion' ? (aprobado ? 'inscripcion' : 'inscripcion_revision') : aprobado ? 'pagado' : 'revision',
      valor: sumar(regs),
      pagado_con: r.tipo,
      fecha_pago: ultimo(regs, (x) => x.fecha_pago),
      mes_pago: ultimo(regs, (x) => x.mes_pago),
      aprobado,
      disciplinas: [...new Set(regs.flatMap((x) => x.disciplinas.map(soloActividad)))],
      representante: contacto?.nombre ?? '',
      cedula: contacto?.cedula ?? '',
      telefono: contacto?.telefono ?? '',
      correo: contacto?.correo ?? '',
      // De baja: tenía alumno y ya no está activo (una inscripción sin aprobar aún no tiene alumno).
      baja: r.nino_id !== null && !activo,
      futuro: false,
    });
  }

  return colegios ? filas.filter((f) => f.col_id !== null && colegios.includes(f.col_id)) : filas;
}

// ---------------------------------------------------------------------------
// Asistencias

/**
 * Los alumnos que en `fecha` deben algún mes ya vencido, con esos meses:
 * Asistencias los deja ausentes y sin poder cambiarlo (cliente,
 * 2026-11-16). Se mira con lo pagado hoy: si pagan, los días bloqueados se
 * vuelven a poder editar. Un mes en revisión no cuenta.
 */
export async function atrasadosEn(ninoIds: number[], fecha: string): Promise<Map<number, Mes[]>> {
  if (ninoIds.length === 0) return new Map();
  let calculo: Calculo;
  try {
    calculo = await calcular(ninoIds, fecha);
  } catch (err) {
    // Asistencias es lo más usado: si esto falla, se pasa lista sin bloqueo (queda en el log).
    console.error('No se pudo calcular la mensualidad atrasada:', err);
    return new Map();
  }
  const resultado = new Map<number, Mes[]>();
  for (const id of ninoIds) {
    const atrasados = mesesAtrasados(calculo.meses.get(id) ?? []);
    if (atrasados.length > 0) resultado.set(id, atrasados);
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Configuración

/** Lo de cada colegio con valores: su día límite y sus meses de cobro (con año). */
export async function config() {
  const [c, colegios] = await Promise.all([repo.obtenerConfig(), repo.colegios()]);
  return {
    recordatorio: c.recordatorio,
    colegios: colegios.map((x) => ({
      col_id: x.col_id,
      col_nombre: x.col_nombre,
      meses: x.meses,
      dia_limite: x.diaLimite,
    })),
  };
}

export async function guardarCobroColegio(actor: AuthUser, colId: number, c: repo.CobroDelColegio): Promise<void> {
  // Los meses ya pasados no se tocan (2026-11-16): marcar uno dejaría a todos debiéndolo.
  const actual = mesDe(hoyEc());
  const antes = (await repo.colegios()).find((x) => x.col_id === colId);
  const pasados = (lista: Mes[]) => lista.filter((m) => m < actual).sort().join();
  if (antes && pasados(antes.meses) !== pasados(c.meses)) {
    throw new ApiError(400, 'Los meses anteriores al actual no se pueden marcar ni desmarcar.');
  }
  await enTransaccion(async (client) => {
    const hecho = await repo.guardarCobroColegio(client, colId, c);
    if (!hecho) throw new ApiError(404, 'Ese colegio no tiene valores configurados.');
    await auditar(
      { actor, accion: 'editar', entidad: 'mensualidad_colegio', entidadId: colId, detalle: { ...c } },
      client,
    );
  });
}
