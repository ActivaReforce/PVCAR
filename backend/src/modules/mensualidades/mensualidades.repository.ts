import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import { ESTADO } from '../../lib/constants.js';
import { diaEc, textoEc } from '../../lib/fecha.js';
import { horariosJson, type HorarioDisciplina } from '../../lib/horarios.js';
import { contieneSinTildes } from '../../lib/sql.js';
import { offsetDe } from '../../lib/paginacion.js';
import { PRIMER_MES, type ColegioCobro, type CuotaRegistrada, type Mes } from './mensualidades.calculo.js';
import type { ListarPagosQuery } from './mensualidades.schemas.js';

/** Acceso a datos de Mensualidades (migración 0041). */

// ---------------------------------------------------------------------------
// Configuración

/** Lo general: el recordatorio y la cuenta a la que se transfiere. Los días son de cada colegio (0042). */
export interface ConfigMensualidades {
  recordatorio: boolean;
  cuenta_bancaria: string | null;
}

export async function obtenerConfig(client?: PoolClient): Promise<ConfigMensualidades> {
  const { rows } = await (client ?? getPool()).query<ConfigMensualidades>(
    `SELECT inscfg_mens_recordatorio AS recordatorio, inscfg_cuenta_bancaria AS cuenta_bancaria
       FROM public.inscripcion_config WHERE inscfg_id = 1`,
  );
  const r = rows[0];
  if (!r) throw new Error('Falta la fila de inscripcion_config (migración 0016)');
  return r;
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
    meses: string[];
    dia_limite: number;
  }>(
    `SELECT cp.col_id, c.col_nombre, cp.colpre_mens_dia_limite AS dia_limite,
            cp.colpre_precio_disciplina AS precio, cp.colpre_descuento_hermano AS descuento,
            ARRAY(SELECT to_char(m, 'YYYY-MM-DD') FROM unnest(cp.colpre_meses) AS m ORDER BY m) AS meses
       FROM public.colegio_precio cp
       JOIN public.colegio c ON c.col_id = cp.col_id
      ORDER BY c.col_nombre`,
  );
  return rows.map((r) => ({
    col_id: r.col_id,
    col_nombre: r.col_nombre,
    precio: Number(r.precio),
    descuentoHermano: Number(r.descuento),
    meses: r.meses,
    diaLimite: r.dia_limite,
  }));
}

export interface CobroDelColegio {
  /** Meses con año ('YYYY-MM-01'), ordenados. */
  meses: Mes[];
  dia_limite: number;
}

