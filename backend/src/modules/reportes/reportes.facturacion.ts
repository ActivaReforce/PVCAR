import { getPool } from '../../config/db.js';
import { diaEc, hoyEc, textoEc } from '../../lib/fecha.js';
import { mesDe, nombreDeMes, PRIMER_MES } from '../mensualidades/mensualidades.calculo.js';
import { deudas } from '../mensualidades/mensualidades.service.js';
import {
  ESTADOS_DEL_FILTRO,
  ETIQUETA_REGISTRO,
  FECHA_ANULADA,
  FILTRO_ANULADA,
  FILTRO_INSCRIPCION,
  HIJO_ANULADO_EN_COLEGIO,
  HIJO_EN_COLEGIO,
  HIJOS_ANULADA,
  NOMBRES_MES,
  diaLegible,
  mesesDeTodo,
  paramsInscripcion,
  plano,
  type FiltrosReporte,
} from './reportes.definiciones.js';

/**
 * "Sacar datos para facturación" (cliente, 2026-11-18): un Excel por cada
 * reporte de Pagos con lo que necesita quien emite las facturas, con los
 * mismos filtros que la exportación normal.
 *
 * Decisiones del cliente:
 *   - Mensualidades: **una fila por pago** (una transferencia = una factura),
 *     aunque cubra varios hijos y meses. Lo que aún se debe sale al final, una
 *     fila por representante y mes, en rojo.
 *   - Lo pagado con la inscripción sale en Mensualidades en amarillo y **sí
 *     suma** al total a facturar: la inscripción es el pago del primer mes, y
 *     pueden facturarlo todo desde aquí.
 *   - Montos: subtotal, descuento, IVA y total.
 *   - Inscripciones: las anuladas salen en rojo, sin datos de factura (no se
 *     guardaron al anular) y sin sumar.
 *
 * Los datos de factura son los que el representante escribió en el
 * formulario. En una inscripción, los de esa inscripción; en un pago de
 * mensualidad o una deuda, los que tiene hoy su ficha (los deja la última
 * inscripción aprobada y se pueden corregir en Representantes).
 */

export type Color = 'rojo' | 'amarillo' | null;

export interface ColumnaFactura {
  clave: string;
  cabecera: string;
  ancho: number;
  /** Bloque de color de la columna. */
  grupo: 'pago' | 'montos' | 'factura';
  moneda?: boolean;
}

export interface FilaFactura extends Record<string, unknown> {
  _color: Color;
  /** Cuenta para "a facturar". */
  _factura: boolean;
}

const factura: ColumnaFactura[] = [
  { clave: 'factura_nombre', cabecera: 'Factura: nombres y apellidos', ancho: 32, grupo: 'factura' },
  { clave: 'factura_identificacion', cabecera: 'Factura: cédula o RUC', ancho: 16, grupo: 'factura' },
  { clave: 'factura_correo', cabecera: 'Factura: correo', ancho: 30, grupo: 'factura' },
  { clave: 'factura_direccion', cabecera: 'Factura: dirección', ancho: 40, grupo: 'factura' },
];

const montos: ColumnaFactura[] = [
  { clave: 'subtotal', cabecera: 'Subtotal ($)', ancho: 12, grupo: 'montos', moneda: true },
  { clave: 'descuento', cabecera: 'Descuento ($)', ancho: 12, grupo: 'montos', moneda: true },
  { clave: 'iva', cabecera: 'IVA ($)', ancho: 10, grupo: 'montos', moneda: true },
  { clave: 'total', cabecera: 'Total ($)', ancho: 12, grupo: 'montos', moneda: true },
];

const persona: ColumnaFactura[] = [
  { clave: 'representante', cabecera: 'Representante', ancho: 30, grupo: 'pago' },
  { clave: 'cedula', cabecera: 'Cédula', ancho: 14, grupo: 'pago' },
  { clave: 'correo', cabecera: 'Correo', ancho: 30, grupo: 'pago' },
  { clave: 'telefono', cabecera: 'Teléfono', ancho: 14, grupo: 'pago' },
  { clave: 'hijos', cabecera: 'Hijos', ancho: 36, grupo: 'pago' },
  { clave: 'colegios', cabecera: 'Colegios', ancho: 26, grupo: 'pago' },
  { clave: 'disciplinas', cabecera: 'Disciplinas', ancho: 30, grupo: 'pago' },
];

