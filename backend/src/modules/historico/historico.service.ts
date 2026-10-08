import type { Writable } from 'node:stream';
import ExcelJS from 'exceljs';
import { getPool } from '../../config/db.js';
import { auditar } from '../../lib/auditoria.js';
import { ROLES_GLOBALES } from '../../lib/constants.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import {
  CONJUNTOS,
  conjuntoDe,
  construir,
  filtrosDe,
  type ColumnaHistorico,
  type Conjunto,
  type FiltroId,
  type FiltrosHistorico,
  type Opcion,
} from './historico.definiciones.js';
import {
  GRAFICAS_HISTORICO,
  SQL_INDICADORES,
  parametrosResumen,
  type FiltrosResumen,
  type GraficaHistorico,
} from './historico.resumen.js';
import type { ConsultaQuery, ExportacionBody } from './historico.schemas.js';
import { ahoraEc } from '../../lib/fecha.js';

/**
 * Data anterior: la plataforma vieja, de solo lectura.
 *
 * ---------------------------------------------------------------------------
 * Quién entra
 *
 * Solo Propietario y Admin. Es la historia **entera** de la empresa —todos los
 * colegios, todos los alumnos— y en `archivo` no hay forma de aplicar el
 * alcance de un coordinador: sus colegios de la plataforma nueva no son los de
 * aquí. Antes que inventar una correspondencia por nombre, que fallaría en
 * silencio, se cierra a los roles que ya lo ven todo.
 *
 * Además de eso, la ruta exige `reportes:ver` para mirar y `reportes:crear`
 * para exportar, igual que el resto de Reportes.
 *
 * ---------------------------------------------------------------------------
 * Caché
 *
 * `archivo` no cambia nunca: los recuentos del catálogo y las listas de los
 * filtros se calculan una vez por proceso y se guardan. La primera visita paga
 * las 15 consultas; las siguientes, ninguna.
 */

const TOPE_EXPORTACION = 100_000;

export function exigirGlobal(actor: AuthUser): void {
  const global = actor.usuario.roles.some((r) => ROLES_GLOBALES.includes(r.rol_id));
  if (!global) {
    throw new ApiError(403, 'Data anterior solo está disponible para Propietario y Admin');
  }
}

function exigirConjunto(id: string): Conjunto {
  const conjunto = conjuntoDe(id);
  if (!conjunto) throw new ApiError(404, 'Ese conjunto de datos no existe');
  return conjunto;
}

/** Solo las columnas declaradas; los números, como número (bigint llega en texto). */
function proyectar(fila: Record<string, unknown>, columnas: ColumnaHistorico[]): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const c of columnas) {
    const valor = fila[c.clave];
    if (valor === null || valor === undefined || valor === '') salida[c.clave] = c.numero ? null : '';
    else salida[c.clave] = c.numero ? Number(valor) : valor;
  }
  return salida;
}

/**
 * El ORDER BY.
 *
 * La columna pedida solo se acepta si es una de las declaradas, así que lo que
 * se escribe en el SQL es siempre un identificador conocido, nunca texto del
 * usuario. Detrás va el orden por defecto, para que las filas empatadas no
 * cambien de sitio entre una página y la siguiente.
 */
function ordenDe(conjunto: Conjunto, orden: string | undefined, dir: 'asc' | 'desc'): string {
  const columna = conjunto.columnas.find((c) => c.clave === orden);
  if (!columna) return conjunto.ordenDefecto;
  return `r."${columna.clave}" ${dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, ${conjunto.ordenDefecto}`;
}

// ---------------------------------------------------------------------------
// Catálogo y opciones

export interface ConjuntoDisponible {
  id: string;
  grupo: Conjunto['grupo'];
  titulo: string;
  descripcion: string;
  columnas: ColumnaHistorico[];
  filtros: FiltroId[];
  estados: Opcion[];
  rangoSobre: string | null;
  filas: number;
}

let catalogoGuardado: Promise<ConjuntoDisponible[]> | null = null;

export function catalogo(): Promise<ConjuntoDisponible[]> {
  catalogoGuardado ??= Promise.all(
    CONJUNTOS.map(async (conjunto) => {
      const { sql, params } = construir(conjunto, {});
      const { rows } = await getPool().query<{ total: number }>(
        `SELECT count(*)::int AS total FROM (${sql}) r`,
        params,
      );
      return {
        id: conjunto.id,
        grupo: conjunto.grupo,
        titulo: conjunto.titulo,
        descripcion: conjunto.descripcion,
        columnas: conjunto.columnas,
        filtros: filtrosDe(conjunto),
        estados: conjunto.estados ?? [],
        rangoSobre: conjunto.rangoSobre ?? null,
        filas: rows[0]?.total ?? 0,
      };
    }),
  ).catch((err: unknown) => {
    // Un fallo no se queda guardado: la próxima visita lo vuelve a intentar.
    catalogoGuardado = null;
    throw err;
  });
  return catalogoGuardado;
}

