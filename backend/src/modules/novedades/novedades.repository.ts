import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';

/**
 * Acceso a datos de Novedades.
 *
 * El listado trae la novedad + autor + menciones agregadas en un solo
 * viaje con `jsonb_agg`; en el sistema viejo cada tipo de dato era una
 * consulta por fila.
 */

export type TipoNovedad = 'general' | 'personal' | 'alumno';

export interface MencionPersona {
  id: number;
  nombre: string;
  correo: string | null;
}

export interface MencionAlumno {
  id: number;
  nombre: string;
  col_id: number | null;
  col_nombre: string | null;
  grado: string | null;
}

export interface Novedad {
  nov_id: number;
  nov_tipo: TipoNovedad;
  nov_texto: string;
  nov_fecha_creacion: string;
  autor: { usu_id: number; usu_nombre: string; usu_correo: string | null };
  personas: MencionPersona[];
  alumnos: MencionAlumno[];
}

export interface FiltrosListar {
  tipo?: TipoNovedad;
  autor?: number;
  persona?: number;
  alumno?: number;
  desde?: string;
  hasta?: string;
  buscar?: string;
  /** `null` → ve todas (Propietario / Admin). */
  visibilidad: {
    actorId: number;
    ninosDelActor: number[];
    verSobreMi: boolean;
  } | null;
  limit: number;
  offset: number;
}

const SQL_SELECT = `
  SELECT n.nov_id,
         n.nov_tipo,
         n.nov_texto,
         n.nov_fecha_creacion,
         jsonb_build_object(
           'usu_id', a.usu_id,
           'usu_nombre', a.usu_nombre,
           'usu_correo', a.usu_correo
         ) AS autor,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'id', u.usu_id,
                    'nombre', u.usu_nombre,
                    'correo', u.usu_correo
                  ) ORDER BY u.usu_nombre)
             FROM public.novedad_persona np
             JOIN public.usuario u ON u.usu_id = np.usu_id
            WHERE np.nov_id = n.nov_id
         ), '[]'::jsonb) AS personas,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'id', nn.nino_id,
                    'nombre', nn.nino_nombre,
                    'col_id', nn.col_id,
                    'col_nombre', c.col_nombre,
                    'grado', g.catninograd_nombre
                  ) ORDER BY nn.nino_nombre)
             FROM public.novedad_alumno na
             JOIN public.nino nn ON nn.nino_id = na.nino_id
             LEFT JOIN public.colegio c ON c.col_id = nn.col_id
             LEFT JOIN public.categoria_nino_grado g ON g.catninograd_id = nn.catninograd_id
            WHERE na.nov_id = n.nov_id
         ), '[]'::jsonb) AS alumnos
    FROM public.novedad n
    JOIN public.usuario a ON a.usu_id = n.nov_autor_id
`;

export async function listar(filtros: FiltrosListar, client?: PoolClient): Promise<Novedad[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (expr: string, valor: unknown) => {
    params.push(valor);
    where.push(expr.replace('$?', `$${params.length}`));
  };

  if (filtros.tipo) add('n.nov_tipo = $?', filtros.tipo);
  if (filtros.autor) add('n.nov_autor_id = $?', filtros.autor);
  if (filtros.persona) {
    add(
      'EXISTS (SELECT 1 FROM public.novedad_persona np WHERE np.nov_id = n.nov_id AND np.usu_id = $?)',
      filtros.persona,
    );
  }
  if (filtros.alumno) {
    add(
      'EXISTS (SELECT 1 FROM public.novedad_alumno na WHERE na.nov_id = n.nov_id AND na.nino_id = $?)',
      filtros.alumno,
    );
  }
  if (filtros.desde) add('n.nov_fecha_creacion >= $?::timestamptz', filtros.desde);
  if (filtros.hasta) add("n.nov_fecha_creacion < ($?::date + interval '1 day')", filtros.hasta);
  if (filtros.buscar) add('n.nov_texto ILIKE $?', `%${filtros.buscar}%`);

  if (filtros.visibilidad) {
    const v = filtros.visibilidad;
    const partes: string[] = [];
    params.push(v.actorId);
    partes.push(`n.nov_autor_id = $${params.length}`);

    if (v.verSobreMi) {
      params.push(v.actorId);
      partes.push(
        `(n.nov_tipo = 'personal' AND EXISTS (SELECT 1 FROM public.novedad_persona np WHERE np.nov_id = n.nov_id AND np.usu_id = $${params.length}))`,
      );

      if (v.ninosDelActor.length > 0) {
        params.push(v.ninosDelActor);
        partes.push(
          `(n.nov_tipo = 'alumno' AND EXISTS (SELECT 1 FROM public.novedad_alumno na WHERE na.nov_id = n.nov_id AND na.nino_id = ANY($${params.length}::int[])))`,
        );
      }
    }

    where.push(`(${partes.join(' OR ')})`);
  }

  const sql = `
    ${SQL_SELECT}
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY n.nov_fecha_creacion DESC, n.nov_id DESC
    LIMIT ${filtros.limit} OFFSET ${filtros.offset}
  `;

  const { rows } = await (client ?? getPool()).query<Novedad>(sql, params);
  return rows;
}