export const COLUMNAS_FACTURA: Record<string, ColumnaFactura[]> = {
  inscripciones: [
    { clave: 'estado', cabecera: 'Estado', ancho: 12, grupo: 'pago' },
    { clave: 'fecha_pago', cabecera: 'Fecha de pago', ancho: 13, grupo: 'pago' },
    ...persona,
    ...montos,
    ...factura,
  ],
  mensualidades: [
    { clave: 'estado', cabecera: 'Estado', ancho: 22, grupo: 'pago' },
    { clave: 'ano', cabecera: 'Año', ancho: 8, grupo: 'pago' },
    { clave: 'mes', cabecera: 'Mes', ancho: 22, grupo: 'pago' },
    { clave: 'fecha_pago', cabecera: 'Fecha de pago', ancho: 13, grupo: 'pago' },
    { clave: 'mes_pago', cabecera: 'Mes de pago', ancho: 15, grupo: 'pago' },
    ...persona,
    ...montos,
    { clave: 'recaudado', cabecera: 'Recaudado en el periodo ($)', ancho: 16, grupo: 'montos', moneda: true },
    ...factura,
  ],
};

const lista = (xs: Array<string | null | undefined>) =>
  [...new Set(xs.filter((x): x is string => Boolean(x && x.trim())))].join(', ');
const dinero = (n: unknown) => Math.round(Number(n ?? 0) * 100) / 100;

// ---------------------------------------------------------------------------
// Inscripciones

/** Lo pagado de cada inscripción; con filtro de colegio, solo los hijos de ese colegio. */
const SUMA = (campo: string) => `COALESCE((
    SELECT SUM((inn.insnino_precio->>'${campo}')::numeric)
      FROM public.inscripcion_nino inn
     WHERE inn.ins_id = i.ins_id AND ($5::int[] IS NULL OR ${HIJO_EN_COLEGIO})
  ), 0)::float8`;

