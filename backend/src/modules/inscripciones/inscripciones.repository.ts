import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import { ESTADO, ROL } from '../../lib/constants.js';
import { contieneSinTildes } from '../../lib/sql.js';
import { offsetDe } from '../../lib/paginacion.js';
import type { CobroAlumno, PrecioColegio } from './inscripciones.precios.js';
import type { TipoDocumento } from './inscripciones.documentos.js';
import type {
  ListarInscripcionesQuery,
  NinoFormulario,
  RepresentanteFormulario,
} from './inscripciones.schemas.js';

/**
 * Acceso a datos de Inscripciones (migracion 0014).
 *
 * Mientras una inscripcion esta pendiente, todo vive en `inscripcion` e
 * `inscripcion_nino`: ningun otro modulo la ve. Usuario, nino y disciplinas
 * nacen al aprobar (decision del cliente, 2026-10-02).
 */

// ---------------------------------------------------------------------------
// Documentos legales

export interface DocumentoLegal {
  doc_id: number;
  doc_tipo: TipoDocumento;
  doc_version: number;
  doc_titulo: string;
  doc_contenido: string;
  doc_fecha: string;
  /** null = borrador: se edita y se borra. Con fecha = publicado, intocable. */
  doc_publicado: string | null;
}

const COLUMNAS_DOC = 'doc_id, doc_tipo, doc_version, doc_titulo, doc_contenido, doc_fecha, doc_publicado';

/** La publicada mas alta de cada tipo. Puede faltar alguno si nunca se publico. */
export async function documentosVigentes(): Promise<DocumentoLegal[]> {
  const { rows } = await getPool().query<DocumentoLegal>(
    `SELECT DISTINCT ON (doc_tipo) ${COLUMNAS_DOC}
       FROM public.documento_legal
      WHERE doc_publicado IS NOT NULL
      ORDER BY doc_tipo, doc_version DESC`,
  );
  return rows;
}

/** El borrador de cada tipo, si lo hay (como mucho uno: indice de 0015). */
export async function borradores(): Promise<DocumentoLegal[]> {
  const { rows } = await getPool().query<DocumentoLegal>(
    `SELECT ${COLUMNAS_DOC} FROM public.documento_legal
      WHERE doc_publicado IS NULL ORDER BY doc_tipo`,
  );
  return rows;
}

export interface VersionDocumento {
  doc_id: number;
  doc_tipo: TipoDocumento;
  doc_version: number;
  doc_titulo: string;
  doc_fecha: string;
  doc_publicado: string | null;
  aceptaciones: number;
}

export async function historialDocumentos(): Promise<VersionDocumento[]> {
  const { rows } = await getPool().query<VersionDocumento>(
    `SELECT d.doc_id, d.doc_tipo, d.doc_version, d.doc_titulo, d.doc_fecha, d.doc_publicado,
            (SELECT count(DISTINCT a.ins_id) FROM public.inscripcion_aceptacion a
              WHERE a.doc_id = d.doc_id)::int AS aceptaciones
       FROM public.documento_legal d
      WHERE d.doc_publicado IS NOT NULL
      ORDER BY d.doc_tipo, d.doc_version DESC`,
  );
  return rows;
}

export async function obtenerDocumento(
  docId: number,
  client?: PoolClient,
): Promise<DocumentoLegal | null> {
  const { rows } = await (client ?? getPool()).query<DocumentoLegal>(
    `SELECT ${COLUMNAS_DOC} FROM public.documento_legal WHERE doc_id = $1`,
    [docId],
  );
  return rows[0] ?? null;
}

/**
 * Guarda el borrador de un tipo: lo actualiza si ya hay uno, o crea la
 * version siguiente. El numero se calcula dentro del INSERT; si dos lo crean
 * a la vez, el indice de un-borrador-por-tipo hace fallar al segundo.
 */