export async function obtener(id: number, client?: PoolClient): Promise<Novedad | null> {
  const { rows } = await (client ?? getPool()).query<Novedad>(
    `${SQL_SELECT} WHERE n.nov_id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function insertar(
  client: PoolClient,
  datos: { tipo: TipoNovedad; texto: string; autor_id: number },
): Promise<number> {
  const { rows } = await client.query<{ nov_id: number }>(
    `INSERT INTO public.novedad (nov_tipo, nov_texto, nov_autor_id)
     VALUES ($1, $2, $3) RETURNING nov_id`,
    [datos.tipo, datos.texto, datos.autor_id],
  );
  return rows[0]!.nov_id;
}

export async function ligarPersonas(
  client: PoolClient,
  nov_id: number,
  usu_ids: number[],
): Promise<void> {
  if (usu_ids.length === 0) return;
  await client.query(
    `INSERT INTO public.novedad_persona (nov_id, usu_id)
       SELECT $1, u FROM unnest($2::int[]) AS u`,
    [nov_id, usu_ids],
  );
}

export async function ligarAlumnos(
  client: PoolClient,
  nov_id: number,
  nino_ids: number[],
): Promise<void> {
  if (nino_ids.length === 0) return;
  await client.query(
    `INSERT INTO public.novedad_alumno (nov_id, nino_id)
       SELECT $1, n FROM unnest($2::int[]) AS n`,
    [nov_id, nino_ids],
  );
}

export async function eliminar(client: PoolClient, nov_id: number): Promise<boolean> {
  const { rowCount } = await client.query('DELETE FROM public.novedad WHERE nov_id = $1', [nov_id]);
  return (rowCount ?? 0) > 0;
}

/**
 * Personal mencionable: cualquier usuario activo. El alcance se aplica
 * en el servicio (si se filtra por el rol del actor, mejor).
 */
export async function personalDisponible(opts: {
  buscar?: string;
  limit: number;
}): Promise<Array<{ usu_id: number; usu_nombre: string; usu_correo: string | null; rol: string | null }>> {
  const params: unknown[] = [];
  const where: string[] = ['u.est_id = 1'];

  if (opts.buscar) {
    params.push(`%${opts.buscar}%`);
    where.push(`u.usu_nombre ILIKE $${params.length}`);
  }

  const sql = `
    SELECT u.usu_id, u.usu_nombre, u.usu_correo,
           (SELECT string_agg(r.rol_titulo, ', ' ORDER BY r.rol_id)
              FROM public.usuario_rol ur
              JOIN public.rol r ON r.rol_id = ur.rol_id
             WHERE ur.usu_id = u.usu_id) AS rol
      FROM public.usuario u
     WHERE ${where.join(' AND ')}
     ORDER BY u.usu_nombre
     LIMIT ${opts.limit}
  `;
  const { rows } = await getPool().query(sql, params);
  return rows;
}

/**
 * Alumnos mencionables dentro del alcance del actor.
 *
 *   - global          → todos los activos.
 *   - lista de ninos  → esos exactos.
 *   - por disciplinas → inscritos activos de esas disciplinas.
 *   - por colegios    → activos de esos colegios.
 */
export async function alumnosDisponibles(opts: {
  buscar?: string;
  limit: number;
  global: boolean;
  ninos?: number[];
  disciplinas?: number[];
  colegios?: number[];
}): Promise<Array<{ nino_id: number; nino_nombre: string; col_nombre: string | null; grado: string | null }>> {
  const params: unknown[] = [];
  const where: string[] = ['n.est_id = 1'];

  if (!opts.global) {
    const partes: string[] = [];
    if (opts.ninos && opts.ninos.length > 0) {
      params.push(opts.ninos);
      partes.push(`n.nino_id = ANY($${params.length}::int[])`);
    }
    if (opts.disciplinas && opts.disciplinas.length > 0) {
      params.push(opts.disciplinas);
      partes.push(
        `EXISTS (SELECT 1 FROM public.nino_asignacion na WHERE na.nino_id = n.nino_id AND na.est_id = 1 AND na.colacthor_id = ANY($${params.length}::int[]))`,
      );
    }
    if (opts.colegios && opts.colegios.length > 0) {
      params.push(opts.colegios);
      partes.push(`n.col_id = ANY($${params.length}::int[])`);
    }
    if (partes.length === 0) return [];
    where.push(`(${partes.join(' OR ')})`);
  }

  if (opts.buscar) {
    params.push(`%${opts.buscar}%`);
    where.push(`n.nino_nombre ILIKE $${params.length}`);
  }

  const sql = `
    SELECT n.nino_id,
           n.nino_nombre,
           c.col_nombre,
           g.catninograd_nombre AS grado
      FROM public.nino n
      LEFT JOIN public.colegio c ON c.col_id = n.col_id
      LEFT JOIN public.categoria_nino_grado g ON g.catninograd_id = n.catninograd_id
     WHERE ${where.join(' AND ')}
     ORDER BY n.nino_nombre
     LIMIT ${opts.limit}
  `;
  const { rows } = await getPool().query(sql, params);
  return rows;
}

/** Correos de los representantes activos de esos niños. */
export async function correosDeRepresentantesDe(nino_ids: number[]): Promise<string[]> {
  if (nino_ids.length === 0) return [];
  const { rows } = await getPool().query<{ correo: string }>(
    `SELECT DISTINCT lower(u.usu_correo) AS correo
       FROM public.padre p
       JOIN public.usuario u    ON u.usu_id = p.usu_id
       JOIN public.nino_padre np ON np.padre_id = p.padre_id
      WHERE np.nino_id = ANY($1::int[])
        AND u.est_id = 1
        AND u.usu_correo IS NOT NULL
        AND length(btrim(u.usu_correo)) > 0`,
    [nino_ids],
  );
  return rows.map((r) => r.correo);
}

/** Niños del representante actual (via padre.usu_id). */
export async function ninosDelRepresentante(usu_id: number): Promise<number[]> {
  const { rows } = await getPool().query<{ nino_id: number }>(
    `SELECT np.nino_id
       FROM public.padre p
       JOIN public.nino_padre np ON np.padre_id = p.padre_id
      WHERE p.usu_id = $1`,
    [usu_id],
  );
  return rows.map((r) => r.nino_id);
}

/** Correos de los usuarios mencionados que estén activos. */
export async function correosDeUsuarios(usu_ids: number[]): Promise<string[]> {
  if (usu_ids.length === 0) return [];
  const { rows } = await getPool().query<{ correo: string }>(
    `SELECT DISTINCT lower(usu_correo) AS correo
       FROM public.usuario
      WHERE usu_id = ANY($1::int[])
        AND est_id = 1
        AND usu_correo IS NOT NULL
        AND length(btrim(usu_correo)) > 0`,
    [usu_ids],
  );
  return rows.map((r) => r.correo);
}

export async function existenUsuariosActivos(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const { rows } = await getPool().query<{ usu_id: number }>(
    `SELECT usu_id FROM public.usuario WHERE usu_id = ANY($1::int[]) AND est_id = 1`,
    [ids],
  );
  return rows.map((r) => r.usu_id);
}

export async function existenAlumnosActivos(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const { rows } = await getPool().query<{ nino_id: number }>(
    `SELECT nino_id FROM public.nino WHERE nino_id = ANY($1::int[]) AND est_id = 1`,
    [ids],
  );
  return rows.map((r) => r.nino_id);
}