const SQL_FACTURA_INSCRIPCIONES = `
  SELECT CASE i.ins_estado WHEN 'aprobada' THEN 'Aprobada' ELSE 'Pendiente' END AS estado,
         ${textoEc('i.ins_fecha', 'DD/MM/YYYY')}                    AS fecha_pago,
         COALESCE(i.ins_representante->>'nombre', '')               AS representante,
         COALESCE(i.ins_representante->>'cedula', '')               AS cedula,
         COALESCE(i.ins_representante->>'correo', '')               AS correo,
         COALESCE(i.ins_representante->>'telefono', '')             AS telefono,
         COALESCE((SELECT string_agg(inn.insnino_datos->>'nombre', ', ' ORDER BY inn.insnino_orden)
                     FROM public.inscripcion_nino inn WHERE inn.ins_id = i.ins_id), '') AS hijos,
         COALESCE((SELECT string_agg(DISTINCT c.col_nombre, ', ' ORDER BY c.col_nombre)
                     FROM public.inscripcion_nino inn
                     CROSS JOIN LATERAL unnest(inn.insnino_disciplinas) AS cid
                     JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = cid
                     JOIN public.colegio c ON c.col_id = cah.col_id
                    WHERE inn.ins_id = i.ins_id), '')                AS colegios,
         COALESCE((SELECT string_agg(DISTINCT a.act_nombre, ', ' ORDER BY a.act_nombre)
                     FROM public.inscripcion_nino inn
                     CROSS JOIN LATERAL unnest(inn.insnino_disciplinas) AS cid
                     JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = cid
                     JOIN public.actividad a ON a.act_id = cah.act_id
                    WHERE inn.ins_id = i.ins_id), '')                AS disciplinas,
         ${SUMA('subtotal')}                                         AS subtotal,
         ${SUMA('descuento')}                                        AS descuento,
         ${SUMA('iva')}                                              AS iva,
         (CASE WHEN $5::int[] IS NULL THEN COALESCE(i.ins_total, 0)::float8 ELSE ${SUMA('total_con_iva')} END) AS total,
         COALESCE(i.ins_representante->'factura'->>'nombre', '')         AS factura_nombre,
         COALESCE(i.ins_representante->'factura'->>'identificacion', '') AS factura_identificacion,
         COALESCE(i.ins_representante->'factura'->>'correo', '')         AS factura_correo,
         COALESCE(i.ins_representante->'factura'->>'direccion', '')      AS factura_direccion,
         i.ins_fecha                                                 AS _orden
    FROM public.inscripcion i
   WHERE ${FILTRO_INSCRIPCION}
  UNION ALL
  SELECT 'Anulada',
         ${textoEc(FECHA_ANULADA, 'DD/MM/YYYY')},
         COALESCE(a.aud_detalle->'representante'->>'nombre', ''),
         COALESCE(a.aud_detalle->'representante'->>'cedula', ''),
         COALESCE(a.aud_detalle->'representante'->>'correo', ''),
         COALESCE(a.aud_detalle->'representante'->>'telefono', ''),
         COALESCE((SELECT string_agg(h->>'nombre', ', ') FROM ${HIJOS_ANULADA} h), ''),
         COALESCE((SELECT string_agg(DISTINCT h->>'colegio', ', ' ORDER BY h->>'colegio')
                     FROM ${HIJOS_ANULADA} h
                    WHERE h->>'colegio' IS NOT NULL AND ${HIJO_ANULADO_EN_COLEGIO}), ''),
         COALESCE((SELECT string_agg(DISTINCT d, ', ' ORDER BY d)
                     FROM ${HIJOS_ANULADA} h
                     CROSS JOIN LATERAL jsonb_array_elements_text(h->'disciplinas') AS d), ''),
         NULL::float8, NULL::float8, NULL::float8,
         (CASE WHEN $5::int[] IS NULL THEN COALESCE((a.aud_detalle->>'valor')::numeric, 0)
               ELSE COALESCE((SELECT SUM((h->>'valor')::numeric) FROM ${HIJOS_ANULADA} h
                               WHERE ${HIJO_ANULADO_EN_COLEGIO}), 0)
          END)::float8,
         '', '', '', '',
         ${FECHA_ANULADA}
    FROM public.auditoria a
   WHERE ${FILTRO_ANULADA}
   ORDER BY _orden DESC`;

export async function filasInscripciones(f: FiltrosReporte, tope: number): Promise<FilaFactura[]> {
  const params = paramsInscripcion(f);
  const { rows } = await getPool().query<Record<string, unknown>>(
    `SELECT * FROM (${SQL_FACTURA_INSCRIPCIONES}) r LIMIT $${params.length + 1}`,
    [...params, tope],
  );
  return rows.map((r) => ({
    ...r,
    subtotal: r.subtotal === null ? '' : dinero(r.subtotal),
    descuento: r.descuento === null ? '' : dinero(r.descuento),
    iva: r.iva === null ? '' : dinero(r.iva),
    total: dinero(r.total),
    _color: r.estado === 'Aprobada' ? null : 'rojo',
    _factura: r.estado === 'Aprobada',
  }));
}

// ---------------------------------------------------------------------------
// Mensualidades

interface PagoAgrupado {
  tipo: 'mensualidad' | 'inscripcion';
  aprobado: boolean;
  fecha_pago: string;
  mes_pago: string;
  meses: string[];
  usu_id: number | null;
  representante: string;
  cedula: string;
  correo: string;
  telefono: string;
  hijos: string[];
  colegios: string[];
  disciplinas: string[];
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  factura_nombre: string | null;
  factura_identificacion: string | null;
  factura_correo: string | null;
  factura_direccion: string | null;
}

/**
 * Los pagos: cada transferencia de mensualidad (no rechazada) con sus cuotas,
 * y cada inscripción con el mes que paga. Con filtro de colegio, solo las
 * cuotas y los hijos de esos colegios.
 */