export async function guardarBorrador(
  client: PoolClient,
  tipo: TipoDocumento,
  titulo: string,
  contenido: string,
): Promise<DocumentoLegal> {
  const { rows: actualizado } = await client.query<DocumentoLegal>(
    `UPDATE public.documento_legal
        SET doc_titulo = $2, doc_contenido = $3, doc_fecha = now()
      WHERE doc_tipo = $1 AND doc_publicado IS NULL
      RETURNING ${COLUMNAS_DOC}`,
    [tipo, titulo, contenido],
  );
  if (actualizado[0]) return actualizado[0];

  const { rows } = await client.query<DocumentoLegal>(
    `INSERT INTO public.documento_legal (doc_tipo, doc_version, doc_titulo, doc_contenido)
     SELECT $1, COALESCE(max(doc_version), 0) + 1, $2, $3
       FROM public.documento_legal WHERE doc_tipo = $1
     RETURNING ${COLUMNAS_DOC}`,
    [tipo, titulo, contenido],
  );
  return rows[0]!;
}

/** Publica un borrador. Devuelve null si no era un borrador. */
export async function publicarBorrador(
  client: PoolClient,
  docId: number,
): Promise<DocumentoLegal | null> {
  const { rows } = await client.query<DocumentoLegal>(
    `UPDATE public.documento_legal SET doc_publicado = now()
      WHERE doc_id = $1 AND doc_publicado IS NULL
      RETURNING ${COLUMNAS_DOC}`,
    [docId],
  );
  return rows[0] ?? null;
}