export interface OpcionesHistorico {
  colegios: Opcion[];
  actividades: Opcion[];
  entrenadores: Opcion[];
  roles: Opcion[];
  asistencia: Opcion[];
  /** Primera y última fecha con asistencia de alumnos. */
  rango: { desde: string | null; hasta: string | null };
}

let opcionesGuardadas: Promise<OpcionesHistorico> | null = null;

export function opciones(): Promise<OpcionesHistorico> {
  const lista = async (sql: string) => (await getPool().query<Opcion>(sql)).rows;

  opcionesGuardadas ??= (async () => {
    const [colegios, actividades, entrenadores, roles, asistencia, rango] = await Promise.all([
      lista('SELECT col_id AS id, col_nombre AS nombre FROM archivo.colegio ORDER BY col_nombre'),
      lista('SELECT act_id AS id, act_nombre AS nombre FROM archivo.actividad ORDER BY act_nombre'),
      /* Entrenadores y también quien registró asistencia sin serlo (coordinadores),
         porque el filtro "entrenador" de la asistencia es "registrado por". */
      lista(`SELECT u.usu_id AS id, u.usu_nombre AS nombre
               FROM archivo.usuario u
              WHERE EXISTS (SELECT 1 FROM archivo.entrenador en WHERE en.ent_id = u.usu_id)
                 OR EXISTS (SELECT 1 FROM archivo.asistencia_nino an WHERE an.usu_registrador = u.usu_id)
              ORDER BY u.usu_nombre`),
      lista('SELECT rol_id AS id, rol_titulo AS nombre FROM archivo.rol ORDER BY rol_id'),
      lista('SELECT asisest_id AS id, asisest_nombre AS nombre FROM archivo.asistencia_estado ORDER BY asisest_id'),
      getPool().query<{ desde: string | null; hasta: string | null }>(
        `SELECT to_char(min(asisnino_fecha), 'YYYY-MM-DD') AS desde,
                to_char(max(asisnino_fecha), 'YYYY-MM-DD') AS hasta
           FROM archivo.asistencia_nino`,
      ),
    ]);
    return {
      colegios,
      actividades,
      entrenadores,
      roles,
      asistencia,
      rango: rango.rows[0] ?? { desde: null, hasta: null },
    };
  })().catch((err: unknown) => {
    opcionesGuardadas = null;
    throw err;
  });
  return opcionesGuardadas;
}

// ---------------------------------------------------------------------------
// Consulta