async function pagos(colegios: number[] | null): Promise<PagoAgrupado[]> {
  const { rows } = await getPool().query<PagoAgrupado>(
    `SELECT 'mensualidad' AS tipo,
            p.menpag_estado = 'aprobado' AS aprobado,
            ${textoEc('p.menpag_fecha', 'YYYY-MM-DD')} AS fecha_pago,
            to_char(date_trunc('month', ${diaEc('p.menpag_fecha')}), 'YYYY-MM-DD') AS mes_pago,
            ARRAY(SELECT DISTINCT to_char(c2.mencuo_mes, 'YYYY-MM-DD') FROM public.mensualidad_cuota c2
                   WHERE c2.menpag_id = p.menpag_id AND ($1::int[] IS NULL OR c2.col_id = ANY($1::int[]))
                   ORDER BY 1) AS meses,
            u.usu_id,
            COALESCE(u.usu_nombre, '') AS representante,
            COALESCE(u.usu_cedula, '') AS cedula,
            COALESCE(u.usu_correo, '') AS correo,
            COALESCE(u.usu_telefono, '') AS telefono,
            array_agg(DISTINCT c.mencuo_nino_nombre) AS hijos,
            array_agg(DISTINCT col.col_nombre) FILTER (WHERE col.col_nombre IS NOT NULL) AS colegios,
            ARRAY(SELECT DISTINCT d FROM public.mensualidad_cuota c3
                    CROSS JOIN LATERAL unnest(c3.mencuo_disciplinas) AS d
                   WHERE c3.menpag_id = p.menpag_id AND ($1::int[] IS NULL OR c3.col_id = ANY($1::int[]))) AS disciplinas,
            SUM(c.mencuo_subtotal)::float8 AS subtotal,
            SUM(c.mencuo_descuento)::float8 AS descuento,
            SUM(c.mencuo_iva)::float8 AS iva,
            SUM(c.mencuo_total)::float8 AS total,
            pa.padre_factura_nombre AS factura_nombre,
            pa.padre_factura_identificacion AS factura_identificacion,
            pa.padre_factura_correo AS factura_correo,
            pa.padre_factura_direccion AS factura_direccion
       FROM public.mensualidad_pago p
       JOIN public.mensualidad_cuota c ON c.menpag_id = p.menpag_id
       LEFT JOIN public.colegio col ON col.col_id = c.col_id
       LEFT JOIN public.usuario u ON u.usu_id = p.usu_id
       LEFT JOIN public.padre pa ON pa.usu_id = p.usu_id
      WHERE p.menpag_estado IN ('pendiente', 'aprobado')
        AND ($1::int[] IS NULL OR c.col_id = ANY($1::int[]))
      GROUP BY p.menpag_id, u.usu_id, pa.padre_id
     UNION ALL
     SELECT 'inscripcion',
            i.ins_estado = 'aprobada',
            ${textoEc('i.ins_fecha', 'YYYY-MM-DD')},
            to_char(GREATEST(date_trunc('month', ${diaEc('i.ins_fecha')})::date, $2::date), 'YYYY-MM-DD'),
            ARRAY[to_char(i.ins_mes_inicio, 'YYYY-MM-DD')],
            i.usu_id,
            COALESCE(i.ins_representante->>'nombre', ''),
            COALESCE(i.ins_representante->>'cedula', ''),
            COALESCE(i.ins_representante->>'correo', ''),
            COALESCE(i.ins_representante->>'telefono', ''),
            array_agg(DISTINCT h.nombre),
            array_agg(DISTINCT h.colegio) FILTER (WHERE h.colegio IS NOT NULL),
            ARRAY(SELECT DISTINCT a.act_nombre FROM public.inscripcion_nino inn
                    CROSS JOIN LATERAL unnest(inn.insnino_disciplinas) AS cid
                    JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = cid
                    JOIN public.actividad a ON a.act_id = cah.act_id
                   WHERE inn.ins_id = i.ins_id AND ($1::int[] IS NULL OR cah.col_id = ANY($1::int[]))),
            SUM(h.subtotal)::float8,
            SUM(h.descuento)::float8,
            SUM(h.iva)::float8,
            (CASE WHEN $1::int[] IS NULL THEN COALESCE(i.ins_total, 0) ELSE SUM(h.total) END)::float8,
            i.ins_representante->'factura'->>'nombre',
            i.ins_representante->'factura'->>'identificacion',
            i.ins_representante->'factura'->>'correo',
            i.ins_representante->'factura'->>'direccion'
       FROM public.inscripcion i
       JOIN LATERAL (
         SELECT COALESCE(inn.insnino_datos->>'nombre', 'Alumno') AS nombre,
                (SELECT c.col_nombre FROM unnest(inn.insnino_disciplinas) AS cid
                   JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = cid
                   JOIN public.colegio c ON c.col_id = cah.col_id LIMIT 1) AS colegio,
                (SELECT cah.col_id FROM unnest(inn.insnino_disciplinas) AS cid
                   JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = cid LIMIT 1) AS col_id,
                COALESCE((inn.insnino_precio->>'subtotal')::numeric, 0) AS subtotal,
                COALESCE((inn.insnino_precio->>'descuento')::numeric, 0) AS descuento,
                COALESCE((inn.insnino_precio->>'iva')::numeric, 0) AS iva,
                COALESCE((inn.insnino_precio->>'total_con_iva')::numeric, 0) AS total
           FROM public.inscripcion_nino inn
          WHERE inn.ins_id = i.ins_id
       ) h ON ($1::int[] IS NULL OR h.col_id = ANY($1::int[]))
      GROUP BY i.ins_id`,
    [colegios, PRIMER_MES],
  );
  return rows;
}