export async function borrarBorrador(client: PoolClient, docId: number): Promise<boolean> {
  const { rowCount } = await client.query(
    'DELETE FROM public.documento_legal WHERE doc_id = $1 AND doc_publicado IS NULL',
    [docId],
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Precios por colegio (0015)

export interface PrecioListado {
  col_id: number;
  col_nombre: string;
  disciplinas_activas: number;
  precio: number | null;
  descuento_hermano: number | null;
  sede: string | null;
  sede_corta: string | null;
  institucion: string | null;
  minimo_alumnos: number | null;
  fecha_modificacion: string | null;
}

/** Lo que la ficha y el contrato dicen del colegio (0016). */
export interface ColegioDocumento {
  sede: string;
  sede_corta: string;
  institucion: string;
  minimo_alumnos: number;
  tarifa: number;
  descuento_hermano: number;
}

/** numeric llega de pg como texto; aqui se convierte una sola vez. */
const aNumero = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function listarPrecios(): Promise<PrecioListado[]> {
  const { rows } = await getPool().query<PrecioListado>(
    `SELECT c.col_id, c.col_nombre,
            (SELECT count(*) FROM public.colegio_actividad_horario d
              WHERE d.col_id = c.col_id AND d.est_id = $1)::int AS disciplinas_activas,
            p.colpre_precio_disciplina      AS precio,
            p.colpre_descuento_hermano      AS descuento_hermano,
            p.colpre_sede                   AS sede,
            p.colpre_sede_corta             AS sede_corta,
            p.colpre_institucion            AS institucion,
            p.colpre_minimo_alumnos         AS minimo_alumnos,
            p.colpre_fecha_modificacion     AS fecha_modificacion
       FROM public.colegio c
       LEFT JOIN public.colegio_precio p ON p.col_id = c.col_id
      ORDER BY c.col_nombre`,
    [ESTADO.ACTIVO],
  );
  return rows.map((r) => ({
    ...r,
    precio: aNumero(r.precio),
    descuento_hermano: aNumero(r.descuento_hermano),
  }));
}

export type PrecioConDocumento = PrecioColegio & { documento: ColegioDocumento };

export async function preciosDe(
  colIds: number[],
  client?: PoolClient,
): Promise<Map<number, PrecioConDocumento>> {
  const mapa = new Map<number, PrecioConDocumento>();
  if (colIds.length === 0) return mapa;
  const { rows } = await (client ?? getPool()).query<{
    col_id: number;
    precio: string;
    descuento: string;
    sede: string;
    sede_corta: string;
    institucion: string;
    minimo_alumnos: number;
  }>(
    `SELECT col_id, colpre_precio_disciplina AS precio, colpre_descuento_hermano AS descuento,
            colpre_sede AS sede, colpre_sede_corta AS sede_corta,
            colpre_institucion AS institucion, colpre_minimo_alumnos AS minimo_alumnos
       FROM public.colegio_precio WHERE col_id = ANY($1::int[])`,
    [colIds],
  );
  for (const r of rows) {
    const precio = Number(r.precio);
    const descuentoHermano = Number(r.descuento);
    mapa.set(r.col_id, {
      precio,
      descuentoHermano,
      documento: {
        sede: r.sede,
        sede_corta: r.sede_corta,
        institucion: r.institucion,
        minimo_alumnos: r.minimo_alumnos,
        tarifa: precio,
        descuento_hermano: descuentoHermano,
      },
    });
  }
  return mapa;
}

export async function existeColegio(colId: number): Promise<boolean> {
  const { rows } = await getPool().query('SELECT 1 FROM public.colegio WHERE col_id = $1', [colId]);
  return rows.length > 0;
}

export async function guardarPrecio(
  client: PoolClient,
  colId: number,
  datos: PrecioColegio & Omit<ColegioDocumento, 'tarifa' | 'descuento_hermano'>,
): Promise<void> {
  await client.query(
    `INSERT INTO public.colegio_precio
         (col_id, colpre_precio_disciplina, colpre_descuento_hermano, colpre_sede,
          colpre_sede_corta, colpre_institucion, colpre_minimo_alumnos)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (col_id) DO UPDATE
        SET colpre_precio_disciplina      = EXCLUDED.colpre_precio_disciplina,
            colpre_descuento_hermano      = EXCLUDED.colpre_descuento_hermano,
            colpre_sede                   = EXCLUDED.colpre_sede,
            colpre_sede_corta             = EXCLUDED.colpre_sede_corta,
            colpre_institucion            = EXCLUDED.colpre_institucion,
            colpre_minimo_alumnos         = EXCLUDED.colpre_minimo_alumnos,
            colpre_fecha_modificacion     = now()`,
    [
      colId,
      datos.precio,
      datos.descuentoHermano,
      datos.sede,
      datos.sede_corta,
      datos.institucion,
      datos.minimo_alumnos,
    ],
  );
}

// ---------------------------------------------------------------------------
// Configuración: el membrete (0016, una sola fila). El IVA es fijo: IVA_PCT.

export interface ConfigInscripcion {
  /** Ruta en el bucket; null = el membrete de serie. */
  membrete: string | null;
  fecha_modificacion: string;
}

export async function obtenerConfig(client?: PoolClient): Promise<ConfigInscripcion> {
  const { rows } = await (client ?? getPool()).query<ConfigInscripcion>(
    `SELECT inscfg_membrete AS membrete,
            inscfg_fecha_modificacion AS fecha_modificacion
       FROM public.inscripcion_config WHERE inscfg_id = 1`,
  );
  const r = rows[0];
  if (!r) throw new Error('Falta la fila de inscripcion_config (migración 0016)');
  return r;
}

/** Cambia el membrete y devuelve la ruta anterior, para borrarla. */
export async function guardarMembrete(
  client: PoolClient,
  ruta: string | null,
): Promise<string | null> {
  const { rows } = await client.query<{ anterior: string | null }>(
    'SELECT inscfg_membrete AS anterior FROM public.inscripcion_config WHERE inscfg_id = 1 FOR UPDATE',
  );
  await client.query(
    `UPDATE public.inscripcion_config
        SET inscfg_membrete = $1, inscfg_fecha_modificacion = now()
      WHERE inscfg_id = 1`,
    [ruta],
  );
  return rows[0]?.anterior ?? null;
}

export async function borrarPrecio(client: PoolClient, colId: number): Promise<void> {
  await client.query('DELETE FROM public.colegio_precio WHERE col_id = $1', [colId]);
}

// ---------------------------------------------------------------------------
// Lo que el formulario publico necesita ver

export interface DisciplinaOfertada {
  colacthor_id: number;
  col_id: number;
  actividad: string;
  categoria: string | null;
  dia: string;
  dia_id: number;
  hora_inicio: string;
  hora_fin: string;
}

export interface ColegioOfertado {
  col_id: number;
  col_nombre: string;
  precio: number;
  descuento_hermano: number;
  sede: string;
  sede_corta: string;
  institucion: string;
  minimo_alumnos: number;
  disciplinas: DisciplinaOfertada[];
}

/**
 * Colegios con precio configurado y al menos una disciplina activa, y esas
 * disciplinas. Es lo unico de la base que ve alguien sin sesion: nombres,
 * horarios y precios. Nada de direcciones, contactos ni entrenadores.
 */
export async function ofertaPublica(): Promise<ColegioOfertado[]> {
  const { rows } = await getPool().query<ColegioOfertado>(
    `SELECT col.col_id, col.col_nombre,
            pre.colpre_precio_disciplina      AS precio,
            pre.colpre_descuento_hermano      AS descuento_hermano,
            pre.colpre_sede                   AS sede,
            pre.colpre_sede_corta             AS sede_corta,
            pre.colpre_institucion            AS institucion,
            pre.colpre_minimo_alumnos         AS minimo_alumnos,
            json_agg(json_build_object(
                'colacthor_id', d.colacthor_id,
                'col_id',       d.col_id,
                'actividad',    act.act_nombre,
                'categoria',    cat.cat_nombre,
                'dia',          dia.dia_nombre,
                'dia_id',       d.dia_id,
                'hora_inicio',  to_char(d.colacthor_hora_inicio, 'HH24:MI'),
                'hora_fin',     to_char(d.colacthor_hora_fin, 'HH24:MI')
            ) ORDER BY act.act_nombre, d.dia_id, d.colacthor_hora_inicio) AS disciplinas
       FROM public.colegio_actividad_horario d
       JOIN public.colegio   col ON col.col_id = d.col_id
       JOIN public.colegio_precio pre ON pre.col_id = d.col_id
       JOIN public.actividad act ON act.act_id = d.act_id
       JOIN public.dia       dia ON dia.dia_id = d.dia_id
       LEFT JOIN public.categoria cat ON cat.cat_id = act.cat_id
      WHERE d.est_id = $1
      GROUP BY col.col_id, col.col_nombre, pre.colpre_precio_disciplina,
               pre.colpre_descuento_hermano, pre.colpre_sede, pre.colpre_sede_corta,
               pre.colpre_institucion, pre.colpre_minimo_alumnos
      ORDER BY col.col_nombre`,
    [ESTADO.ACTIVO],
  );
  return rows.map((r) => ({
    ...r,
    precio: Number(r.precio),
    descuento_hermano: Number(r.descuento_hermano),
  }));
}

export interface GradoOfertado {
  catninograd_id: number;
  catninograd_nombre: string;
}

export async function grados(): Promise<GradoOfertado[]> {
  const { rows } = await getPool().query<GradoOfertado>(
    'SELECT catninograd_id, catninograd_nombre FROM public.categoria_nino_grado ORDER BY catninograd_id',
  );
  return rows;
}

/** Disciplinas por id, con lo necesario para validarlas y escribirlas en el contrato. */
export async function disciplinasPorId(
  ids: number[],
  client?: PoolClient,
): Promise<Array<DisciplinaOfertada & { est_id: number; col_nombre: string }>> {
  if (ids.length === 0) return [];
  const { rows } = await (client ?? getPool()).query<
    DisciplinaOfertada & { est_id: number; col_nombre: string }
  >(
    `SELECT d.colacthor_id, d.col_id, d.est_id, col.col_nombre,
            act.act_nombre AS actividad, cat.cat_nombre AS categoria,
            dia.dia_nombre AS dia, d.dia_id,
            to_char(d.colacthor_hora_inicio, 'HH24:MI') AS hora_inicio,
            to_char(d.colacthor_hora_fin, 'HH24:MI')    AS hora_fin
       FROM public.colegio_actividad_horario d
       JOIN public.colegio   col ON col.col_id = d.col_id
       JOIN public.actividad act ON act.act_id = d.act_id
       JOIN public.dia       dia ON dia.dia_id = d.dia_id
       LEFT JOIN public.categoria cat ON cat.cat_id = act.cat_id
      WHERE d.colacthor_id = ANY($1::int[])`,
    [ids],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Escritura del envio

export async function insertarInscripcion(
  client: PoolClient,
  datos: {
    representante: RepresentanteFormulario;
    comprobante: string;
    total: number;
    ip: string | null;
    navegador: string | null;
    fecha: Date;
  },
): Promise<number> {
  const { rows } = await client.query<{ ins_id: number }>(
    `INSERT INTO public.inscripcion
         (ins_representante, ins_comprobante, ins_ip, ins_navegador, ins_total, ins_fecha)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ins_id`,
    [
      JSON.stringify(datos.representante),
      datos.comprobante,
      datos.ip,
      datos.navegador,
      datos.total,
      datos.fecha,
    ],
  );
  return rows[0]!.ins_id;
}

/**
 * Lo que se guarda de cada alumno: lo que escribió el representante y una
 * foto de lo que el sistema puso en sus documentos (datos del colegio,
 * curso, disciplinas y horarios). Con eso el paquete se vuelve a generar
 * idéntico al aprobar, aunque luego cambien los precios o las disciplinas.
 */
export type NinoGuardado = Omit<NinoFormulario, 'disciplinas'> & {
  documento: {
    colegio: ColegioDocumento;
    curso: string | null;
    actividades: string[];
    horarios: string[];
  };
};

export async function insertarNinoDeInscripcion(
  client: PoolClient,
  datos: {
    insId: number;
    orden: number;
    nino: NinoGuardado;
    disciplinas: number[];
    pdf: string;
    sha256: string;
    cobro: CobroAlumno;
  },
): Promise<number> {
  const { rows } = await client.query<{ insnino_id: number }>(
    `INSERT INTO public.inscripcion_nino
         (ins_id, insnino_orden, insnino_datos, insnino_disciplinas,
          insnino_pdf, insnino_pdf_sha256, insnino_precio)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING insnino_id`,
    [
      datos.insId,
      datos.orden,
      JSON.stringify(datos.nino),
      datos.disciplinas,
      datos.pdf,
      datos.sha256,
      JSON.stringify(datos.cobro),
    ],
  );
  return rows[0]!.insnino_id;
}

export async function insertarAceptacion(
  client: PoolClient,
  datos: {
    insId: number;
    insninoId: number;
    docId: number;
    sha256: string;
    opciones: Record<string, unknown>;
    fecha: Date;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO public.inscripcion_aceptacion
         (ins_id, insnino_id, doc_id, acep_texto_sha256, acep_opciones, acep_fecha)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      datos.insId,
      datos.insninoId,
      datos.docId,
      datos.sha256,
      JSON.stringify(datos.opciones),
      datos.fecha,
    ],
  );
}

export interface AceptacionGuardada {
  insnino_id: number;
  doc_id: number;
  doc_tipo: TipoDocumento;
  doc_version: number;
  doc_titulo: string;
  doc_contenido: string;
  acep_texto_sha256: string;
  acep_opciones: Record<string, unknown>;
  acep_fecha: string;
}

export async function aceptacionesDe(
  insId: number,
  client?: PoolClient,
): Promise<AceptacionGuardada[]> {
  const { rows } = await (client ?? getPool()).query<AceptacionGuardada>(
    `SELECT a.insnino_id, a.doc_id, d.doc_tipo, d.doc_version, d.doc_titulo, d.doc_contenido,
            a.acep_texto_sha256, a.acep_opciones, a.acep_fecha
       FROM public.inscripcion_aceptacion a
       JOIN public.documento_legal d ON d.doc_id = a.doc_id
      WHERE a.ins_id = $1
      ORDER BY a.insnino_id, a.acep_id`,
    [insId],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Lectura del modulo interno

export interface InscripcionListada {
  ins_id: number;
  ins_estado: 'pendiente' | 'aprobada';
  ins_fecha: string;
  representante_nombre: string;
  representante_correo: string;
  representante_cedula: string;
  representante_telefono: string;
  ninos: string[];
  total: number | null;
  /** Ya hay un usuario con ese correo o con esa cedula. */
  usuario_existente: boolean;
}

const F_LISTA = `
    ($1::text IS NULL OR i.ins_estado = $1)
    AND ($2::text IS NULL
         OR ${contieneSinTildes("i.ins_representante->>'nombre'", '$2')}
         OR ${contieneSinTildes("i.ins_representante->>'correo'", '$2')}
         OR ${contieneSinTildes("i.ins_representante->>'cedula'", '$2')}
         OR EXISTS (SELECT 1 FROM public.inscripcion_nino n
                     WHERE n.ins_id = i.ins_id
                       AND ${contieneSinTildes("n.insnino_datos->>'nombre'", '$2')}))
`;

/** Coincidencia con un usuario ya existente, por correo o por cedula. */
const USUARIO_EXISTENTE = `
    EXISTS (SELECT 1 FROM public.usuario u
             WHERE lower(trim(u.usu_correo)) = lower(trim(i.ins_representante->>'correo'))
                OR upper(trim(u.usu_cedula)) = upper(trim(i.ins_representante->>'cedula')))
`;

export async function listar(
  query: ListarInscripcionesQuery,
): Promise<{ items: InscripcionListada[]; total: number }> {
  const buscar = query.buscar && query.buscar.length > 0 ? query.buscar : null;
  const { rows } = await getPool().query<
    Omit<InscripcionListada, 'total'> & { total_cobro: number | null; total: string }
  >(
    `SELECT i.ins_id, i.ins_estado, i.ins_fecha,
            i.ins_representante->>'nombre'   AS representante_nombre,
            i.ins_representante->>'correo'   AS representante_correo,
            i.ins_representante->>'cedula'   AS representante_cedula,
            i.ins_representante->>'telefono' AS representante_telefono,
            COALESCE((SELECT json_agg(n.insnino_datos->>'nombre' ORDER BY n.insnino_orden)
                        FROM public.inscripcion_nino n WHERE n.ins_id = i.ins_id), '[]'::json) AS ninos,
            i.ins_total::float8 AS total_cobro,
            (i.ins_estado = 'pendiente' AND ${USUARIO_EXISTENTE}) AS usuario_existente,
            count(*) OVER() AS total
       FROM public.inscripcion i
      WHERE ${F_LISTA}
      ORDER BY (i.ins_estado = 'pendiente') DESC, i.ins_fecha DESC, i.ins_id DESC
      LIMIT $3 OFFSET $4`,
    [query.estado ?? null, buscar, query.limit, offsetDe(query)],
  );
  const total = rows.length > 0 ? Number(rows[0]?.total ?? 0) : 0;
  return {
    items: rows.map(({ total: _t, total_cobro, ...resto }) => ({ ...resto, total: total_cobro })),
    total,
  };
}

export async function contarPorEstado(): Promise<{ pendientes: number; aprobadas: number }> {
  const { rows } = await getPool().query<{ pendientes: number; aprobadas: number }>(
    `SELECT count(*) FILTER (WHERE ins_estado = 'pendiente')::int AS pendientes,
            count(*) FILTER (WHERE ins_estado = 'aprobada')::int  AS aprobadas
       FROM public.inscripcion`,
  );
  return rows[0] ?? { pendientes: 0, aprobadas: 0 };
}

export interface InscripcionFila {
  ins_id: number;
  ins_estado: 'pendiente' | 'aprobada';
  ins_fecha: string;
  ins_representante: RepresentanteFormulario;
  ins_comprobante: string;
  ins_ip: string | null;
  ins_navegador: string | null;
  usu_id: number | null;
  ins_aprobada_por: number | null;
  aprobada_por_nombre: string | null;
  ins_fecha_aprobacion: string | null;
  ins_total: number | null;
}

export interface NinoDeInscripcion {
  insnino_id: number;
  insnino_orden: number;
  insnino_datos: NinoGuardado;
  insnino_disciplinas: number[];
  insnino_pdf: string;
  insnino_pdf_sha256: string;
  insnino_pdf_aprobado: string | null;
  insnino_pdf_aprobado_sha256: string | null;
  insnino_precio: CobroAlumno | null;
  nino_id: number | null;
}

export async function obtener(
  insId: number,
  client?: PoolClient,
  bloquear = false,
): Promise<InscripcionFila | null> {
  const { rows } = await (client ?? getPool()).query<InscripcionFila>(
    `SELECT i.ins_id, i.ins_estado, i.ins_fecha, i.ins_representante, i.ins_comprobante,
            i.ins_ip, i.ins_navegador, i.usu_id, i.ins_aprobada_por,
            ap.usu_nombre AS aprobada_por_nombre, i.ins_fecha_aprobacion,
            i.ins_total::float8 AS ins_total
       FROM public.inscripcion i
       LEFT JOIN public.usuario ap ON ap.usu_id = i.ins_aprobada_por
      WHERE i.ins_id = $1
      ${bloquear ? 'FOR UPDATE OF i' : ''}`,
    [insId],
  );
  return rows[0] ?? null;
}

export async function ninosDe(insId: number, client?: PoolClient): Promise<NinoDeInscripcion[]> {
  const { rows } = await (client ?? getPool()).query<NinoDeInscripcion>(
    `SELECT insnino_id, insnino_orden, insnino_datos, insnino_disciplinas,
            insnino_pdf, insnino_pdf_sha256, insnino_pdf_aprobado,
            insnino_pdf_aprobado_sha256, insnino_precio, nino_id
       FROM public.inscripcion_nino
      WHERE ins_id = $1
      ORDER BY insnino_orden`,
    [insId],
  );
  return rows;
}

export interface UsuarioCoincidente {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  usu_cedula: string | null;
  est_id: number;
  es_representante: boolean;
  /** Por que coincide: el correo, la cedula o las dos cosas. */
  por_correo: boolean;
  por_cedula: boolean;
}

export async function usuariosCoincidentes(
  correo: string,
  cedula: string,
  client?: PoolClient,
): Promise<UsuarioCoincidente[]> {
  const { rows } = await (client ?? getPool()).query<UsuarioCoincidente>(
    `SELECT u.usu_id, u.usu_nombre, u.usu_correo, u.usu_cedula, u.est_id,
            EXISTS (SELECT 1 FROM public.usuario_rol ur
                     WHERE ur.usu_id = u.usu_id AND ur.rol_id = $3) AS es_representante,
            lower(trim(u.usu_correo)) = lower(trim($1)) AS por_correo,
            COALESCE(upper(trim(u.usu_cedula)) = upper(trim($2)), false) AS por_cedula
       FROM public.usuario u
      WHERE lower(trim(u.usu_correo)) = lower(trim($1))
         OR upper(trim(u.usu_cedula)) = upper(trim($2))
      ORDER BY u.usu_id`,
    [correo, cedula, ROL.REPRESENTANTE],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Aprobar y rechazar

export async function marcarAprobada(
  client: PoolClient,
  insId: number,
  usuId: number,
  aprobadaPor: number,
  fecha: Date,
): Promise<void> {
  await client.query(
    `UPDATE public.inscripcion
        SET ins_estado = 'aprobada', usu_id = $2, ins_aprobada_por = $3,
            ins_fecha_aprobacion = $4
      WHERE ins_id = $1`,
    [insId, usuId, aprobadaPor, fecha],
  );
}

export async function fijarNino(
  client: PoolClient,
  insninoId: number,
  ninoId: number,
  pdfAprobado: { ruta: string; sha256: string },
): Promise<void> {
  await client.query(
    `UPDATE public.inscripcion_nino
        SET nino_id = $2, insnino_pdf_aprobado = $3, insnino_pdf_aprobado_sha256 = $4
      WHERE insnino_id = $1`,
    [insninoId, ninoId, pdfAprobado.ruta, pdfAprobado.sha256],
  );
}

/** La autorización de la ficha de salud: lo único de las fichas que el alta de Estudiantes no lleva. */
export async function marcarSaludAutorizada(
  client: PoolClient,
  ninoId: number,
  autoriza: boolean,
): Promise<void> {
  await client.query('UPDATE public.nino SET nino_salud_autorizada = $2 WHERE nino_id = $1', [
    ninoId,
    autoriza,
  ]);
}

/** Datos de factura del representante. Pisan los anteriores: son los últimos que dio. */
export async function guardarFactura(
  client: PoolClient,
  padreId: number,
  f: RepresentanteFormulario['factura'],
): Promise<void> {
  await client.query(
    `UPDATE public.padre
        SET padre_factura_nombre = $2, padre_factura_identificacion = $3,
            padre_factura_correo = $4, padre_factura_direccion = $5,
            padre_fecha_modificacion = now()
      WHERE padre_id = $1`,
    [padreId, f.nombre, f.identificacion, f.correo, f.direccion],
  );
}

/** Alta en una disciplina, marcada con la inscripcion de la que viene. */
export async function inscribirEnDisciplina(
  client: PoolClient,
  ninoId: number,
  colacthorId: number,
  insninoId: number,
): Promise<void> {
  await client.query(
    `INSERT INTO public.nino_asignacion (nino_id, colacthor_id, est_id, insnino_id)
     VALUES ($1, $2, $3, $4)`,
    [ninoId, colacthorId, ESTADO.ACTIVO, insninoId],
  );
}

export async function atarConParentesco(
  client: PoolClient,
  ninoId: number,
  padreId: number,
  parentesco: string,
): Promise<void> {
  await client.query(
    `INSERT INTO public.nino_padre (nino_id, padre_id, ninopadre_parentesco)
     VALUES ($1, $2, $3)
     ON CONFLICT (nino_id, padre_id) DO UPDATE SET ninopadre_parentesco = EXCLUDED.ninopadre_parentesco`,
    [ninoId, padreId, parentesco],
  );
}

export async function padreIdDe(client: PoolClient, usuId: number): Promise<number> {
  const { rows } = await client.query<{ padre_id: number }>(
    'SELECT padre_id FROM public.padre WHERE usu_id = $1',
    [usuId],
  );
  return rows[0]!.padre_id;
}

export async function agregarRolRepresentante(client: PoolClient, usuId: number): Promise<void> {
  await client.query(
    `INSERT INTO public.usuario_rol (usu_id, rol_id) VALUES ($1, $2)
     ON CONFLICT (usu_id, rol_id) DO NOTHING`,
    [usuId, ROL.REPRESENTANTE],
  );
}

/** Pone la cedula solo si el usuario no tenia; nunca pisa una que ya existe. */
export async function completarCedula(client: PoolClient, usuId: number, cedula: string): Promise<void> {
  await client.query(
    'UPDATE public.usuario SET usu_cedula = $2 WHERE usu_id = $1 AND usu_cedula IS NULL',
    [usuId, cedula],
  );
}

/** Borra la inscripcion y, en cascada, sus ninos. Devuelve las rutas a limpiar. */
export async function borrar(client: PoolClient, insId: number): Promise<string[]> {
  const { rows } = await client.query<{ ruta: string }>(
    `SELECT ins_comprobante AS ruta FROM public.inscripcion WHERE ins_id = $1
     UNION ALL
     SELECT insnino_pdf FROM public.inscripcion_nino WHERE ins_id = $1`,
    [insId],
  );
  await client.query('DELETE FROM public.inscripcion WHERE ins_id = $1', [insId]);
  return rows.map((r) => r.ruta);
}

export async function nombresDeGrados(ids: number[]): Promise<Map<number, string>> {
  const mapa = new Map<number, string>();
  if (ids.length === 0) return mapa;
  const { rows } = await getPool().query<GradoOfertado>(
    `SELECT catninograd_id, catninograd_nombre FROM public.categoria_nino_grado
      WHERE catninograd_id = ANY($1::int[])`,
    [ids],
  );
  for (const r of rows) mapa.set(r.catninograd_id, r.catninograd_nombre);
  return mapa;
}
