import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import { ESTADO } from '../../lib/constants.js';
import { textoEc } from '../../lib/fecha.js';
import { horariosJson, type HorarioDisciplina } from '../../lib/horarios.js';
import { contieneSinTildes } from '../../lib/sql.js';
import { offsetDe } from '../../lib/paginacion.js';
import type { ColegioCobro, CuotaRegistrada, Mes } from './mensualidades.calculo.js';
import type { ListarPagosQuery } from './mensualidades.schemas.js';

/** Acceso a datos de Mensualidades (migración 0041). */

// ---------------------------------------------------------------------------
// Configuración

export interface ConfigMensualidades {
  dia_limite: number;
  dia_corte: number;
  recordatorio: boolean;
  cuenta_bancaria: string | null;
}

export async function obtenerConfig(client?: PoolClient): Promise<ConfigMensualidades> {
  const { rows } = await (client ?? getPool()).query<ConfigMensualidades>(
    `SELECT inscfg_mens_dia_limite AS dia_limite, inscfg_mens_dia_corte AS dia_corte,
            inscfg_mens_recordatorio AS recordatorio, inscfg_cuenta_bancaria AS cuenta_bancaria
       FROM public.inscripcion_config WHERE inscfg_id = 1`,
  );
  const r = rows[0];
  if (!r) throw new Error('Falta la fila de inscripcion_config (migración 0016)');
  return r;
}

export async function guardarConfig(
  client: PoolClient,
  c: { dia_limite: number; dia_corte: number },
): Promise<void> {
  await client.query(
    `UPDATE public.inscripcion_config
        SET inscfg_mens_dia_limite = $1, inscfg_mens_dia_corte = $2, inscfg_fecha_modificacion = now()
      WHERE inscfg_id = 1`,
    [c.dia_limite, c.dia_corte],
  );
}

export interface ColegioConCobro extends ColegioCobro {
  col_id: number;
  col_nombre: string;
}

/** Los colegios con precio, con lo que cobran. */
export async function colegios(client?: PoolClient): Promise<ColegioConCobro[]> {
  const { rows } = await (client ?? getPool()).query<{
    col_id: number;
    col_nombre: string;
    precio: string;
    descuento: string;
    meses: number[];
    desde: string | null;
  }>(
    `SELECT cp.col_id, c.col_nombre,
            cp.colpre_precio_disciplina AS precio, cp.colpre_descuento_hermano AS descuento,
            cp.colpre_meses_cobro AS meses,
            to_char(cp.colpre_cobro_desde, 'YYYY-MM-DD') AS desde
       FROM public.colegio_precio cp
       JOIN public.colegio c ON c.col_id = cp.col_id
      ORDER BY c.col_nombre`,
  );
  return rows.map((r) => ({
    col_id: r.col_id,
    col_nombre: r.col_nombre,
    precio: Number(r.precio),
    descuentoHermano: Number(r.descuento),
    meses: [...r.meses].map(Number).sort((a, b) => a - b),
    desde: r.desde,
  }));
}

