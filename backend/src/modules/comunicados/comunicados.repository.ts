import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import { ESTADO, ROL } from '../../lib/constants.js';
import { horarioTexto } from '../../lib/horarios.js';
import { contieneSinTildes } from '../../lib/sql.js';
import type { FiltroRepresentantes } from './comunicados.schemas.js';

/**
 * Consultas de Comunicados (0044). Todo es del Propietario: no hay alcance
 * que filtrar. Los representantes se leen, nunca se tocan.
 */

type Ejecutor = Pick<PoolClient, 'query'>;
const db = (client?: Ejecutor): Ejecutor => client ?? getPool();

export interface Destinatario {
  correo: string;
  nombre: string;
}

// ---------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------

export interface ContactoListado {
  comcon_id: number;
  comcon_nombre: string;
  comcon_correo: string;
  comcon_fecha_creacion: string;
  segmentos: Array<{ id: number; nombre: string }>;
  /** Nombre del representante con ese mismo correo, si lo hay. */
  representante: string | null;
}

export async function listarContactos(buscar: string | null, segmento: number | null): Promise<ContactoListado[]> {
  const { rows } = await getPool().query<ContactoListado>(
    `SELECT c.comcon_id, c.comcon_nombre, c.comcon_correo, c.comcon_fecha_creacion,
            COALESCE((SELECT json_agg(json_build_object('id', s.comseg_id, 'nombre', s.comseg_nombre)
                                      ORDER BY s.comseg_nombre)
                        FROM public.comunicado_segmento_contacto sc
                        JOIN public.comunicado_segmento s ON s.comseg_id = sc.comseg_id
                       WHERE sc.comcon_id = c.comcon_id), '[]'::json) AS segmentos,
            (SELECT u.usu_nombre FROM public.usuario u
               JOIN public.usuario_rol ur ON ur.usu_id = u.usu_id AND ur.rol_id = ${ROL.REPRESENTANTE}
              WHERE lower(u.usu_correo) = c.comcon_correo AND u.est_id = ${ESTADO.ACTIVO}
              LIMIT 1) AS representante
       FROM public.comunicado_contacto c
      WHERE ($1::text IS NULL OR ${contieneSinTildes('c.comcon_nombre', '$1')}
                              OR ${contieneSinTildes('c.comcon_correo', '$1')})
        AND ($2::int IS NULL OR EXISTS (SELECT 1 FROM public.comunicado_segmento_contacto sc
                                         WHERE sc.comcon_id = c.comcon_id AND sc.comseg_id = $2))
      ORDER BY lower(c.comcon_nombre), c.comcon_correo
      LIMIT 10000`,
    [buscar, segmento],
  );
  return rows;
}

export async function contarContactos(): Promise<number> {
  const { rows } = await getPool().query<{ n: number }>(
    'SELECT count(*)::int AS n FROM public.comunicado_contacto',
  );
  return rows[0]?.n ?? 0;
}

export async function contactoPorCorreo(correo: string, excepto: number | null): Promise<{ comcon_id: number } | null> {
  const { rows } = await getPool().query<{ comcon_id: number }>(
    `SELECT comcon_id FROM public.comunicado_contacto
      WHERE comcon_correo = $1 AND ($2::int IS NULL OR comcon_id <> $2)`,
    [correo, excepto],
  );
  return rows[0] ?? null;
}

/** El representante activo con ese correo, si lo hay. */
export async function representantePorCorreo(correo: string): Promise<{ usu_nombre: string } | null> {
  const { rows } = await getPool().query<{ usu_nombre: string }>(
    `SELECT u.usu_nombre FROM public.usuario u
       JOIN public.usuario_rol ur ON ur.usu_id = u.usu_id AND ur.rol_id = ${ROL.REPRESENTANTE}
      WHERE lower(u.usu_correo) = $1 AND u.est_id = ${ESTADO.ACTIVO}
      LIMIT 1`,
    [correo],
  );
  return rows[0] ?? null;
}