/** Datos de factura de la ficha de cada representante (para lo que se debe). */
async function facturasDe(usuIds: number[]): Promise<Map<number, Record<string, string>>> {
  if (usuIds.length === 0) return new Map();
  const { rows } = await getPool().query<Record<string, string> & { usu_id: number }>(
    `SELECT usu_id,
            COALESCE(padre_factura_nombre, '') AS factura_nombre,
            COALESCE(padre_factura_identificacion, '') AS factura_identificacion,
            COALESCE(padre_factura_correo, '') AS factura_correo,
            COALESCE(padre_factura_direccion, '') AS factura_direccion
       FROM public.padre WHERE usu_id = ANY($1::int[])`,
    [usuIds],
  );
  return new Map(rows.map(({ usu_id, ...resto }) => [usu_id, resto]));
}

const anosDe = (meses: string[]) => [...new Set(meses.map((m) => m.slice(0, 4)))].join(', ');
const nombresDe = (meses: string[]) =>
  [...new Set(meses.map((m) => NOMBRES_MES[Number(m.slice(5, 7)) - 1]))].join(', ');

export async function filasMensualidades(f: FiltrosReporte, tope: number): Promise<FilaFactura[]> {
  const explicitos = Boolean(f.meses && f.meses.length > 0);
  const elegidos = new Set(explicitos ? f.meses : mesesDeTodo());
  const colegios = f.colegio && f.colegio.length > 0 ? f.colegio : null;
  const estados = f.estado ? ESTADOS_DEL_FILTRO[f.estado] : null;
  const buscar = f.buscar?.trim() ? plano(f.buscar.trim()) : null;
  const coincide = (texto: string) => !buscar || plano(texto).includes(buscar);

  const [listaPagos, listaDeudas] = await Promise.all([pagos(colegios), deudas(colegios)]);

  const filas: Array<FilaFactura & { _orden: string }> = [];

  for (const p of listaPagos) {
    if (p.meses.length === 0) continue;
    const entro = elegidos.has(p.mes_pago);
    if (!entro && !p.meses.some((m) => elegidos.has(m))) continue;
    const estado =
      p.tipo === 'inscripcion' ? (p.aprobado ? 'inscripcion' : 'inscripcion_revision') : p.aprobado ? 'pagado' : 'revision';
    if (estados && !estados.includes(estado)) continue;
    if (!coincide(`${p.hijos.join(' ')} ${p.representante} ${p.cedula} ${p.correo}`)) continue;
    const pagado = estado === 'pagado' || estado === 'inscripcion';
    filas.push({
      estado: ETIQUETA_REGISTRO[estado],
      ano: anosDe(p.meses),
      mes: nombresDe(p.meses),
      fecha_pago: diaLegible(p.fecha_pago),
      mes_pago: nombreDeMes(p.mes_pago),
      representante: p.representante,
      cedula: p.cedula,
      correo: p.correo,
      telefono: p.telefono,
      hijos: lista(p.hijos),
      colegios: lista(p.colegios ?? []),
      disciplinas: lista(p.disciplinas.map((d) => d.split(' — ')[0]!)),
      subtotal: dinero(p.subtotal),
      descuento: dinero(p.descuento),
      iva: dinero(p.iva),
      total: dinero(p.total),
      recaudado: entro ? dinero(p.total) : 0,
      factura_nombre: p.factura_nombre ?? '',
      factura_identificacion: p.factura_identificacion ?? '',
      factura_correo: p.factura_correo ?? '',
      factura_direccion: p.factura_direccion ?? '',
      // Rojo lo que no está pagado; amarillo lo pagado con la inscripción.
      _color: !pagado ? 'rojo' : estado === 'inscripcion' ? 'amarillo' : null,
      _factura: pagado,
      _orden: `0|${p.fecha_pago}`,
    });
  }

  // Lo que se debe: una fila por representante y mes, al final y en rojo.
  const actual = mesDe(hoyEc());
  const grupos = new Map<string, typeof listaDeudas>();
  for (const d of listaDeudas) {
    if (!elegidos.has(d.mes)) continue;
    if (d.futuro && !explicitos) continue;
    if (estados && !estados.includes(d.estado)) continue;
    const k = `${d.contacto?.usu_id ?? `sin:${d.nino_id}`}|${d.mes}`;
    grupos.set(k, [...(grupos.get(k) ?? []), d]);
  }
  const facturas = await facturasDe(
    [...new Set(listaDeudas.map((d) => d.contacto?.usu_id).filter((x): x is number => typeof x === 'number'))],
  );
  for (const grupo of grupos.values()) {
    const d0 = grupo[0]!;
    const c = d0.contacto;
    if (!coincide(`${grupo.map((d) => d.alumno).join(' ')} ${c?.nombre ?? ''} ${c?.cedula ?? ''} ${c?.correo ?? ''}`)) {
      continue;
    }
    const suma = (k: 'subtotal' | 'descuento' | 'iva' | 'total') => dinero(grupo.reduce((s, d) => s + d[k], 0));
    const fac = c ? facturas.get(c.usu_id) : undefined;
    const atrasado = grupo.some((d) => d.estado === 'atrasado');
    filas.push({
      estado: atrasado ? 'Atrasado' : 'Pendiente',
      ano: d0.mes.slice(0, 4),
      mes: NOMBRES_MES[Number(d0.mes.slice(5, 7)) - 1],
      fecha_pago: '',
      mes_pago: '',
      representante: c?.nombre ?? '',
      cedula: c?.cedula ?? '',
      correo: c?.correo ?? '',
      telefono: c?.telefono ?? '',
      hijos: lista(grupo.map((d) => d.alumno)),
      colegios: lista(grupo.map((d) => d.col_nombre)),
      disciplinas: lista(grupo.flatMap((d) => d.disciplinas)),
      subtotal: suma('subtotal'),
      descuento: suma('descuento'),
      iva: suma('iva'),
      total: suma('total'),
      recaudado: 0,
      factura_nombre: fac?.factura_nombre ?? '',
      factura_identificacion: fac?.factura_identificacion ?? '',
      factura_correo: fac?.factura_correo ?? '',
      factura_direccion: fac?.factura_direccion ?? '',
      _color: 'rojo',
      _factura: false,
      _orden: `1|${d0.mes}|${d0.mes > actual ? 1 : 0}|${c?.nombre ?? ''}`,
    });
  }

  return filas
    .sort((x, y) => x._orden.localeCompare(y._orden))
    .slice(0, tope)
    .map(({ _orden: _o, ...resto }) => resto);
}
