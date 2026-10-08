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
import { ahoraEc, hoyEc } from '../../lib/fecha.js';
import { resumenDe, type Bloque } from './reportes.resumen.js';

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
 * Dos hojas: **el Resumen** —ya agrupado y contado, para que nadie trabaje
 * el Excel a mano— y **el detalle**. La cabecera del Resumen dice cuándo y
 * quién lo sacó y el periodo. Hasta el 2026-10-07 había una tercera hoja,
 * "Filtros", en formato campo/valor; el cliente pidió quitarla porque no le
 * decía nada.
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

  /*
   * Las filas se traen antes de abrir ninguna hoja: el Resumen va primero y
   * se calcula sobre ellas. Ya se tenían enteras en memoria igualmente.
   */
  const { rows } = await getPool().query<Record<string, unknown>>(
    `SELECT * FROM (${sql}) r LIMIT $${params.length + 1}`,
    [...params, TOPE_EXPORTACION],
  );

  const cortado = rows.length === TOPE_EXPORTACION;
  const avisos = [`Generado el ${ahoraEc()} (hora de Ecuador) por ${actor.usuario.usu_nombre}.`];
  if (filtros.desde && filtros.hasta) avisos.unshift(`Del ${diaTexto(filtros.desde)} al ${diaTexto(filtros.hasta)}.`);
  if (conSensibles && (definicion.columnasSensibles ?? []).length > 0) {
    avisos.push('Incluye información de salud: dato médico de menores, no reenviar.');
  }
  if (cortado) avisos.push(`Cortado en el tope de ${TOPE_EXPORTACION} filas: acota el rango.`);

  escribirResumen(libro, definicion.titulo, avisos, resumenDe(definicion.id, rows, filtros));

  /*
   * La fila de cabecera fija va en las opciones de `addWorksheet`: en el
   * escritor en streaming `views` solo tiene getter, y asignarlo después lanza
   * un TypeError con las cabeceras ya enviadas — la descarga se cortaba siempre.
   */
  const hoja = libro.addWorksheet(definicion.titulo.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  hoja.columns = columnas.map((c) => ({
    header: c.cabecera,
    key: c.clave,
    width: c.ancho,
  }));
  estiloCabecera(hoja.getRow(1), columnas.length);
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };

  for (const fila of rows) {
    hoja.addRow(proyectar(fila, columnas)).commit();
  }
  hoja.commit();

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

  const sello = hoyEc();
  return { nombreArchivo: `${definicion.id}-${sello}.xlsx`, filas: rows.length };
}

/** `2026-10-07` → `07/10/2026`. */
const diaTexto = (iso: string) => iso.split('-').reverse().join('/');

/*
 * Colores del Excel. Sutiles a propósito: separan sin competir con los datos.
 * Excel no tiene modo oscuro, así que van fijos.
 */
const COLOR = {
  titulo: 'FF1F3864',
  nota: 'FF595959',
  cabecera: 'FFDCE6F1',
  destacada: 'FFF2F2F2',
  borde: 'FFBFBFBF',
} as const;

const relleno = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const linea: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: COLOR.borde } };
const BORDES: Partial<ExcelJS.Borders> = { top: linea, left: linea, bottom: linea, right: linea };

/** Cabecera de tabla: negrita, fondo azul pálido y bordes en sus `ancho` celdas. */
function estiloCabecera(fila: ExcelJS.Row, ancho: number): void {
  fila.font = { bold: true };
  for (let i = 1; i <= ancho; i++) {
    const celda = fila.getCell(i);
    celda.fill = relleno(COLOR.cabecera);
    celda.border = BORDES;
    celda.alignment = { vertical: 'middle', wrapText: true };
  }
}

/**
 * Escribe los bloques del Resumen uno debajo de otro: título, nota, tabla con
 * bordes y un renglón en blanco. Las filas destacadas (totales, el nombre de
 * cada persona en ej1, el título de cada disciplina en ej2) van en negrita y
 * sombreadas. El ancho de cada columna es el del texto más largo que cae en
 * ella, con tope para que una lista de nombres no la estire de más.
 */
function escribirResumen(
  libro: ExcelJS.stream.xlsx.WorkbookWriter,
  titulo: string,
  avisos: string[],
  bloques: Bloque[],
): void {
  const hoja = libro.addWorksheet('Resumen', { views: [{ showGridLines: false }] });

  const anchos: number[] = [];
  for (const b of bloques) {
    for (const fila of [b.cabeceras, ...b.filas.filter((f) => f.length > 1)]) {
      fila.forEach((celda, i) => {
        anchos[i] = Math.min(Math.max(anchos[i] ?? 10, String(celda).length + 2), 45);
      });
    }
  }
  anchos[0] = Math.max(anchos[0] ?? 10, 30);
  hoja.columns = anchos.map((width) => ({ width }));

  const texto = (valor: string, font: Partial<ExcelJS.Font>) => {
    const fila = hoja.addRow([valor]);
    fila.font = font;
    fila.commit();
  };

  texto(`Resumen — ${titulo}`, { bold: true, size: 14, color: { argb: COLOR.titulo } });
  for (const aviso of avisos) texto(aviso, { color: { argb: COLOR.nota } });
  texto('El detalle fila por fila está en la hoja siguiente.', { color: { argb: COLOR.nota } });
  hoja.addRow([]).commit();

  if (bloques.length === 0) texto('Sin datos con estos filtros.', { italic: true });

  for (const b of bloques) {
    const ancho = b.cabeceras.length;
    texto(b.titulo, { bold: true, size: 12, color: { argb: COLOR.titulo } });
    if (b.nota) texto(b.nota, { italic: true, color: { argb: COLOR.nota } });

    const cabecera = hoja.addRow(b.cabeceras);
    estiloCabecera(cabecera, ancho);
    cabecera.commit();

    const destacadas = new Set(b.destacadas);
    b.filas.forEach((valores, i) => {
      const fila = hoja.addRow(valores);
      // Un renglón vacío dentro de la tabla separa grupos: sin bordes.
      if (valores.length > 0) {
        const marcada = destacadas.has(i);
        if (marcada) fila.font = { bold: true };
        for (let c = 1; c <= ancho; c++) {
          const celda = fila.getCell(c);
          celda.border = BORDES;
          if (marcada) celda.fill = relleno(COLOR.destacada);
        }
      }
      fila.commit();
    });
    hoja.addRow([]).commit();
  }
  hoja.commit();
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
