import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import { ESTADO, ROL } from '../../lib/constants.js';
import { contieneSinTildes } from '../../lib/sql.js';
import { offsetDe } from '../../lib/paginacion.js';
import type {
  ListarInscripcionesQuery,
  NinoFormulario,
  RepresentanteFormulario,
  TipoDocumento,
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
}

/** La version mas alta de cada tipo. Puede faltar alguno si nunca se publico. */
export async function documentosVigentes(): Promise<DocumentoLegal[]> {
  const { rows } = await getPool().query<DocumentoLegal>(
    `SELECT DISTINCT ON (doc_tipo)
            doc_id, doc_tipo, doc_version, doc_titulo, doc_contenido, doc_fecha
       FROM public.documento_legal
      ORDER BY doc_tipo, doc_version DESC`,
  );
  return rows;
}

export interface VersionDocumento {
  doc_id: number;
  doc_tipo: TipoDocumento;
  doc_version: number;
  doc_titulo: string;
  doc_fecha: string;
  aceptaciones: number;
}

export async function historialDocumentos(): Promise<VersionDocumento[]> {
  const { rows } = await getPool().query<VersionDocumento>(
    `SELECT d.doc_id, d.doc_tipo, d.doc_version, d.doc_titulo, d.doc_fecha,
            (SELECT count(*) FROM public.inscripcion i
              WHERE d.doc_id IN (i.doc_contrato_id, i.doc_terminos_id, i.doc_privacidad_id))::int
              AS aceptaciones
       FROM public.documento_legal d
      ORDER BY d.doc_tipo, d.doc_version DESC`,
  );
  return rows;
}

export async function obtenerDocumento(docId: number): Promise<DocumentoLegal | null> {
  const { rows } = await getPool().query<DocumentoLegal>(
    `SELECT doc_id, doc_tipo, doc_version, doc_titulo, doc_contenido, doc_fecha
       FROM public.documento_legal WHERE doc_id = $1`,
    [docId],
  );
  return rows[0] ?? null;
}

/**
 * Nueva version. El numero se calcula dentro del INSERT; si dos publican a la
 * vez, el UNIQUE (doc_tipo, doc_version) hace fallar al segundo en vez de
 * dejar dos versiones con el mismo numero.
 */
export async function insertarDocumento(
  client: PoolClient,
  tipo: TipoDocumento,
  titulo: string,
  contenido: string,
): Promise<DocumentoLegal> {
  const { rows } = await client.query<DocumentoLegal>(
    `INSERT INTO public.documento_legal (doc_tipo, doc_version, doc_titulo, doc_contenido)
     SELECT $1, COALESCE(max(doc_version), 0) + 1, $2, $3
       FROM public.documento_legal WHERE doc_tipo = $1
     RETURNING doc_id, doc_tipo, doc_version, doc_titulo, doc_contenido, doc_fecha`,
    [tipo, titulo, contenido],
  );
  return rows[0]!;
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
  disciplinas: DisciplinaOfertada[];
}

/**
 * Colegios con al menos una disciplina activa, y esas disciplinas. Es lo
 * unico de la base que ve alguien sin sesion: nombres y horarios. Nada de
 * direcciones, contactos ni entrenadores.
 */
export async function ofertaPublica(): Promise<ColegioOfertado[]> {
  const { rows } = await getPool().query<ColegioOfertado>(
    `SELECT col.col_id, col.col_nombre,
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
       JOIN public.actividad act ON act.act_id = d.act_id
       JOIN public.dia       dia ON dia.dia_id = d.dia_id
       LEFT JOIN public.categoria cat ON cat.cat_id = act.cat_id
      WHERE d.est_id = $1
      GROUP BY col.col_id, col.col_nombre
      ORDER BY col.col_nombre`,
    [ESTADO.ACTIVO],
  );
  return rows;
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
    docContrato: number;
    docTerminos: number;
    docPrivacidad: number;
    ip: string | null;
    navegador: string | null;
  },
): Promise<number> {
  const { rows } = await client.query<{ ins_id: number }>(
    `INSERT INTO public.inscripcion
         (ins_representante, ins_comprobante, doc_contrato_id, doc_terminos_id,
          doc_privacidad_id, ins_ip, ins_navegador)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ins_id`,
    [
      JSON.stringify(datos.representante),
      datos.comprobante,
      datos.docContrato,
      datos.docTerminos,
      datos.docPrivacidad,
      datos.ip,
      datos.navegador,
    ],
  );
  return rows[0]!.ins_id;
}