export interface PaginaHistorico {
  id: string;
  titulo: string;
  columnas: ColumnaHistorico[];
  filas: Array<Record<string, unknown>>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function consultar(id: string, query: ConsultaQuery): Promise<PaginaHistorico> {
  const conjunto = exigirConjunto(id);
  const { sql, params } = construir(conjunto, query);
  const n = params.length;
  const offset = (query.page - 1) * query.limit;

  const [pagina, cuenta] = await Promise.all([
    getPool().query<Record<string, unknown>>(
      `SELECT * FROM (${sql}) r ORDER BY ${ordenDe(conjunto, query.orden, query.dir)}
        LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...params, query.limit, offset],
    ),
    getPool().query<{ total: number }>(`SELECT count(*)::int AS total FROM (${sql}) r`, params),
  ]);

  const total = cuenta.rows[0]?.total ?? 0;
  return {
    id: conjunto.id,
    titulo: conjunto.titulo,
    columnas: conjunto.columnas,
    filas: pagina.rows.map((f) => proyectar(f, conjunto.columnas)),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  };
}

// ---------------------------------------------------------------------------
// Resumen

export interface GraficaConDatos extends Omit<GraficaHistorico, 'sql'> {
  datos: Array<Record<string, unknown>>;
}

export interface ResumenHistorico {
  indicadores: Record<string, number | string | null>;
  graficas: GraficaConDatos[];
}

export async function resumen(f: FiltrosResumen): Promise<ResumenHistorico> {
  const [indicadores, ...graficas] = await Promise.all([
    getPool().query<Record<string, number | string | null>>(
      SQL_INDICADORES,
      parametrosResumen(SQL_INDICADORES, f),
    ),
    ...GRAFICAS_HISTORICO.map((g) =>
      getPool().query<Record<string, unknown>>(g.sql, parametrosResumen(g.sql, f)),
    ),
  ]);

  return {
    indicadores: indicadores.rows[0] ?? {},
    graficas: GRAFICAS_HISTORICO.map(({ sql: _sql, ...g }, i) => ({
      ...g,
      datos: graficas[i]?.rows ?? [],
    })),
  };
}

// ---------------------------------------------------------------------------
// Excel

const ORIGEN =
  'Plataforma anterior de Activa Reforce. Copia congelada del 2026-10-01; no recibe datos nuevos.';

/**
 * Una hoja con un conjunto entero: cabecera en negrita, fija, con autofiltro
 * para que en Excel se pueda filtrar y ordenar cualquier columna.
 */
async function escribirHoja(
  libro: ExcelJS.stream.xlsx.WorkbookWriter,
  nombre: string,
  conjunto: Conjunto,
  filtros: FiltrosHistorico,
  orden: string,
): Promise<number> {
  const { sql, params } = construir(conjunto, filtros);
  const { rows } = await getPool().query<Record<string, unknown>>(
    `SELECT * FROM (${sql}) r ORDER BY ${orden} LIMIT $${params.length + 1}`,
    [...params, TOPE_EXPORTACION],
  );

  // `views` va en las opciones: en el escritor en streaming no se puede asignar después.
  const hoja = libro.addWorksheet(nombre.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.columns = conjunto.columnas.map((c) => ({ header: c.cabecera, key: c.clave, width: c.ancho }));
  hoja.getRow(1).font = { bold: true };
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: conjunto.columnas.length } };

  for (const fila of rows) hoja.addRow(proyectar(fila, conjunto.columnas)).commit();
  if (rows.length === TOPE_EXPORTACION) {
    hoja.addRow([`Cortado en el tope de ${TOPE_EXPORTACION} filas. Acota los filtros.`]).commit();
  }
  hoja.commit();
  return rows.length;
}

function hojaDeInformacion(
  libro: ExcelJS.stream.xlsx.WorkbookWriter,
  lineas: Array<[string, string]>,
): void {
  const hoja = libro.addWorksheet('Información');
  hoja.columns = [
    { header: 'Campo', key: 'campo', width: 26 },
    { header: 'Valor', key: 'valor', width: 70 },
  ];
  hoja.getRow(1).font = { bold: true };
  for (const [campo, valor] of lineas) hoja.addRow({ campo, valor }).commit();
  hoja.commit();
}

function nuevoLibro(destino: Writable): ExcelJS.stream.xlsx.WorkbookWriter {
  const libro = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: destino, useStyles: true });
  libro.creator = 'Activa Reforce — PVCAR';
  libro.created = new Date();
  return libro;
}

const generado = () => `${ahoraEc()} (hora de Ecuador)`;

/**
 * Un conjunto, con los filtros de pantalla, en xlsx y en streaming.
 *
 * Lo que se ve es lo que se baja: mismos filtros y mismo orden que la tabla,
 * pero sin paginar. Una sola hoja: la de "Información" (campo/valor con los
 * filtros) se quitó el 2026-10-07 a pedido del cliente, que no la usaba.
 */
export async function exportar(
  actor: AuthUser,
  id: string,
  body: ExportacionBody,
  destino: Writable,
): Promise<number> {
  const conjunto = exigirConjunto(id);
  const libro = nuevoLibro(destino);
  const filas = await escribirHoja(libro, conjunto.titulo, conjunto, body, ordenDe(conjunto, body.orden, body.dir));
  await libro.commit();

  await auditar({
    actor,
    accion: 'crear',
    entidad: 'historico_exportacion',
    entidadId: conjunto.id,
    detalle: { conjunto: conjunto.titulo, filas, filtros: { ...body } },
  });
  return filas;
}

/**
 * Todo `archivo` en un solo libro: una hoja por conjunto, sin filtros.
 *
 * Es la copia "para guardar": lo que había en la plataforma vieja, legible en
 * Excel sin tener que restaurar un volcado de Postgres.
 */
export async function exportarTodo(actor: AuthUser, destino: Writable): Promise<number> {
  const libro = nuevoLibro(destino);
  const conteo: Array<[string, string]> = [];
  let total = 0;

  for (const conjunto of CONJUNTOS) {
    const filas = await escribirHoja(libro, conjunto.titulo, conjunto, {}, conjunto.ordenDefecto);
    conteo.push([conjunto.titulo, `${filas} filas`]);
    total += filas;
  }

  hojaDeInformacion(libro, [
    ['Origen', ORIGEN],
    ['Contenido', 'Todos los conjuntos de Data anterior, sin filtros. Una hoja por conjunto.'],
    ['Generado', generado()],
    ['Generado por', actor.usuario.usu_nombre],
    ['Filas en total', String(total)],
    ...conteo,
    [
      'Lo que no está',
      'Contraseñas, información de salud y notas libres de los alumnos, cédula de los alumnos y fotos. ' +
        'Se quedaron solo en el respaldo completo, fuera de la plataforma.',
    ],
  ]);
  await libro.commit();

  await auditar({
    actor,
    accion: 'crear',
    entidad: 'historico_exportacion',
    entidadId: 'todo',
    detalle: { conjuntos: CONJUNTOS.length, filas: total },
  });
  return total;
}