/** false si el colegio no tiene precio (no hay fila que actualizar). */
export async function guardarCobroColegio(
  client: PoolClient,
  colId: number,
  meses: number[],
  desde: Mes | null,
): Promise<boolean> {
  const { rowCount } = await client.query(
    `UPDATE public.colegio_precio
        SET colpre_meses_cobro = $2::smallint[], colpre_cobro_desde = $3::date,
            colpre_fecha_modificacion = now()
      WHERE col_id = $1`,
    [colId, meses, desde],
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Alumnos y lo que ya está pagado

export interface AlumnoConDisciplinas {
  nino_id: number;
  nombre: string;
  col_id: number;
  col_nombre: string;
  /** usu_id de sus representantes: arman las familias. */
  representantes: number[];
  representantes_nombres: string[];
  disciplinas: Array<{
    colacthor_id: number;
    actividad: string;
    horarios: HorarioDisciplina[];
    inicio: string;
    por_inscripcion: boolean;
  }>;
}

/**
 * Los alumnos activos con sus disciplinas activas. Para cada disciplina, la
 * fecha (Ecuador) de la inscripción aprobada que la trajo o, si se dio de
 * alta a mano, la del alta.
 */
export async function alumnosActivos(client?: PoolClient): Promise<AlumnoConDisciplinas[]> {
  const { rows } = await (client ?? getPool()).query<AlumnoConDisciplinas>(
    `SELECT n.nino_id, n.nino_nombre AS nombre, n.col_id, col.col_nombre,
            COALESCE((SELECT array_agg(DISTINCT p.usu_id)
                        FROM public.nino_padre np
                        JOIN public.padre p ON p.padre_id = np.padre_id
                       WHERE np.nino_id = n.nino_id AND p.usu_id IS NOT NULL), '{}') AS representantes,
            COALESCE((SELECT array_agg(DISTINCT u.usu_nombre)
                        FROM public.nino_padre np
                        JOIN public.padre p ON p.padre_id = np.padre_id
                        JOIN public.usuario u ON u.usu_id = p.usu_id
                       WHERE np.nino_id = n.nino_id), '{}') AS representantes_nombres,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'colacthor_id', d.colacthor_id,
                       'actividad', act.act_nombre,
                       'horarios', ${horariosJson('d')},
                       'inicio', ${textoEc('COALESCE(ins.ins_fecha, na.ninoasig_fecha_inscripcion)', 'YYYY-MM-DD')},
                       'por_inscripcion', ins.ins_id IS NOT NULL) ORDER BY act.act_nombre)
                FROM public.nino_asignacion na
                JOIN public.colegio_actividad_horario d ON d.colacthor_id = na.colacthor_id
                JOIN public.actividad act ON act.act_id = d.act_id
                LEFT JOIN public.inscripcion_nino insn ON insn.insnino_id = na.insnino_id
                LEFT JOIN public.inscripcion ins ON ins.ins_id = insn.ins_id AND ins.ins_estado = 'aprobada'
               WHERE na.nino_id = n.nino_id AND na.est_id = $1
            ), '[]'::json) AS disciplinas
       FROM public.nino n
       JOIN public.colegio col ON col.col_id = n.col_id
      WHERE n.est_id = $1
      ORDER BY n.nino_nombre`,
    [ESTADO.ACTIVO],
  );
  return rows;
}

/** Los niños de los que es representante esta cuenta. */
export async function hijosDe(usuId: number, client?: PoolClient): Promise<number[]> {
  const { rows } = await (client ?? getPool()).query<{ nino_id: number }>(
    `SELECT np.nino_id
       FROM public.padre p JOIN public.nino_padre np ON np.padre_id = p.padre_id
      WHERE p.usu_id = $1`,
    [usuId],
  );
  return rows.map((r) => r.nino_id);
}

/** Las cuotas en revisión o aprobadas de estos alumnos. */
export async function cuotasDe(ninoIds: number[], client?: PoolClient): Promise<CuotaRegistrada[]> {
  if (ninoIds.length === 0) return [];
  const { rows } = await (client ?? getPool()).query<{
    nino_id: number;
    mes: string;
    estado: 'pendiente' | 'aprobado';
    menpag_id: number;
    disciplinas: string[];
    subtotal: string;
    descuento: string;
    iva: string;
    total: string;
  }>(
    `SELECT c.nino_id, to_char(c.mencuo_mes, 'YYYY-MM-DD') AS mes, p.menpag_estado AS estado,
            c.menpag_id, c.mencuo_disciplinas AS disciplinas, c.mencuo_subtotal AS subtotal,
            c.mencuo_descuento AS descuento, c.mencuo_iva AS iva, c.mencuo_total AS total
       FROM public.mensualidad_cuota c
       JOIN public.mensualidad_pago p ON p.menpag_id = c.menpag_id
      WHERE c.nino_id = ANY($1::int[]) AND p.menpag_estado IN ('pendiente', 'aprobado')`,
    [ninoIds],
  );
  return rows.map((r) => ({
    ...r,
    subtotal: Number(r.subtotal),
    descuento: Number(r.descuento),
    iva: Number(r.iva),
    total: Number(r.total),
  }));
}

// ---------------------------------------------------------------------------
// Pagos

export interface CuotaDetalle {
  nino_id: number;
  nombre: string;
  col_id: number;
  col_nombre: string;
  mes: Mes;
  disciplinas: string[];
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
}

export async function crearPago(
  client: PoolClient,
  p: {
    usuId: number;
    comprobante: string;
    subtotal: number;
    iva: number;
    total: number;
    cuotas: CuotaDetalle[];
    ip: string | null;
    navegador: string | null;
  },
): Promise<number> {
  const { rows } = await client.query<{ menpag_id: number }>(
    `INSERT INTO public.mensualidad_pago
         (usu_id, menpag_comprobante, menpag_subtotal, menpag_iva, menpag_total, menpag_detalle, menpag_ip, menpag_navegador)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING menpag_id`,
    [p.usuId, p.comprobante, p.subtotal, p.iva, p.total, JSON.stringify(p.cuotas), p.ip, p.navegador],
  );
  const id = rows[0]!.menpag_id;
  for (const c of p.cuotas) {
    await client.query(
      `INSERT INTO public.mensualidad_cuota
           (menpag_id, nino_id, mencuo_nino_nombre, col_id, mencuo_mes, mencuo_disciplinas,
            mencuo_subtotal, mencuo_descuento, mencuo_iva, mencuo_total)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10)`,
      [id, c.nino_id, c.nombre, c.col_id, c.mes, c.disciplinas, c.subtotal, c.descuento, c.iva, c.total],
    );
  }
  return id;
}

export interface PagoFila {
  menpag_id: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fecha: string;
  usu_id: number | null;
  representante_nombre: string | null;
  representante_correo: string | null;
  representante_telefono: string | null;
  comprobante: string;
  subtotal: number;
  iva: number;
  total: number;
  detalle: CuotaDetalle[];
  motivo: string | null;
  revisado_por: string | null;
  fecha_revision: string | null;
}

const SELECT_PAGO = `
    SELECT p.menpag_id, p.menpag_estado AS estado, p.menpag_fecha AS fecha, p.usu_id,
           u.usu_nombre AS representante_nombre, u.usu_correo AS representante_correo,
           u.usu_telefono AS representante_telefono,
           p.menpag_comprobante AS comprobante,
           p.menpag_subtotal::float8 AS subtotal, p.menpag_iva::float8 AS iva, p.menpag_total::float8 AS total,
           p.menpag_detalle AS detalle, p.menpag_motivo AS motivo,
           r.usu_nombre AS revisado_por, p.menpag_fecha_revision AS fecha_revision
      FROM public.mensualidad_pago p
      LEFT JOIN public.usuario u ON u.usu_id = p.usu_id
      LEFT JOIN public.usuario r ON r.usu_id = p.menpag_revisado_por`;

export async function obtenerPago(id: number, client?: PoolClient): Promise<PagoFila | null> {
  const { rows } = await (client ?? getPool()).query<PagoFila>(
    `${SELECT_PAGO} WHERE p.menpag_id = $1${client ? ' FOR UPDATE OF p' : ''}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function pagosDe(usuId: number): Promise<PagoFila[]> {
  const { rows } = await getPool().query<PagoFila>(
    `${SELECT_PAGO} WHERE p.usu_id = $1 ORDER BY p.menpag_fecha DESC`,
    [usuId],
  );
  return rows;
}

/** Personal: en revisión o aprobados. Los rechazados no salen (cliente, 2026-10-30). */
export async function listarPagos(q: ListarPagosQuery): Promise<{ items: PagoFila[]; total: number }> {
  const filtros: string[] = [`p.menpag_estado = ANY($1::text[])`];
  const params: unknown[] = [q.estado ? [q.estado] : ['pendiente', 'aprobado']];
  if (q.colegio) {
    params.push(q.colegio);
    filtros.push(`EXISTS (SELECT 1 FROM public.mensualidad_cuota c WHERE c.menpag_id = p.menpag_id AND c.col_id = $${params.length})`);
  }
  if (q.buscar) {
    params.push(q.buscar);
    const n = `$${params.length}`;
    filtros.push(`(${contieneSinTildes('u.usu_nombre', n)} OR ${contieneSinTildes('u.usu_correo', n)}
                   OR EXISTS (SELECT 1 FROM public.mensualidad_cuota c
                               WHERE c.menpag_id = p.menpag_id AND ${contieneSinTildes('c.mencuo_nino_nombre', n)}))`);
  }
  const donde = `WHERE ${filtros.join(' AND ')}`;
  const pool = getPool();
  const [lista, cuenta] = await Promise.all([
    pool.query<PagoFila>(
      `${SELECT_PAGO} ${donde} ORDER BY p.menpag_fecha DESC LIMIT ${q.limit} OFFSET ${offsetDe(q)}`,
      params,
    ),
    pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM public.mensualidad_pago p
         LEFT JOIN public.usuario u ON u.usu_id = p.usu_id ${donde}`,
      params,
    ),
  ]);
  return { items: lista.rows, total: cuenta.rows[0]?.total ?? 0 };
}