/** false si el colegio no tiene precio (no hay fila que actualizar). */
export async function guardarCobroColegio(client: PoolClient, colId: number, c: CobroDelColegio): Promise<boolean> {
  const { rowCount } = await client.query(
    `UPDATE public.colegio_precio
        SET colpre_meses = $2::date[], colpre_mens_dia_limite = $3,
            colpre_fecha_modificacion = now()
      WHERE col_id = $1`,
    [colId, c.meses, c.dia_limite],
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Alumnos y lo que ya está pagado

export interface Contacto {
  nombre: string;
  telefono: string | null;
  correo: string | null;
}

export interface AlumnoConDisciplinas {
  nino_id: number;
  nombre: string;
  col_id: number;
  col_nombre: string;
  /** usu_id de sus representantes: arman las familias. */
  representantes: number[];
  representantes_nombres: string[];
  /** Para contactar a la familia desde Estado del mes (2026-11-16). */
  contactos: Contacto[];
  disciplinas: Array<{
    colacthor_id: number;
    actividad: string;
    horarios: HorarioDisciplina[];
    inicio: string;
    por_inscripcion: boolean;
    /** Día (Ecuador) en que se envió la inscripción que la trajo. */
    pagado_el: string | null;
  }>;
}

/**
 * Los alumnos activos con sus disciplinas activas. Para cada disciplina, el
 * mes que pagó la inscripción aprobada que la trajo o, si se dio de alta a
 * mano, el mes (Ecuador) del alta.
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
            COALESCE((SELECT json_agg(DISTINCT jsonb_build_object(
                                'nombre', u.usu_nombre, 'telefono', u.usu_telefono, 'correo', u.usu_correo))
                        FROM public.nino_padre np
                        JOIN public.padre p ON p.padre_id = np.padre_id
                        JOIN public.usuario u ON u.usu_id = p.usu_id
                       WHERE np.nino_id = n.nino_id), '[]'::json) AS contactos,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'colacthor_id', d.colacthor_id,
                       'actividad', act.act_nombre,
                       'horarios', ${horariosJson('d')},
                       'inicio', CASE WHEN ins.ins_id IS NOT NULL
                                      THEN to_char(ins.ins_mes_inicio, 'YYYY-MM-DD')
                                      ELSE ${textoEc('na.ninoasig_fecha_inscripcion', 'YYYY-MM')} || '-01' END,
                       'por_inscripcion', ins.ins_id IS NOT NULL,
                       'pagado_el', ${textoEc('ins.ins_fecha', 'YYYY-MM-DD')}) ORDER BY act.act_nombre)
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
    fecha_pago: string;
    disciplinas: string[];
    subtotal: string;
    descuento: string;
    iva: string;
    total: string;
  }>(
    `SELECT c.nino_id, to_char(c.mencuo_mes, 'YYYY-MM-DD') AS mes, p.menpag_estado AS estado,
            c.menpag_id, ${textoEc('p.menpag_fecha', 'YYYY-MM-DD')} AS fecha_pago, c.mencuo_disciplinas AS disciplinas, c.mencuo_subtotal AS subtotal,
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

/** Rechazar: el pago se borra con sus meses (ON DELETE CASCADE). */
export async function borrarPago(client: PoolClient, id: number): Promise<void> {
  await client.query(`DELETE FROM public.mensualidad_pago WHERE menpag_id = $1`, [id]);
}

// ---------------------------------------------------------------------------
// Lo que entró en un mes (por fecha de pago)

export interface CuotaCobrada {
  /** Una mensualidad o el pago de una inscripción (su primer mes). */
  tipo: 'mensualidad' | 'inscripcion';
  /** El pago de mensualidad; null en una inscripción. */
  menpag_id: number | null;
  nino_id: number | null;
  nombre: string;
  col_id: number | null;
  /** El mes que paga. */
  mes: Mes;
  total: number;
  estado: 'pendiente' | 'aprobado';
  /** Día (Ecuador) en que se envió el pago. */
  fecha_pago: string;
}

/**
 * Las cuotas cuyo pago se envió en `mes` (hora de Ecuador), en revisión o
 * aprobadas, sea cual sea el mes que pagan: es lo que entró ese mes.
 */
export async function cobradoEn(mes: Mes): Promise<CuotaCobrada[]> {
  const { rows } = await getPool().query<CuotaCobrada>(
    `SELECT 'mensualidad' AS tipo, c.menpag_id, c.nino_id, c.mencuo_nino_nombre AS nombre, c.col_id,
            to_char(c.mencuo_mes, 'YYYY-MM-DD') AS mes, c.mencuo_total::float8 AS total,
            p.menpag_estado AS estado, ${textoEc('p.menpag_fecha', 'YYYY-MM-DD')} AS fecha_pago
       FROM public.mensualidad_cuota c
       JOIN public.mensualidad_pago p ON p.menpag_id = c.menpag_id
      WHERE p.menpag_estado IN ('pendiente', 'aprobado')
        AND date_trunc('month', ${diaEc('p.menpag_fecha')})::date = $1::date`,
    [mes],
  );
  return rows;
}

/**
 * Lo que entró por inscripciones en `mes`, hijo por hijo: aprobadas
 * (recaudado) y pendientes (en revisión). Cuenta en el mes en que se envió;
 * lo de antes de noviembre de 2026, en noviembre (PRIMER_MES).
 *
 * El valor de cada hijo es el suyo con IVA (`insnino_precio.total_con_iva`) y
 * el redondeo de la inscripción va al primero: la suma da exactamente
 * `ins_total`, lo mismo que el Total recaudado del reporte de Inscripciones.
 * Su colegio sale de sus disciplinas, como en ese reporte.
 */
export async function inscripcionesCobradasEn(mes: Mes): Promise<CuotaCobrada[]> {
  const { rows } = await getPool().query<CuotaCobrada>(
    `WITH hijos AS (
       SELECT inn.ins_id, inn.insnino_orden, inn.nino_id,
              COALESCE(inn.insnino_datos->>'nombre', 'Alumno') AS nombre,
              (SELECT cah.col_id FROM unnest(inn.insnino_disciplinas) AS cid
                 JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = cid
                LIMIT 1) AS col_id,
              COALESCE((inn.insnino_precio->>'total_con_iva')::numeric, 0) AS valor,
              i.ins_total, i.ins_estado, i.ins_fecha, i.ins_mes_inicio
         FROM public.inscripcion_nino inn
         JOIN public.inscripcion i ON i.ins_id = inn.ins_id
        WHERE GREATEST(date_trunc('month', ${diaEc('i.ins_fecha')})::date, $2::date) = $1::date
     )
     SELECT 'inscripcion' AS tipo, NULL::int AS menpag_id, nino_id, nombre, col_id,
            to_char(ins_mes_inicio, 'YYYY-MM-DD') AS mes,
            (valor + CASE WHEN insnino_orden = min(insnino_orden) OVER (PARTITION BY ins_id)
                          THEN COALESCE(ins_total, 0) - sum(valor) OVER (PARTITION BY ins_id) ELSE 0 END)::float8 AS total,
            CASE ins_estado WHEN 'aprobada' THEN 'aprobado' ELSE 'pendiente' END AS estado,
            ${textoEc('ins_fecha', 'YYYY-MM-DD')} AS fecha_pago
       FROM hijos`,
    [mes, PRIMER_MES],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Reportes → Pagos → Mensualidades

export interface RegistroDePago {
  tipo: 'mensualidad' | 'inscripcion';
  nino_id: number | null;
  nombre: string;
  col_id: number | null;
  col_nombre: string;
  /** El mes que paga ('YYYY-MM-01'). */
  mes: Mes;
  /** Lo que vale ese mes para ese alumno (con IVA). */
  total: number;
  estado: 'pendiente' | 'aprobado';
  /** Día (Ecuador) del envío, 'YYYY-MM-DD'. */
  fecha_pago: string;
  /** Mes (día 1) en que cuenta el dinero: el del envío; lo de antes de noviembre de 2026, noviembre. */
  mes_pago: Mes;
  disciplinas: string[];
}

/**
 * Todo lo pagado o en revisión, mes por mes y alumno por alumno: las cuotas
 * de mensualidad y, de cada inscripción, la parte de cada hijo (su valor con
 * IVA, con el redondeo al primero para que sume `ins_total`) en el mes que
 * paga.
 */
export async function registrosDePago(): Promise<RegistroDePago[]> {
  const { rows } = await getPool().query<RegistroDePago>(
    `SELECT 'mensualidad' AS tipo, c.nino_id, c.mencuo_nino_nombre AS nombre, c.col_id,
            COALESCE(col.col_nombre, '—') AS col_nombre,
            to_char(c.mencuo_mes, 'YYYY-MM-DD') AS mes, c.mencuo_total::float8 AS total,
            p.menpag_estado AS estado, ${textoEc('p.menpag_fecha', 'YYYY-MM-DD')} AS fecha_pago,
            to_char(date_trunc('month', ${diaEc('p.menpag_fecha')}), 'YYYY-MM-DD') AS mes_pago,
            c.mencuo_disciplinas AS disciplinas
       FROM public.mensualidad_cuota c
       JOIN public.mensualidad_pago p ON p.menpag_id = c.menpag_id
       LEFT JOIN public.colegio col ON col.col_id = c.col_id
      WHERE p.menpag_estado IN ('pendiente', 'aprobado')
     UNION ALL
     SELECT 'inscripcion', h.nino_id, h.nombre, h.col_id, COALESCE(col.col_nombre, '—'),
            to_char(h.ins_mes_inicio, 'YYYY-MM-DD'),
            (h.valor + CASE WHEN h.insnino_orden = min(h.insnino_orden) OVER (PARTITION BY h.ins_id)
                            THEN COALESCE(h.ins_total, 0) - sum(h.valor) OVER (PARTITION BY h.ins_id) ELSE 0 END)::float8,
            CASE h.ins_estado WHEN 'aprobada' THEN 'aprobado' ELSE 'pendiente' END,
            ${textoEc('h.ins_fecha', 'YYYY-MM-DD')},
            to_char(GREATEST(date_trunc('month', ${diaEc('h.ins_fecha')})::date, $1::date), 'YYYY-MM-DD'),
            h.disciplinas
       FROM (
         SELECT inn.ins_id, inn.insnino_orden, inn.nino_id,
                COALESCE(inn.insnino_datos->>'nombre', 'Alumno') AS nombre,
                (SELECT cah.col_id FROM unnest(inn.insnino_disciplinas) AS cid
                   JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = cid LIMIT 1) AS col_id,
                ARRAY(SELECT a.act_nombre FROM unnest(inn.insnino_disciplinas) AS cid
                        JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = cid
                        JOIN public.actividad a ON a.act_id = cah.act_id ORDER BY a.act_nombre) AS disciplinas,
                COALESCE((inn.insnino_precio->>'total_con_iva')::numeric, 0) AS valor,
                i.ins_total, i.ins_estado, i.ins_fecha, i.ins_mes_inicio
           FROM public.inscripcion_nino inn
           JOIN public.inscripcion i ON i.ins_id = inn.ins_id
       ) h
       LEFT JOIN public.colegio col ON col.col_id = h.col_id`,
    [PRIMER_MES],
  );
  return rows;
}

/** Curso y paralelo actuales de cada alumno (Reportes → Mensualidades). */
export async function cursosDeAlumnos(
  ninoIds: number[],
): Promise<Map<number, { curso: string | null; paralelo: string | null }>> {
  if (ninoIds.length === 0) return new Map();
  const { rows } = await getPool().query<{ nino_id: number; curso: string | null; paralelo: string | null }>(
    `SELECT n.nino_id, g.catninograd_nombre AS curso, n.nino_paralelo AS paralelo
       FROM public.nino n
       LEFT JOIN public.categoria_nino_grado g ON g.catninograd_id = n.catninograd_id
      WHERE n.nino_id = ANY($1::int[])`,
    [ninoIds],
  );
  return new Map(rows.map((r) => [r.nino_id, { curso: r.curso, paralelo: r.paralelo }]));
}