export async function crearContacto(nombre: string, correo: string): Promise<number> {
  const { rows } = await getPool().query<{ comcon_id: number }>(
    `INSERT INTO public.comunicado_contacto (comcon_nombre, comcon_correo)
     VALUES ($1, $2) RETURNING comcon_id`,
    [nombre, correo],
  );
  return rows[0]!.comcon_id;
}

export async function editarContacto(id: number, nombre: string, correo: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `UPDATE public.comunicado_contacto SET comcon_nombre = $2, comcon_correo = $3 WHERE comcon_id = $1`,
    [id, nombre, correo],
  );
  return (rowCount ?? 0) > 0;
}

export async function borrarContactos(ids: number[]): Promise<number> {
  const { rowCount } = await getPool().query(
    'DELETE FROM public.comunicado_contacto WHERE comcon_id = ANY($1::int[])',
    [ids],
  );
  return rowCount ?? 0;
}

export async function todosLosCorreosDeContactos(): Promise<string[]> {
  const { rows } = await getPool().query<{ c: string }>(
    'SELECT comcon_correo AS c FROM public.comunicado_contacto',
  );
  return rows.map((r) => r.c);
}

/** Correo → nombre de todos los representantes activos. */
export async function correosDeRepresentantes(): Promise<Destinatario[]> {
  const { rows } = await getPool().query<Destinatario>(
    `SELECT DISTINCT ON (lower(u.usu_correo)) lower(u.usu_correo) AS correo, u.usu_nombre AS nombre
       FROM public.usuario u
       JOIN public.usuario_rol ur ON ur.usu_id = u.usu_id AND ur.rol_id = ${ROL.REPRESENTANTE}
      WHERE u.est_id = ${ESTADO.ACTIVO} AND COALESCE(u.usu_correo, '') <> ''`,
  );
  return rows;
}

/** Inserta los que no existan. Devuelve cuántos entraron. */
export async function insertarContactos(client: PoolClient, nombres: string[], correos: string[]): Promise<number> {
  const { rowCount } = await client.query(
    `INSERT INTO public.comunicado_contacto (comcon_nombre, comcon_correo)
     SELECT n, c FROM unnest($1::text[], $2::text[]) AS t(n, c)
     ON CONFLICT (comcon_correo) DO NOTHING`,
    [nombres, correos],
  );
  return rowCount ?? 0;
}

export async function idsPorCorreos(client: PoolClient, correos: string[]): Promise<number[]> {
  const { rows } = await client.query<{ comcon_id: number }>(
    'SELECT comcon_id FROM public.comunicado_contacto WHERE comcon_correo = ANY($1::text[])',
    [correos],
  );
  return rows.map((r) => r.comcon_id);
}

// ---------------------------------------------------------------------------
// Segmentos
// ---------------------------------------------------------------------------

export interface SegmentoListado {
  comseg_id: number;
  comseg_nombre: string;
  contactos: number;
}

export async function listarSegmentos(): Promise<SegmentoListado[]> {
  const { rows } = await getPool().query<SegmentoListado>(
    `SELECT s.comseg_id, s.comseg_nombre,
            (SELECT count(*) FROM public.comunicado_segmento_contacto sc
              WHERE sc.comseg_id = s.comseg_id)::int AS contactos
       FROM public.comunicado_segmento s
      ORDER BY lower(s.comseg_nombre)`,
  );
  return rows;
}

export async function segmentoPorId(id: number): Promise<{ comseg_id: number; comseg_nombre: string } | null> {
  const { rows } = await getPool().query<{ comseg_id: number; comseg_nombre: string }>(
    'SELECT comseg_id, comseg_nombre FROM public.comunicado_segmento WHERE comseg_id = $1',
    [id],
  );
  return rows[0] ?? null;
}

export async function crearSegmento(nombre: string, client?: PoolClient): Promise<number> {
  const { rows } = await db(client).query<{ comseg_id: number }>(
    'INSERT INTO public.comunicado_segmento (comseg_nombre) VALUES ($1) RETURNING comseg_id',
    [nombre],
  );
  return rows[0]!.comseg_id;
}

export async function renombrarSegmento(id: number, nombre: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    'UPDATE public.comunicado_segmento SET comseg_nombre = $2 WHERE comseg_id = $1',
    [id, nombre],
  );
  return (rowCount ?? 0) > 0;
}

