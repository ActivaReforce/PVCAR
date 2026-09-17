import type { Writable } from 'node:stream';
import ExcelJS from 'exceljs';
import { getPool } from '../../config/db.js';
import { alcanceDe } from '../../lib/alcance.js';
import { auditar } from '../../lib/auditoria.js';
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
import { GRAFICAS, type DefinicionGrafica, type FormaGrafica, type SerieGrafica } from './reportes.analisis.js';
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
  /** Cuántas gráficas tiene su pestaña de análisis. 0 = no tiene. */
  graficas: number;
  /** Columnas que solo salen si se piden. Vacío en casi todos. */
  columnasSensibles: Columna[];
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
    columnas: columnasVisibles(d, false),
    graficas: (GRAFICAS[d.id] ?? []).length,
    columnasSensibles: d.columnas.filter((c) => (d.columnasSensibles ?? []).includes(c.clave)),
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

/**
 * Las columnas que salen esta vez.
 *
 * Las sensibles se caen salvo que se pidan. La consulta no cambia —sigue
 * trayendo la columna— porque quitarla del SQL obligaría a construir la
 * consulta dos veces; lo que se recorta es lo que se enseña y lo que se
 * exporta, que es donde está el riesgo.
 */
function columnasVisibles(definicion: Definicion, incluirSensibles: boolean): Columna[] {
  const sensibles = definicion.columnasSensibles ?? [];
  if (sensibles.length === 0 || incluirSensibles) return definicion.columnas;
  return definicion.columnas.filter((c) => !sensibles.includes(c.clave));
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
  const columnas = columnasVisibles(definicion, query.incluirSensibles === true);

  return {
    id: definicion.id,
    titulo: definicion.titulo,
    columnas,
    filas: pagina.rows.map((f) => proyectar(f, columnas)),
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

  const conSensibles = filtrosQuery.incluirSensibles === true;
  const columnas = columnasVisibles(definicion, conSensibles);

  const hoja = libro.addWorksheet(definicion.titulo.slice(0, 31));
  hoja.columns = columnas.map((c) => ({
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
    hoja.addRow(proyectar(fila, columnas)).commit();
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
    [
      'Columnas sensibles',
      (definicion.columnasSensibles ?? []).length === 0
        ? 'El reporte no tiene'
        : conSensibles
          ? 'INCLUIDAS'
          : 'Excluidas',
    ],
  ];
  if (rows.length === TOPE_EXPORTACION) {
    lineas.push(['Aviso', `Cortado en el tope de ${TOPE_EXPORTACION} filas. Acota el rango.`]);
  }
  for (const [campo, valor] of lineas) portada.addRow({ campo, valor }).commit();
  portada.commit();

  await libro.commit();

  /**
   * Sacar datos sensibles queda registrado. No es desconfianza: es que un
   * Excel con información médica de menores se reenvía, y dentro de un año
   * hay que poder decir quién lo generó y con qué filtros.
   */
  if (conSensibles && (definicion.columnasSensibles ?? []).length > 0) {
    await auditar({
      actor,
      accion: 'crear',
      entidad: 'reporte_sensible',
      entidadId: definicion.id,
      detalle: {
        reporte: definicion.titulo,
        columnas: definicion.columnasSensibles,
        filas: rows.length,
        filtros: { ...filtros },
      },
    });
  }

  const sello = new Date().toISOString().slice(0, 10);
  return { nombreArchivo: `${definicion.id}-${sello}.xlsx`, filas: rows.length };
}

// ---------------------------------------------------------------------------
// Análisis

export interface GraficaConDatos {
  id: string;
  titulo: string;
  descripcion: string;
  forma: FormaGrafica;
  etiqueta: string;
  series: SerieGrafica[];
  formato: 'porcentaje' | 'entero';
  escala?: 'asistencia';
  nota?: string;
  datos: Array<Record<string, unknown>>;
}

/**
 * Las gráficas de un reporte, ya con sus datos.
 *
 * Cada una es **una consulta agregada**: lo que viaja son las diez o veinte
 * filas que se van a dibujar, no las 13 202 marcas de asistencia que el sistema
 * viejo se descargaba para contarlas en el navegador.
 *
 * Las consultas van en paralelo —son independientes y de solo lectura— así que
 * la pestaña entera cuesta lo que la más lenta, no la suma.
 */
export async function analisis(
  actor: AuthUser,
  id: string,
  filtrosQuery: FiltrosQuery,
): Promise<GraficaConDatos[]> {
  const definicion = exigirDefinicion(actor, id);
  const filtros = exigirRango(definicion, filtrosQuery);
  const graficas: DefinicionGrafica[] = GRAFICAS[id] ?? [];
  if (graficas.length === 0) return [];

  const contexto = await contextoDe(actor);

  return Promise.all(
    graficas.map(async (g) => {
      const { sql, params } = g.construir(filtros, contexto);
      const { rows } = await getPool().query<Record<string, unknown>>(sql, params);
      return {
        id: g.id,
        titulo: g.titulo,
        descripcion: g.descripcion,
        forma: g.forma,
        etiqueta: g.etiqueta,
        series: g.series,
        formato: g.formato,
        ...(g.escala ? { escala: g.escala } : {}),
        ...(g.nota ? { nota: g.nota } : {}),
        datos: rows,
      };
    }),
  );
}
