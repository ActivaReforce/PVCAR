import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import { ESTADO } from '../../lib/constants.js';
import { offsetDe, ordenSeguro, type Paginacion } from '../../lib/paginacion.js';
import { contieneSinTildes } from '../../lib/sql.js';
import type { ListarActividadesQuery } from './actividades.schemas.js';

export interface Categoria {
  cat_id: number;
  cat_nombre: string;
  cat_descripcion: string | null;
  /** Cuantas actividades cuelgan de ella: la pantalla agrupa por categoria. */
  actividades: number;
}

export interface ActividadListada {
  act_id: number;
  act_nombre: string;
  act_descripcion: string | null;
  cat_id: number | null;
  cat_nombre: string | null;
  act_indumentaria_tipo: string | null;
  act_espacio_trabajo: string | null;
  act_tipo_espacio: string | null;
  act_espacio_secundario: string | null;
  act_materiales_alumno: string[] | null;
  act_fecha_creacion: string | null;
  /** Disciplinas activas que usan esta actividad. */
  disciplinas: number;
  /** Colegios distintos donde se imparte. */
  colegios: number;
}

const F_BUSCAR = `($1::text IS NULL OR ${contieneSinTildes('a.act_nombre', '$1')}
                                    OR ${contieneSinTildes("COALESCE(a.act_descripcion, '')", '$1')})`;

const F_CATEGORIA = `($2::int IS NULL OR a.cat_id = $2)`;

const COLUMNAS_ORDEN: Record<string, string> = {
  nombre: 'a.act_nombre',
  categoria: 'c.cat_nombre',
  disciplinas: 'disciplinas',
  creacion: 'a.act_fecha_creacion',
};

/**
 * Los dos conteos salen de la misma lateral: cuantas disciplinas activas usan
 * la actividad y en cuantos colegios distintos. El segundo es el que dice si
 * "Karate" es de un colegio o de todos, y no estaba en la pantalla vieja.
 */
const LATERAL_USO = `
    LEFT JOIN LATERAL (
        SELECT count(*) AS n, count(DISTINCT cah.col_id) AS colegios
        FROM public.colegio_actividad_horario cah
        WHERE cah.act_id = a.act_id AND cah.est_id = ${ESTADO.ACTIVO}
    ) u ON TRUE
`;

const COLUMNAS = `
        a.act_id,
        a.act_nombre,
        a.act_descripcion,
        a.cat_id,
        c.cat_nombre,
        a.act_indumentaria_tipo,
        a.act_espacio_trabajo,
        a.act_tipo_espacio,
        a.act_espacio_secundario,
        a.act_materiales_alumno,
        a.act_fecha_creacion,
        COALESCE(u.n, 0)::int        AS disciplinas,
        COALESCE(u.colegios, 0)::int AS colegios
`;

export async function listarActividades(
  query: ListarActividadesQuery,
): Promise<{ items: ActividadListada[]; total: number }> {
  const columna = ordenSeguro(query.orden, COLUMNAS_ORDEN, 'a.act_nombre');
  const direccion = query.dir === 'desc' ? 'DESC' : 'ASC';
  const paginacion: Paginacion = { page: query.page, limit: query.limit };

  const { rows } = await getPool().query<ActividadListada & { total: string }>(
    `
    SELECT ${COLUMNAS}, count(*) OVER() AS total
    FROM public.actividad a
    LEFT JOIN public.categoria c ON c.cat_id = a.cat_id
    ${LATERAL_USO}
    WHERE ${F_BUSCAR} AND ${F_CATEGORIA}
    ORDER BY ${columna} ${direccion}, a.act_id ASC
    LIMIT $3 OFFSET $4
    `,
    [
      query.buscar && query.buscar.length > 0 ? query.buscar : null,
      query.categoria ?? null,
      paginacion.limit,
      offsetDe(paginacion),
    ],
  );

  const total = rows.length > 0 ? Number(rows[0]?.total ?? 0) : 0;
  return { items: rows.map(({ total: _t, ...resto }) => resto), total };
}

export async function obtenerActividad(actId: number): Promise<ActividadListada | null> {
  const { rows } = await getPool().query<ActividadListada>(
    `
    SELECT ${COLUMNAS}
    FROM public.actividad a
    LEFT JOIN public.categoria c ON c.cat_id = a.cat_id
    ${LATERAL_USO}
    WHERE a.act_id = $1
    `,
    [actId],
  );
  return rows[0] ?? null;
}

export async function listarCategorias(): Promise<Categoria[]> {
  const { rows } = await getPool().query<Categoria>(
    `SELECT c.cat_id,
            c.cat_nombre,
            c.cat_descripcion,
            COALESCE(a.n, 0)::int AS actividades
       FROM public.categoria c
       LEFT JOIN LATERAL (
           SELECT count(*) AS n FROM public.actividad a WHERE a.cat_id = c.cat_id
       ) a ON TRUE
      ORDER BY c.cat_nombre`,
  );
  return rows;
}

export async function existeNombre(
  nombre: string,
  excluyendo: number | null,
  client?: PoolClient,
): Promise<boolean> {
  const ejecutor = client ?? getPool();
  const { rows } = await ejecutor.query(
    `SELECT 1 FROM public.actividad
      WHERE lower(trim(act_nombre)) = lower(trim($1))
        AND ($2::int IS NULL OR act_id <> $2)
      LIMIT 1`,
    [nombre, excluyendo],
  );
  return rows.length > 0;
}