export async function borrarSegmento(id: number): Promise<boolean> {
  const { rowCount } = await getPool().query('DELETE FROM public.comunicado_segmento WHERE comseg_id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

export async function anadirASegmento(segmento: number, ids: number[], client?: PoolClient): Promise<number> {
  const { rowCount } = await db(client).query(
    `INSERT INTO public.comunicado_segmento_contacto (comseg_id, comcon_id)
     SELECT $1, c.comcon_id FROM public.comunicado_contacto c WHERE c.comcon_id = ANY($2::int[])
     ON CONFLICT DO NOTHING`,
    [segmento, ids],
  );
  return rowCount ?? 0;
}

export async function quitarDeSegmento(segmento: number, ids: number[]): Promise<number> {
  const { rowCount } = await getPool().query(
    'DELETE FROM public.comunicado_segmento_contacto WHERE comseg_id = $1 AND comcon_id = ANY($2::int[])',
    [segmento, ids],
  );
  return rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// Representantes (solo lectura)
// ---------------------------------------------------------------------------

/**
 * Representante activo que tiene al menos un hijo activo que cumple todos los
 * filtros a la vez (colegio, curso y disciplina). Sin filtros: todos los
 * representantes activos. $1 colegio, $2 curso, $3 disciplina.
 */
const F_REPRESENTANTE = `
      u.est_id = ${ESTADO.ACTIVO}
  AND COALESCE(u.usu_correo, '') <> ''
  AND (($1::int IS NULL AND $2::int IS NULL AND $3::int IS NULL)
       OR EXISTS (
          SELECT 1
            FROM public.nino_padre np
            JOIN public.nino n ON n.nino_id = np.nino_id
           WHERE np.padre_id = p.padre_id
             AND n.est_id = ${ESTADO.ACTIVO}
             AND ($1::int IS NULL OR n.col_id = $1)
             AND ($2::int IS NULL OR n.catninograd_id = $2)
             AND ($3::int IS NULL OR EXISTS (
                    SELECT 1 FROM public.nino_asignacion na
                     WHERE na.nino_id = n.nino_id
                       AND na.est_id = ${ESTADO.ACTIVO}
                       AND na.colacthor_id = $3))))`;

const DESDE_REPRESENTANTE = `
       FROM public.usuario u
       JOIN public.usuario_rol ur ON ur.usu_id = u.usu_id AND ur.rol_id = ${ROL.REPRESENTANTE}
       JOIN public.padre p ON p.usu_id = u.usu_id`;

export interface RepresentanteListado {
  usu_id: number;
  usu_nombre: string;
  correo: string;
  hijos: Array<{ nombre: string; colegio: string; curso: string | null }>;
}

export async function listarRepresentantes(
  filtro: FiltroRepresentantes,
  buscar: string | null,
): Promise<RepresentanteListado[]> {
  const { rows } = await getPool().query<RepresentanteListado>(
    `SELECT u.usu_id, u.usu_nombre, lower(u.usu_correo) AS correo,
            COALESCE((SELECT json_agg(json_build_object(
                               'nombre', n.nino_nombre, 'colegio', c.col_nombre,
                               'curso', g.catninograd_nombre) ORDER BY n.nino_nombre)
                        FROM public.nino_padre np
                        JOIN public.nino n ON n.nino_id = np.nino_id
                        JOIN public.colegio c ON c.col_id = n.col_id
                        LEFT JOIN public.categoria_nino_grado g ON g.catninograd_id = n.catninograd_id
                       WHERE np.padre_id = p.padre_id AND n.est_id = ${ESTADO.ACTIVO}), '[]'::json) AS hijos
     ${DESDE_REPRESENTANTE}
      WHERE ${F_REPRESENTANTE}
        AND ($4::text IS NULL OR ${contieneSinTildes('u.usu_nombre', '$4')}
                              OR ${contieneSinTildes('u.usu_correo', '$4')})
      ORDER BY u.usu_nombre
      LIMIT 10000`,
    [filtro.colegio ?? null, filtro.curso ?? null, filtro.disciplina ?? null, buscar],
  );
  return rows;
}

export async function destinatariosRepresentantes(filtro: FiltroRepresentantes): Promise<Destinatario[]> {
  const { rows } = await getPool().query<Destinatario>(
    `SELECT DISTINCT ON (lower(u.usu_correo)) lower(u.usu_correo) AS correo, u.usu_nombre AS nombre
     ${DESDE_REPRESENTANTE}
      WHERE ${F_REPRESENTANTE}`,
    [filtro.colegio ?? null, filtro.curso ?? null, filtro.disciplina ?? null],
  );
  return rows;
}

/** Todos los contactos, o los de un segmento. */
export async function destinatariosContactos(segmento: number | null): Promise<Destinatario[]> {
  const { rows } = await getPool().query<Destinatario>(
    `SELECT c.comcon_correo AS correo, c.comcon_nombre AS nombre
       FROM public.comunicado_contacto c
      WHERE $1::int IS NULL
         OR EXISTS (SELECT 1 FROM public.comunicado_segmento_contacto sc
                     WHERE sc.comcon_id = c.comcon_id AND sc.comseg_id = $1)`,
    [segmento],
  );
  return rows;
}

export interface Opciones {
  colegios: Array<{ id: number; nombre: string }>;
  cursos: Array<{ id: number; nombre: string }>;
  disciplinas: Array<{ id: number; col_id: number; nombre: string; horario: string | null }>;
}

export async function opciones(): Promise<Opciones> {
  const { rows } = await getPool().query<Opciones>(
    `SELECT
       COALESCE((SELECT json_agg(json_build_object('id', c.col_id, 'nombre', c.col_nombre) ORDER BY c.col_nombre)
                   FROM public.colegio c), '[]'::json) AS colegios,
       COALESCE((SELECT json_agg(json_build_object('id', g.catninograd_id, 'nombre', g.catninograd_nombre)
                                 ORDER BY g.catninograd_id)
                   FROM public.categoria_nino_grado g), '[]'::json) AS cursos,
       COALESCE((SELECT json_agg(json_build_object('id', d.colacthor_id, 'col_id', d.col_id,
                                                   'nombre', a.act_nombre, 'horario', ${horarioTexto('d')})
                                 ORDER BY a.act_nombre, d.colacthor_id)
                   FROM public.colegio_actividad_horario d
                   JOIN public.actividad a ON a.act_id = d.act_id
                  WHERE d.est_id = ${ESTADO.ACTIVO}), '[]'::json) AS disciplinas`,
  );
  return rows[0] ?? { colegios: [], cursos: [], disciplinas: [] };
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

export interface Plantilla {
  complan_id: number;
  complan_nombre: string;
  complan_html: string;
  complan_fecha_modificacion: string;
}

export async function listarPlantillas(): Promise<Plantilla[]> {
  const { rows } = await getPool().query<Plantilla>(
    `SELECT complan_id, complan_nombre, complan_html, complan_fecha_modificacion
       FROM public.comunicado_plantilla ORDER BY lower(complan_nombre)`,
  );
  return rows;
}

export async function obtenerPlantilla(id: number): Promise<Plantilla | null> {
  const { rows } = await getPool().query<Plantilla>(
    `SELECT complan_id, complan_nombre, complan_html, complan_fecha_modificacion
       FROM public.comunicado_plantilla WHERE complan_id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function crearPlantilla(nombre: string, html: string): Promise<number> {
  const { rows } = await getPool().query<{ complan_id: number }>(
    `INSERT INTO public.comunicado_plantilla (complan_nombre, complan_html) VALUES ($1, $2) RETURNING complan_id`,
    [nombre, html],
  );
  return rows[0]!.complan_id;
}

export async function editarPlantilla(id: number, nombre: string, html: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `UPDATE public.comunicado_plantilla
        SET complan_nombre = $2, complan_html = $3, complan_fecha_modificacion = now()
      WHERE complan_id = $1`,
    [id, nombre, html],
  );
  return (rowCount ?? 0) > 0;
}

export async function borrarPlantilla(id: number): Promise<boolean> {
  const { rowCount } = await getPool().query('DELETE FROM public.comunicado_plantilla WHERE complan_id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Comunicados
// ---------------------------------------------------------------------------

export type EstadoComunicado =
  | 'borrador'
  | 'en_cola'
  | 'preparando'
  | 'enviando'
  | 'limpiando'
  | 'enviado'
  | 'fallido';

export interface ComunicadoListado {
  com_id: number;
  com_asunto: string;
  com_estado: EstadoComunicado;
  com_destino_texto: string | null;
  com_total: number | null;
  com_error: string | null;
  complan_id: number | null;
  plantilla_nombre: string | null;
  autor: string | null;
  com_fecha_creacion: string;
  com_fecha_modificacion: string;
  com_fecha_envio: string | null;
  com_fecha_fin: string | null;
}

export interface Comunicado extends ComunicadoListado {
  com_cuerpo: string;
  com_modo: 'visual' | 'html';
  com_destinos: unknown[];
  com_html: string | null;
}

const COLUMNAS_LISTA = `
    c.com_id, c.com_asunto, c.com_estado, c.com_destino_texto, c.com_total, c.com_error,
    c.complan_id, pl.complan_nombre AS plantilla_nombre, u.usu_nombre AS autor,
    c.com_fecha_creacion, c.com_fecha_modificacion, c.com_fecha_envio, c.com_fecha_fin`;

const DESDE_COMUNICADO = `
    FROM public.comunicado c
    LEFT JOIN public.comunicado_plantilla pl ON pl.complan_id = c.complan_id
    LEFT JOIN public.usuario u ON u.usu_id = c.usu_id`;

export async function listarComunicados(): Promise<ComunicadoListado[]> {
  const { rows } = await getPool().query<ComunicadoListado>(
    `SELECT ${COLUMNAS_LISTA} ${DESDE_COMUNICADO}
      ORDER BY COALESCE(c.com_fecha_envio, c.com_fecha_modificacion) DESC
      LIMIT 500`,
  );
  return rows;
}

export async function obtenerComunicado(id: number): Promise<Comunicado | null> {
  const { rows } = await getPool().query<Comunicado>(
    `SELECT ${COLUMNAS_LISTA}, c.com_cuerpo, c.com_modo, c.com_destinos, c.com_html
     ${DESDE_COMUNICADO}
      WHERE c.com_id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function crearComunicado(
  usuId: number,
  asunto: string,
  cuerpo: string,
  modo: string,
  plantilla: number | null,
  destinos: string,
): Promise<number> {
  const { rows } = await getPool().query<{ com_id: number }>(
    `INSERT INTO public.comunicado (usu_id, com_asunto, com_cuerpo, com_modo, complan_id, com_destinos)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING com_id`,
    [usuId, asunto, cuerpo, modo, plantilla, destinos],
  );
  return rows[0]!.com_id;
}

/** Solo un borrador se edita. */
export async function editarComunicado(
  id: number,
  asunto: string,
  cuerpo: string,
  modo: string,
  plantilla: number | null,
  destinos: string,
): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `UPDATE public.comunicado
        SET com_asunto = $2, com_cuerpo = $3, com_modo = $4, complan_id = $5,
            com_destinos = $6::jsonb, com_fecha_modificacion = now()
      WHERE com_id = $1 AND com_estado = 'borrador'`,
    [id, asunto, cuerpo, modo, plantilla, destinos],
  );
  return (rowCount ?? 0) > 0;
}

/** Borradores, y del historial los que ya terminaron. */
export async function borrarComunicado(id: number): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `DELETE FROM public.comunicado
      WHERE com_id = $1 AND com_estado IN ('borrador', 'enviado', 'fallido')`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}

/** Pasa el borrador a la cola con todo lo que se guarda del envío. */
export async function ponerEnCola(
  client: PoolClient,
  id: number,
  usuId: number,
  destinoTexto: string,
  total: number,
  html: string,
): Promise<boolean> {
  const { rowCount } = await client.query(
    `UPDATE public.comunicado
        SET com_estado = 'en_cola', usu_id = $2, com_destino_texto = $3, com_total = $4,
            com_html = $5, com_error = NULL, com_fecha_envio = now(), com_fecha_modificacion = now()
      WHERE com_id = $1 AND com_estado = 'borrador'`,
    [id, usuId, destinoTexto, total, html],
  );
  return (rowCount ?? 0) > 0;
}

export async function insertarDestinatarios(
  client: PoolClient,
  comId: number,
  correos: string[],
  nombres: string[],
): Promise<void> {
  await client.query(
    `INSERT INTO public.comunicado_destinatario (com_id, comdes_correo, comdes_nombre)
     SELECT $1, c, n FROM unnest($2::text[], $3::text[]) AS t(c, n)
     ON CONFLICT DO NOTHING`,
    [comId, correos, nombres],
  );
}

// ---------------------------------------------------------------------------
// El envío (comunicados.envio.ts)
// ---------------------------------------------------------------------------

export interface EnCurso {
  com_id: number;
  com_estado: EstadoComunicado;
  com_asunto: string;
  com_html: string | null;
  com_error: string | null;
  com_resend_segmento: string | null;
  com_resend_broadcast: string | null;
}

/** El que está a medias (uno solo a la vez), o el primero de la cola. */
export async function siguienteEnvio(): Promise<EnCurso | null> {
  const { rows } = await getPool().query<EnCurso>(
    `SELECT com_id, com_estado, com_asunto, com_html, com_error, com_resend_segmento, com_resend_broadcast
       FROM public.comunicado
      WHERE com_estado IN ('preparando', 'enviando', 'limpiando', 'en_cola')
      ORDER BY (com_estado = 'en_cola'), com_fecha_envio, com_id
      LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function cambiarEstado(id: number, estado: string, error: string | null): Promise<void> {
  await getPool().query(
    `UPDATE public.comunicado
        SET com_estado = $2, com_error = COALESCE($3, com_error),
            com_fecha_fin = CASE WHEN $2 IN ('enviado', 'fallido') THEN now() ELSE com_fecha_fin END
      WHERE com_id = $1`,
    [id, estado, error],
  );
}

export async function guardarSegmentoResend(id: number, segmento: string): Promise<void> {
  await getPool().query('UPDATE public.comunicado SET com_resend_segmento = $2 WHERE com_id = $1', [id, segmento]);
}

export async function guardarBroadcastResend(id: number, broadcast: string): Promise<void> {
  await getPool().query('UPDATE public.comunicado SET com_resend_broadcast = $2 WHERE com_id = $1', [id, broadcast]);
}

export interface DestinatarioEnCurso {
  correo: string;
  nombre: string;
  estado: 'pendiente' | 'creando' | 'creado' | 'existia' | 'borrado';
}

export async function destinatariosPorEstado(
  comId: number,
  estados: string[],
  limite: number,
): Promise<DestinatarioEnCurso[]> {
  const { rows } = await getPool().query<DestinatarioEnCurso>(
    `SELECT comdes_correo AS correo, comdes_nombre AS nombre, comdes_estado AS estado
       FROM public.comunicado_destinatario
      WHERE com_id = $1 AND comdes_estado = ANY($2::text[])
      ORDER BY comdes_correo
      LIMIT $3`,
    [comId, estados, limite],
  );
  return rows;
}

export async function marcarDestinatario(comId: number, correo: string, estado: string): Promise<void> {
  await getPool().query(
    `UPDATE public.comunicado_destinatario SET comdes_estado = $3 WHERE com_id = $1 AND comdes_correo = $2`,
    [comId, correo, estado],
  );
}

export async function contarDestinatariosEnSegmento(comId: number): Promise<number> {
  const { rows } = await getPool().query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.comunicado_destinatario
      WHERE com_id = $1 AND comdes_estado IN ('creado', 'existia')`,
    [comId],
  );
  return rows[0]?.n ?? 0;
}

export async function vaciarDestinatarios(comId: number): Promise<void> {
  await getPool().query('DELETE FROM public.comunicado_destinatario WHERE com_id = $1', [comId]);
}