export async function contarPendientes(): Promise<number> {
  const { rows } = await getPool().query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.mensualidad_pago WHERE menpag_estado = 'pendiente'`,
  );
  return rows[0]?.n ?? 0;
}

export async function aprobarPago(client: PoolClient, id: number, revisor: number): Promise<void> {
  await client.query(
    `UPDATE public.mensualidad_pago
        SET menpag_estado = 'aprobado', menpag_revisado_por = $2, menpag_fecha_revision = now()
      WHERE menpag_id = $1`,
    [id, revisor],
  );
}

/** El pago queda con su motivo para el representante; sus meses vuelven a deberse. */
export async function rechazarPago(client: PoolClient, id: number, revisor: number, motivo: string): Promise<void> {
  await client.query(`DELETE FROM public.mensualidad_cuota WHERE menpag_id = $1`, [id]);
  await client.query(
    `UPDATE public.mensualidad_pago
        SET menpag_estado = 'rechazado', menpag_motivo = $3, menpag_revisado_por = $2, menpag_fecha_revision = now()
      WHERE menpag_id = $1`,
    [id, revisor, motivo],
  );
}

export async function borrarPago(client: PoolClient, id: number): Promise<void> {
  await client.query(`DELETE FROM public.mensualidad_pago WHERE menpag_id = $1`, [id]);
}

// ---------------------------------------------------------------------------
// Reportes

export interface CuotaDelReporte extends CuotaDetalle {
  estado: 'pendiente' | 'aprobado';
  fecha_pago: string;
  representante: string | null;
}

/** Cuotas de un rango de meses, en revisión o aprobadas. */
export async function cuotasEntre(desde: Mes, hasta: Mes, colIds: number[] | null): Promise<CuotaDelReporte[]> {
  const { rows } = await getPool().query<CuotaDelReporte>(
    `SELECT c.nino_id, c.mencuo_nino_nombre AS nombre, c.col_id, COALESCE(col.col_nombre, '—') AS col_nombre,
            to_char(c.mencuo_mes, 'YYYY-MM-DD') AS mes, c.mencuo_disciplinas AS disciplinas,
            c.mencuo_subtotal::float8 AS subtotal, c.mencuo_descuento::float8 AS descuento,
            c.mencuo_iva::float8 AS iva, c.mencuo_total::float8 AS total,
            p.menpag_estado AS estado, p.menpag_fecha AS fecha_pago, u.usu_nombre AS representante
       FROM public.mensualidad_cuota c
       JOIN public.mensualidad_pago p ON p.menpag_id = c.menpag_id
       LEFT JOIN public.colegio col ON col.col_id = c.col_id
       LEFT JOIN public.usuario u ON u.usu_id = p.usu_id
      WHERE c.mencuo_mes BETWEEN $1::date AND $2::date
        AND p.menpag_estado IN ('pendiente', 'aprobado')
        AND ($3::int[] IS NULL OR c.col_id = ANY($3::int[]))
      ORDER BY c.mencuo_mes, col.col_nombre, c.mencuo_nino_nombre`,
    [desde, hasta, colIds],
  );
  return rows;
}