export async function insertarNinoDeInscripcion(
  client: PoolClient,
  datos: {
    insId: number;
    orden: number;
    nino: NinoFormulario;
    contrato: string;
    sha256: string;
  },
): Promise<number> {
  const { disciplinas, ...resto } = datos.nino;
  const { rows } = await client.query<{ insnino_id: number }>(
    `INSERT INTO public.inscripcion_nino
         (ins_id, insnino_orden, insnino_datos, insnino_disciplinas,
          insnino_contrato, insnino_contrato_sha256)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING insnino_id`,
    [datos.insId, datos.orden, JSON.stringify(resto), disciplinas, datos.contrato, datos.sha256],
  );
  return rows[0]!.insnino_id;
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
  const { rows } = await getPool().query<InscripcionListada & { total: string }>(
    `SELECT i.ins_id, i.ins_estado, i.ins_fecha,
            i.ins_representante->>'nombre'   AS representante_nombre,
            i.ins_representante->>'correo'   AS representante_correo,
            i.ins_representante->>'cedula'   AS representante_cedula,
            i.ins_representante->>'telefono' AS representante_telefono,
            COALESCE((SELECT json_agg(n.insnino_datos->>'nombre' ORDER BY n.insnino_orden)
                        FROM public.inscripcion_nino n WHERE n.ins_id = i.ins_id), '[]'::json) AS ninos,
            (i.ins_estado = 'pendiente' AND ${USUARIO_EXISTENTE}) AS usuario_existente,
            count(*) OVER() AS total
       FROM public.inscripcion i
      WHERE ${F_LISTA}
      ORDER BY (i.ins_estado = 'pendiente') DESC, i.ins_fecha DESC, i.ins_id DESC
      LIMIT $3 OFFSET $4`,
    [query.estado ?? null, buscar, query.limit, offsetDe(query)],
  );
  const total = rows.length > 0 ? Number(rows[0]?.total ?? 0) : 0;
  return { items: rows.map(({ total: _t, ...resto }) => resto), total };
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
  doc_contrato_id: number;
  doc_terminos_id: number;
  doc_privacidad_id: number;
  ins_ip: string | null;
  ins_navegador: string | null;
  usu_id: number | null;
  ins_aprobada_por: number | null;
  aprobada_por_nombre: string | null;
  ins_fecha_aprobacion: string | null;
  versiones: { contrato: number; terminos: number; privacidad: number };
}

export interface NinoDeInscripcion {
  insnino_id: number;
  insnino_orden: number;
  insnino_datos: Omit<NinoFormulario, 'disciplinas'>;
  insnino_disciplinas: number[];
  insnino_contrato: string;
  insnino_contrato_sha256: string;
  nino_id: number | null;
}

export async function obtener(
  insId: number,
  client?: PoolClient,
  bloquear = false,
): Promise<InscripcionFila | null> {
  const { rows } = await (client ?? getPool()).query<InscripcionFila>(
    `SELECT i.ins_id, i.ins_estado, i.ins_fecha, i.ins_representante, i.ins_comprobante,
            i.doc_contrato_id, i.doc_terminos_id, i.doc_privacidad_id,
            i.ins_ip, i.ins_navegador, i.usu_id, i.ins_aprobada_por,
            ap.usu_nombre AS aprobada_por_nombre, i.ins_fecha_aprobacion,
            json_build_object('contrato', dc.doc_version, 'terminos', dt.doc_version,
                              'privacidad', dp.doc_version) AS versiones
       FROM public.inscripcion i
       JOIN public.documento_legal dc ON dc.doc_id = i.doc_contrato_id
       JOIN public.documento_legal dt ON dt.doc_id = i.doc_terminos_id
       JOIN public.documento_legal dp ON dp.doc_id = i.doc_privacidad_id
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
            insnino_contrato, insnino_contrato_sha256, nino_id
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
): Promise<void> {
  await client.query(
    `UPDATE public.inscripcion
        SET ins_estado = 'aprobada', usu_id = $2, ins_aprobada_por = $3,
            ins_fecha_aprobacion = now()
      WHERE ins_id = $1`,
    [insId, usuId, aprobadaPor],
  );
}

export async function fijarNino(client: PoolClient, insninoId: number, ninoId: number): Promise<void> {
  await client.query('UPDATE public.inscripcion_nino SET nino_id = $2 WHERE insnino_id = $1', [
    insninoId,
    ninoId,
  ]);
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
     SELECT insnino_contrato FROM public.inscripcion_nino WHERE ins_id = $1`,
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
