import type { Writable } from 'node:stream';
import ExcelJS from 'exceljs';
import { getPool } from '../../config/db.js';
import { alcanceDe } from '../../lib/alcance.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import {
  DEFINICIONES,
  definicionDe,
  type Columna,
  type ContextoReporte,
  type Definicion,
  type FiltrosReporte,
} from './reportes.definiciones.js';
import type { ConsultaQuery, FiltrosQuery } from './reportes.schemas.js';

/**
 * Reportes.
 *
 * Tres cosas y ninguna vive ya en el navegador: **qué reportes puede ver cada
 * quien**, **la consulta con su alcance** y **la generación del xlsx**.
 *
 * El sistema viejo hacía las tres en el cliente: se traía las filas con la
 * anon key, las cruzaba en memoria y armaba la hoja con SheetJS. Exportar la
 * asistencia de un año significaba descargar 13 202 filas al teléfono de quien
 * pulsara el botón.
 */

/** Tope de filas de una exportación. Con 14 080 asistencias hoy, sobra. */
const TOPE_EXPORTACION = 50_000;

export interface ReporteDisponible {
  id: string;
  titulo: string;
  descripcion: string;
  exigeRango: boolean;
  columnas: Columna[];
}

function puedeVer(actor: AuthUser, definicion: Definicion): boolean {
  return actor.permisos.some((p) => p.modulo === definicion.modulo && p.accion === 'ver');
}

/**
 * Los reportes que esta persona puede abrir.
 *
 * Hace falta `reportes:ver` —que lo comprueba la ruta— **y** el `ver` del
 * módulo de origen. Un entrenador tiene `reportes:ver`, pero no `usuarios:ver`:
 * no debe poder exportar el listado de personas.
 */
export function catalogo(actor: AuthUser): ReporteDisponible[] {
  return DEFINICIONES.filter((d) => puedeVer(actor, d)).map((d) => ({
    id: d.id,
    titulo: d.titulo,
    descripcion: d.descripcion,
    exigeRango: d.exigeRango,
    columnas: d.columnas,
  }));
}

function exigirDefinicion(actor: AuthUser, id: string): Definicion {
  const definicion = definicionDe(id);
  if (!definicion) throw new ApiError(404, 'Ese reporte no existe');
  if (!puedeVer(actor, definicion)) {
    throw new ApiError(403, `Sin permiso: ${definicion.modulo}:ver`);
  }
  return definicion;
}

/**
 * Un reporte de asistencia sin rango no es un reporte, es un volcado.
 *
 * El sistema viejo dejaba exportar la tabla entera sin fechas y por eso los
 * informes de asistencia tardaban lo que tardaban.
 */
function exigirRango(definicion: Definicion, filtros: FiltrosQuery): FiltrosReporte {
  if (definicion.exigeRango && (!filtros.desde || !filtros.hasta)) {
    throw new ApiError(400, `El reporte "${definicion.titulo}" necesita un rango de fechas`);
  }
  return filtros;
}

async function contextoDe(actor: AuthUser): Promise<ContextoReporte> {
  const alcance = await alcanceDe(actor.usuario);
  return {
    global: alcance.global,
    colegios: alcance.colegios,
    disciplinas: alcance.disciplinas,
    actorId: actor.usuario.usu_id,
  };
}

/**
 * Deja en cada fila **solo las columnas declaradas**.
 *
 * Además de garantizar que lo que se ve en pantalla y lo que va al Excel son
 * exactamente las mismas columnas, evita que una columna auxiliar de la
 * consulta —como el `_orden` del UNION de asistencias— se escape en el JSON.
 */
function proyectar(fila: Record<string, unknown>, columnas: Columna[]): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const columna of columnas) salida[columna.clave] = fila[columna.clave] ?? '';
  return salida;
}