export async function existeCategoria(catId: number, client: PoolClient): Promise<boolean> {
  const { rows } = await client.query('SELECT 1 FROM public.categoria WHERE cat_id = $1', [catId]);
  return rows.length > 0;
}

export interface CamposActividad {
  nombre: string;
  descripcion: string | null;
  catId: number | null;
  indumentaria: string | null;
  espacioTrabajo: string | null;
  tipoEspacio: string | null;
  espacioSecundario: string | null;
  materiales: string[] | null;
}

export async function insertarActividad(
  client: PoolClient,
  datos: CamposActividad,
): Promise<number> {
  const { rows } = await client.query<{ act_id: number }>(
    `INSERT INTO public.actividad
         (act_nombre, act_descripcion, cat_id, act_indumentaria_tipo,
          act_espacio_trabajo, act_tipo_espacio, act_espacio_secundario, act_materiales_alumno)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING act_id`,
    [
      datos.nombre,
      datos.descripcion,
      datos.catId,
      datos.indumentaria,
      datos.espacioTrabajo,
      datos.tipoEspacio,
      datos.espacioSecundario,
      datos.materiales,
    ],
  );
  return rows[0]!.act_id;
}

/** Cada campo con su bandera: todos menos el nombre pueden vaciarse. */
export async function actualizarActividad(
  client: PoolClient,
  actId: number,
  campos: {
    nombre?: string;
    descripcion: string | null;
    tocarDescripcion: boolean;
    catId: number | null;
    tocarCategoria: boolean;
    indumentaria: string | null;
    tocarIndumentaria: boolean;
    espacioTrabajo: string | null;
    tocarEspacioTrabajo: boolean;
    tipoEspacio: string | null;
    tocarTipoEspacio: boolean;
    espacioSecundario: string | null;
    tocarEspacioSecundario: boolean;
    materiales: string[] | null;
    tocarMateriales: boolean;
  },
): Promise<void> {
  await client.query(
    `UPDATE public.actividad
        SET act_nombre             = COALESCE($2::text, act_nombre),
            act_descripcion        = CASE WHEN $3::boolean  THEN $4::text   ELSE act_descripcion        END,
            cat_id                 = CASE WHEN $5::boolean  THEN $6::int    ELSE cat_id                 END,
            act_indumentaria_tipo  = CASE WHEN $7::boolean  THEN $8::text   ELSE act_indumentaria_tipo  END,
            act_espacio_trabajo    = CASE WHEN $9::boolean  THEN $10::text  ELSE act_espacio_trabajo    END,
            act_tipo_espacio       = CASE WHEN $11::boolean THEN $12::text  ELSE act_tipo_espacio       END,
            act_espacio_secundario = CASE WHEN $13::boolean THEN $14::text  ELSE act_espacio_secundario END,
            act_materiales_alumno  = CASE WHEN $15::boolean THEN $16::text[] ELSE act_materiales_alumno END,
            act_fecha_modificacion = now()
      WHERE act_id = $1`,
    [
      actId,
      campos.nombre ?? null,
      campos.tocarDescripcion,
      campos.descripcion,
      campos.tocarCategoria,
      campos.catId,
      campos.tocarIndumentaria,
      campos.indumentaria,
      campos.tocarEspacioTrabajo,
      campos.espacioTrabajo,
      campos.tocarTipoEspacio,
      campos.tipoEspacio,
      campos.tocarEspacioSecundario,
      campos.espacioSecundario,
      campos.tocarMateriales,
      campos.materiales,
    ],
  );
}

/**
 * Impacto. `colegio_actividad_horario.act_id` no tiene cascada, asi que basta
 * una disciplina —activa o de baja— para que el DELETE rebote. Se cuentan las
 * dos por separado: no es lo mismo "se imparte en 10 sitios" que "quedan 10
 * disciplinas viejas apuntando aqui".
 */
export interface ImpactoActividad {
  eliminables: Record<string, number>;
  bloqueos: Record<string, number>;
  puedeEliminar: boolean;
}

export async function calcularImpacto(actId: number): Promise<ImpactoActividad> {
  const { rows } = await getPool().query<Record<string, string>>(
    `SELECT
        (SELECT count(*) FROM public.colegio_actividad_horario
          WHERE act_id = $1 AND est_id = $2) AS disciplinas_activas,
        (SELECT count(*) FROM public.colegio_actividad_horario
          WHERE act_id = $1 AND est_id <> $2) AS disciplinas_de_baja`,
    [actId, ESTADO.ACTIVO],
  );

  const n = (k: string): number => Number(rows[0]?.[k] ?? 0);

  const bloqueosTodos = {
    disciplinas_activas: n('disciplinas_activas'),
    disciplinas_de_baja: n('disciplinas_de_baja'),
  };
  const bloqueos = Object.fromEntries(
    Object.entries(bloqueosTodos).filter(([, valor]) => valor > 0),
  );

  return { eliminables: {}, bloqueos, puedeEliminar: Object.keys(bloqueos).length === 0 };
}

export async function eliminarActividad(client: PoolClient, actId: number): Promise<void> {
  await client.query('DELETE FROM public.actividad WHERE act_id = $1', [actId]);
}