export interface PaginaReporte {
  id: string;
  titulo: string;
  columnas: Columna[];
  filas: Array<Record<string, unknown>>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function ejecutar(
  actor: AuthUser,
  id: string,
  query: ConsultaQuery,
): Promise<PaginaReporte> {
  const definicion = exigirDefinicion(actor, id);
  const filtros = exigirRango(definicion, query);
  const { sql, params } = definicion.construir(filtros, await contextoDe(actor));

  const offset = (query.page - 1) * query.limit;
  const n = params.length;

  const [pagina, cuenta] = await Promise.all([
    getPool().query<Record<string, unknown>>(
      `SELECT * FROM (${sql}) r LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...params, query.limit, offset],
    ),
    getPool().query<{ total: string }>(`SELECT count(*) AS total FROM (${sql}) r`, params),
  ]);

  const total = Number(cuenta.rows[0]?.total ?? 0);

  return {
    id: definicion.id,
    titulo: definicion.titulo,
    columnas: definicion.columnas,
    filas: pagina.rows.map((f) => proyectar(f, definicion.columnas)),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  };
}

export interface Exportacion {
  nombreArchivo: string;
  filas: number;
}

/**
 * Genera el xlsx **en streaming**.
 *
 * `WorkbookWriter` escribe la hoja fila a fila directamente en la respuesta,
 * así que el servidor nunca tiene el archivo entero en memoria. Es lo que
 * permite exportar decenas de miles de filas desde un contenedor pequeño.
 *
 * La primera hoja lleva los datos; **la segunda, los filtros con los que se
 * sacó**. Sin eso, dos Excel del mismo reporte son indistinguibles y nadie
 * sabe cuál mirar tres semanas después — que es justo lo que pasa hoy.
 */
export async function exportar(
  actor: AuthUser,
  id: string,
  filtrosQuery: FiltrosQuery,
  destino: Writable,
): Promise<Exportacion> {
  const definicion = exigirDefinicion(actor, id);
  const filtros = exigirRango(definicion, filtrosQuery);
  const { sql, params } = definicion.construir(filtros, await contextoDe(actor));

  const libro = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: destino,
    useStyles: true,
  });
  libro.creator = 'Activa Reforce — PVCAR';
  libro.created = new Date();

  const hoja = libro.addWorksheet(definicion.titulo.slice(0, 31));
  hoja.columns = definicion.columnas.map((c) => ({
    header: c.cabecera,
    key: c.clave,
    width: c.ancho,
  }));
  hoja.getRow(1).font = { bold: true };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  const { rows } = await getPool().query<Record<string, unknown>>(
    `SELECT * FROM (${sql}) r LIMIT $${params.length + 1}`,
    [...params, TOPE_EXPORTACION],
  );

  for (const fila of rows) {
    hoja.addRow(proyectar(fila, definicion.columnas)).commit();
  }
  hoja.commit();

  const portada = libro.addWorksheet('Filtros');
  portada.columns = [
    { header: 'Campo', key: 'campo', width: 24 },
    { header: 'Valor', key: 'valor', width: 50 },
  ];
  portada.getRow(1).font = { bold: true };

  const lineas: Array<[string, string]> = [
    ['Reporte', definicion.titulo],
    ['Generado', new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'],
    ['Generado por', actor.usuario.usu_nombre],
    ['Filas', String(rows.length)],
    ['Texto buscado', filtros.buscar ?? '—'],
    ['Colegios', filtros.colegio?.join(', ') ?? 'Todos los de tu alcance'],
    ['Disciplina', filtros.disciplina ? String(filtros.disciplina) : 'Todas'],
    ['Estado', filtros.estado ? String(filtros.estado) : 'Todos'],
    ['Desde', filtros.desde ?? '—'],
    ['Hasta', filtros.hasta ?? '—'],
  ];
  if (rows.length === TOPE_EXPORTACION) {
    lineas.push(['Aviso', `Cortado en el tope de ${TOPE_EXPORTACION} filas. Acota el rango.`]);
  }
  for (const [campo, valor] of lineas) portada.addRow({ campo, valor }).commit();
  portada.commit();

  await libro.commit();

  const sello = new Date().toISOString().slice(0, 10);
  return { nombreArchivo: `${definicion.id}-${sello}.xlsx`, filas: rows.length };
}
