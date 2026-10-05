import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getSupabaseAdmin } from '../../config/supabase.js';
import { frontendBaseUrl } from '../../config/env.js';
import { ApiError } from '../../middleware/error.js';
import type { AuthUser } from '../../middleware/auth.js';
import { auditar } from '../../lib/auditoria.js';
import { ESTADO } from '../../lib/constants.js';
import { enTransaccion } from '../../lib/tx.js';
import { armarPagina, type Pagina } from '../../lib/paginacion.js';
import { enviarCorreo, escaparHtml } from '../../lib/correo.js';
import {
  MIME_COMPROBANTE,
  borrarArchivos,
  descargarArchivo,
  firmarArchivos,
  firmarDescarga,
  subirArchivo,
} from '../../lib/storageInscripciones.js';
import * as usuariosRepo from '../usuarios/usuarios.repository.js';
import * as estudiantesRepo from '../estudiantes/estudiantes.repository.js';
import * as repo from './inscripciones.repository.js';
import {
  MARCADORES,
  NOMBRE_DOCUMENTO,
  REGLAS,
  TIPOS_DOCUMENTO,
  generarPaquete,
  problemasDePlantilla,
  respuestaDe,
  sha256,
  textoRellenado,
  type Constancia,
  type DatosPaquete,
  type DocumentoDelPaquete,
  type TipoDocumento,
} from './inscripciones.documentos.js';
import { PLANTILLAS_INICIALES } from './inscripciones.plantillas.js';
import { IVA_PCT, calcularCobro, type Cobro, type CobroAlumno } from './inscripciones.precios.js';
import {
  BYTES_MAX_MEMBRETE,
  PARENTESCOS,
  type EnvioInscripcion,
  type ListarInscripcionesQuery,
  type RepresentanteFormulario,
} from './inscripciones.schemas.js';

/**
 * Inscripciones (Fase 14B). Diseno en docs/fase14b-inscripciones.md y, para
 * los documentos, docs/fase14b-contratos.md.
 *
 *   formulario publico ──enviar──▶ pendiente ──aprobar──▶ aprobada
 *                                      │                  (nacen usuario,
 *                                      └──rechazar──▶ ∅    nino y altas)
 *
 * Mientras esta pendiente nada sale de las tablas de inscripcion, asi que
 * ningun otro modulo (listas, asistencias, reportes) puede ver a un alumno
 * sin pago aprobado. Rechazar es borrar.
 *
 * Cada alumno firma seis documentos (ficha, contrato y los cuatro "00"). De
 * cada uno queda una constancia en `inscripcion_aceptacion` y todos van en
 * un PDF por alumno, con una hoja final de constancias.
 */

type DisciplinaConEstado = Awaited<ReturnType<typeof repo.disciplinasPorId>>[number];

export function describirDisciplina(d: {
  actividad: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
}): string {
  return `${d.actividad} — ${d.dia} ${d.hora_inicio} a ${d.hora_fin}`;
}

/**
 * Comprueba que cada disciplina pedida exista, este activa y sea del colegio
 * del alumno. Se usa dos veces: al recibir el envio y al aprobar, porque
 * entre una cosa y otra pueden pasar dias y alguien pudo dar de baja una.
 */
export function problemasDeDisciplinas(
  ninos: Array<{ nombre: string; col_id: number; disciplinas: number[] }>,
  encontradas: Map<number, DisciplinaConEstado>,
): string[] {
  const problemas: string[] = [];
  for (const nino of ninos) {
    for (const id of nino.disciplinas) {
      const d = encontradas.get(id);
      if (!d) {
        problemas.push(`${nino.nombre}: una de las disciplinas ya no existe`);
      } else if (d.est_id !== ESTADO.ACTIVO) {
        problemas.push(`${nino.nombre}: ${describirDisciplina(d)} ya no está abierta`);
      } else if (d.col_id !== nino.col_id) {
        problemas.push(`${nino.nombre}: ${describirDisciplina(d)} no es de su colegio`);
      }
    }
  }
  return problemas;
}

/** Los primeros bytes del archivo tienen que decir lo mismo que el tipo declarado. */
export function firmaDeImagenValida(contenido: Buffer, mime: string): boolean {
  if (mime === 'image/jpeg') {
    return contenido.length > 3 && contenido[0] === 0xff && contenido[1] === 0xd8 && contenido[2] === 0xff;
  }
  if (mime === 'image/png') {
    return contenido.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mime === 'image/webp') {
    return (
      contenido.subarray(0, 4).toString('ascii') === 'RIFF' &&
      contenido.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

function normalizarNombre(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Membrete

/** El de los Word del cliente. Sirve hasta que el admin suba otro. */
const MEMBRETE_DE_SERIE = fileURLToPath(new URL('../../../assets/membrete.png', import.meta.url));

let membreteEnCache: { ruta: string | null; contenido: Buffer | null } | null = null;

/** El membrete vigente. Se cachea por ruta: cambiarlo cambia la ruta. */
async function membreteActual(): Promise<Buffer | null> {
  const { membrete } = await repo.obtenerConfig();
  if (membreteEnCache && membreteEnCache.ruta === membrete) return membreteEnCache.contenido;
  const contenido = membrete
    ? await descargarArchivo(membrete)
    : await readFile(MEMBRETE_DE_SERIE).catch((err: unknown) => {
        console.error('No se encontro el membrete de serie:', err);
        return null;
      });
  membreteEnCache = { ruta: membrete, contenido };
  return contenido;
}

// ---------------------------------------------------------------------------
// Armado de los documentos

/** Con qué se llenan los documentos de un alumno. Lo usan enviar, aprobar y la ficha. */
export function datosDelPaquete(
  rep: RepresentanteFormulario,
  nino: repo.NinoGuardado,
  cobro: CobroAlumno,
  meta: {
    fecha: Date;
    insId: number | null;
    ip: string | null;
    navegador: string | null;
    aprobacion?: { nombre: string; fecha: Date } | null;
  },
): DatosPaquete {
  return {
    fecha: meta.fecha,
    insId: meta.insId,
    ip: meta.ip,
    navegador: meta.navegador,
    representante: {
      nombre: rep.nombre,
      cedula: rep.cedula,
      correo: rep.correo,
      telefono: rep.telefono,
      factura: rep.factura,
    },
    alumno: {
      nombre: nino.nombre,
      fecha_nacimiento: nino.fecha_nacimiento,
      curso: nino.documento.curso,
      actividades: nino.documento.actividades,
      horarios: nino.documento.horarios,
      modalidad_salida: nino.modalidad_salida,
      detalle_retiro: nino.detalle_retiro,
      emergencia: nino.emergencia,
      retiro: nino.retiro,
      salud: nino.salud,
      imagen: nino.imagen,
    },
    colegio: nino.documento.colegio,
    aplicaDescuento: cobro.descuento_pct > 0,
    aprobacion: meta.aprobacion ?? null,
  };
}

/** Lo que marcó en cada documento, tal como se guarda en la constancia. */
export function opcionesDe(tipo: TipoDocumento, nino: repo.NinoGuardado): Record<string, unknown> {
  switch (tipo) {
    case 'autorizacion_datos':
      return { acepta: true };
    case 'datos_medicos':
      return { tiene: nino.salud.tiene, autoriza: nino.salud.autoriza };
    case 'imagen':
      return { ...nino.imagen };
    default:
      return { acepta: true };
  }
}

interface DocumentoVigente {
  doc_id: number;
  tipo: TipoDocumento;
  titulo: string;
  contenido: string;
  version: number;
}

/** Los seis textos rellenados de un alumno, con su huella, y su PDF. */
async function armarPaquete(
  documentos: DocumentoVigente[],
  datos: DatosPaquete,
  membrete: Buffer | null,
): Promise<{
  pdf: Buffer;
  sha256: string;
  huellas: Array<{ doc_id: number; tipo: TipoDocumento; sha256: string }>;
}> {
  const huellas = documentos.map((d) => ({
    doc_id: d.doc_id,
    tipo: d.tipo,
    sha256: sha256(textoRellenado(d.tipo, d.titulo, d.contenido, datos)),
  }));
  const constancias: Constancia[] = documentos.map((d, i) => ({
    tipo: d.tipo,
    version: d.version,
    sha256: huellas[i]!.sha256,
    respuesta: respuestaDe(d.tipo, datos),
  }));
  const paquete: DocumentoDelPaquete[] = documentos.map((d) => ({
    tipo: d.tipo,
    titulo: d.titulo,
    contenido: d.contenido,
    version: d.version,
  }));
  const { pdf, sha256: huella } = await generarPaquete({
    documentos: paquete,
    datos,
    constancias,
    membrete,
  });
  return { pdf, sha256: huella, huellas };
}

// ---------------------------------------------------------------------------
// Publico

export interface Formulario {
  /** false si falta publicar alguno de los seis documentos: el formulario no se abre. */
  disponible: boolean;
  colegios: repo.ColegioOfertado[];
  grados: repo.GradoOfertado[];
  parentescos: readonly string[];
  documentos: Partial<Record<TipoDocumento, repo.DocumentoLegal>>;
  /** A dónde transferir el pago: lo escribe Activa en Configuración. */
  cuenta_bancaria: string | null;
}

// ---------------------------------------------------------------------------
// Abiertas o cerradas (0018)

/** Iguales para cualquier colegio. */
export const TIPOS_GENERALES: TipoDocumento[] = ['autorizacion_datos', 'datos_medicos', 'imagen', 'politica'];
/** Texto común, llenado con los datos de cada colegio. */
export const TIPOS_POR_COLEGIO: TipoDocumento[] = ['ficha_matricula', 'contrato'];

export interface EstadoColegio {
  col_id: number;
  col_nombre: string;
  /** Abierto de verdad: interruptor encendido y todo lo necesario listo. */
  abierto: boolean;
  /** Lo que eligió el admin. */
  interruptor: boolean;
  /** Por qué está cerrado, en frases. Vacío si está abierto. */
  motivos: string[];
}

export interface EstadoInscripciones {
  abiertas: boolean;
  interruptor: boolean;
  motivos: string[];
  colegios: EstadoColegio[];
}

/**
 * Reglas del cliente (2026-10-05). Un colegio está abierto si su interruptor
 * está encendido, la ficha y el contrato están publicados, tiene sus valores
 * y al menos una disciplina activa. Las inscripciones están abiertas si el
 * interruptor general está encendido, los cuatro generales están publicados
 * y hay al menos un colegio abierto.
 */
export function calcularEstado(
  publicados: Set<TipoDocumento>,
  interruptor: boolean,
  colegios: Array<{
    col_id: number;
    col_nombre: string;
    precio: number | null;
    abierta: boolean | null;
    disciplinas_activas: number;
  }>,
): EstadoInscripciones {
  const faltan = (tipos: TipoDocumento[]) => tipos.filter((t) => !publicados.has(t));
  const faltanColegio = faltan(TIPOS_POR_COLEGIO);
  const estados = colegios.map((c): EstadoColegio => {
    const motivos: string[] = [];
    if (c.precio === null) motivos.push('Faltan los valores del colegio.');
    if (c.disciplinas_activas === 0) motivos.push('No tiene disciplinas activas.');
    if (faltanColegio.length > 0) {
      motivos.push(`Falta publicar: ${faltanColegio.map((t) => NOMBRE_DOCUMENTO[t]).join(', ')}.`);
    }
    if (!c.abierta) motivos.push('Las inscripciones de este colegio están cerradas.');
    return {
      col_id: c.col_id,
      col_nombre: c.col_nombre,
      abierto: motivos.length === 0,
      interruptor: c.abierta === true,
      motivos,
    };
  });

  const motivos: string[] = [];
  if (!interruptor) motivos.push('Están cerradas a mano.');
  const faltanGenerales = faltan(TIPOS_GENERALES);
  if (faltanGenerales.length > 0) {
    motivos.push(`Falta publicar: ${faltanGenerales.map((t) => NOMBRE_DOCUMENTO[t]).join(', ')}.`);
  }
  if (!estados.some((e) => e.abierto)) motivos.push('Ningún colegio tiene las inscripciones abiertas.');
  return { abiertas: motivos.length === 0, interruptor, motivos, colegios: estados };
}

export async function estado(): Promise<EstadoInscripciones> {
  const [vigentes, config, colegios] = await Promise.all([
    repo.documentosVigentes(),
    repo.obtenerConfig(),
    repo.listarPrecios(),
  ]);
  return calcularEstado(new Set(vigentes.map((v) => v.doc_tipo)), config.abiertas, colegios);
}

export async function abrirInscripciones(actor: AuthUser, abiertas: boolean): Promise<EstadoInscripciones> {
  await enTransaccion(async (client) => {
    await repo.guardarAbiertas(client, abiertas);
    await auditar(
      { actor, accion: 'editar', entidad: 'inscripcion_config', entidadId: 1, detalle: { abiertas } },
      client,
    );
  });
  return estado();
}

export async function abrirColegio(
  actor: AuthUser,
  colId: number,
  abierta: boolean,
): Promise<EstadoInscripciones> {
  await enTransaccion(async (client) => {
    if (!(await repo.guardarAbiertaColegio(client, colId, abierta))) {
      throw new ApiError(409, 'Primero guarda los valores del colegio.');
    }
    await auditar(
      { actor, accion: 'editar', entidad: 'colegio_precio', entidadId: colId, detalle: { abierta } },
      client,
    );
  });
  return estado();
}

export async function formulario(): Promise<Formulario> {
  const [oferta, grados, vigentes, situacion, config] = await Promise.all([
    repo.ofertaPublica(),
    repo.grados(),
    repo.documentosVigentes(),
    estado(),
    repo.obtenerConfig(),
  ]);
  const documentos: Partial<Record<TipoDocumento, repo.DocumentoLegal>> = {};
  for (const doc of vigentes) documentos[doc.doc_tipo] = doc;
  const abiertos = new Set(situacion.colegios.filter((c) => c.abierto).map((c) => c.col_id));
  const colegios = situacion.abiertas ? oferta.filter((c) => abiertos.has(c.col_id)) : [];

  return {
    disponible: situacion.abiertas && colegios.length > 0,
    colegios,
    grados,
    parentescos: PARENTESCOS,
    documentos,
    cuenta_bancaria: config.cuenta_bancaria,
  };
}

/**
 * Cuanto se paga. Lo calcula siempre el backend, con los precios de la base:
 * lo que diga el navegador no cuenta. Lo usan el formulario (para ensenar el
 * total antes del comprobante) y el envio (para congelarlo en el contrato).
 */
async function cobroDe(
  ninos: Array<{ nombre: string; col_id: number; disciplinas: number[] }>,
): Promise<{
  cobro: Cobro;
  encontradas: Map<number, DisciplinaConEstado>;
  precios: Map<number, repo.PrecioConDocumento>;
}> {
  const ids = [...new Set(ninos.flatMap((n) => n.disciplinas))];
  const encontradas = new Map((await repo.disciplinasPorId(ids)).map((d) => [d.colacthor_id, d]));
  const problemas = problemasDeDisciplinas(ninos, encontradas);
  if (problemas.length > 0) {
    throw new ApiError(409, 'Alguna disciplina elegida ya no está disponible. Recarga la página.', {
      problemas,
    });
  }

  const precios = await repo.preciosDe([...new Set(ninos.map((n) => n.col_id))]);
  const sinPrecio = ninos.filter((n) => !precios.has(n.col_id));
  if (sinPrecio.length > 0) {
    throw new ApiError(409, 'Uno de los colegios elegidos todavía no tiene precio. Recarga la página.', {
      problemas: sinPrecio.map((n) => `${n.nombre}: su colegio no tiene precio configurado`),
    });
  }

  const cobro = calcularCobro(
    ninos.map((n) => ({ colId: n.col_id, disciplinas: n.disciplinas.length })),
    precios,
    IVA_PCT,
  );
  return { cobro, encontradas, precios };
}

export async function cotizar(
  ninos: Array<{ col_id: number; disciplinas: number[] }>,
): Promise<Cobro> {
  const { cobro } = await cobroDe(ninos.map((n, i) => ({ ...n, nombre: `Alumno ${i + 1}` })));
  return cobro;
}

/** Actividades sin repetir y horarios, en el orden en que se eligieron. */
export function actividadesYHorarios(disciplinas: DisciplinaConEstado[]): {
  actividades: string[];
  horarios: string[];
} {
  return {
    actividades: [...new Set(disciplinas.map((d) => d.actividad))],
    horarios: disciplinas.map((d) => `${d.actividad}: ${d.dia} ${d.hora_inicio} a ${d.hora_fin}`),
  };
}

/** "Martín Pérez" → "ActivaReforce_Martin_Perez.pdf": sin tildes ni espacios, que algunos sistemas estropean. */
export function nombreDeDescarga(alumno: string): string {
  const limpio = alumno
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `ActivaReforce_${limpio || 'alumno'}.pdf`;
}

export interface EnvioRecibido {
  ins_id: number;
  total: number;
  paquetes: Array<{ alumno: string; url: string | null }>;
}

export async function enviar(
  input: EnvioInscripcion,
  meta: { ip: string | null; navegador: string | null },
): Promise<EnvioRecibido> {
  const situacion = await estado();
  if (!situacion.abiertas) throw new ApiError(503, 'Las inscripciones están cerradas.');
  const abiertos = new Set(situacion.colegios.filter((c) => c.abierto).map((c) => c.col_id));
  if (input.ninos.some((n) => !abiertos.has(n.col_id))) {
    throw new ApiError(409, 'Las inscripciones de uno de los colegios elegidos se cerraron. Recarga la página.');
  }

  const vigentes = await repo.documentosVigentes();
  const documentos: DocumentoVigente[] = [];
  for (const tipo of TIPOS_DOCUMENTO) {
    const d = vigentes.find((v) => v.doc_tipo === tipo);
    if (!d) throw new ApiError(503, 'Las inscripciones no están abiertas todavía.');
    if (input.documentos[tipo] !== d.doc_id) {
      throw new ApiError(
        409,
        'Alguno de los documentos se actualizó mientras llenabas el formulario. Recarga la página y vuelve a leerlos antes de aceptar.',
      );
    }
    documentos.push({
      doc_id: d.doc_id,
      tipo,
      titulo: d.doc_titulo,
      contenido: d.doc_contenido,
      version: d.doc_version,
    });
  }

  const { cobro, encontradas, precios } = await cobroDe(input.ninos);

  const comprobante = Buffer.from(input.comprobante.base64, 'base64');
  if (comprobante.length > 2 * 1024 * 1024) {
    throw new ApiError(400, 'El comprobante pesa más de 2 MB.');
  }
  if (!firmaDeImagenValida(comprobante, input.comprobante.mime)) {
    throw new ApiError(400, 'El comprobante no es una imagen válida.');
  }

  const grados = await repo.nombresDeGrados(input.ninos.map((n) => n.catninograd_id));
  const fecha = new Date();
  const membrete = await membreteActual();

  // Lo que se guarda de cada alumno lleva una foto de lo que el sistema puso
  // en sus documentos: así se regeneran idénticos al aprobar.
  const guardados: repo.NinoGuardado[] = input.ninos.map(({ disciplinas, ...nino }) => ({
    ...nino,
    documento: {
      colegio: precios.get(nino.col_id)!.documento,
      curso: grados.get(nino.catninograd_id) ?? null,
      ...actividadesYHorarios(disciplinas.map((id) => encontradas.get(id)!)),
    },
  }));

  // Los PDF se generan antes de tocar nada: si uno falla, no queda nada subido.
  const paquetes: Array<Awaited<ReturnType<typeof armarPaquete>>> = [];
  for (const [i, nino] of guardados.entries()) {
    const datos = datosDelPaquete(input.representante, nino, cobro.alumnos[i]!, {
      fecha,
      insId: null,
      ...meta,
    });
    paquetes.push(await armarPaquete(documentos, datos, membrete));
  }

  const subidos: string[] = [];
  try {
    const rutaComprobante = await subirArchivo(
      'comprobantes',
      comprobante,
      input.comprobante.mime,
      MIME_COMPROBANTE[input.comprobante.mime]!,
    );
    subidos.push(rutaComprobante);

    const rutas: string[] = [];
    for (const p of paquetes) {
      const ruta = await subirArchivo('contratos', p.pdf, 'application/pdf', 'pdf');
      subidos.push(ruta);
      rutas.push(ruta);
    }

    const insId = await enTransaccion(async (client) => {
      const id = await repo.insertarInscripcion(client, {
        representante: input.representante,
        comprobante: rutaComprobante,
        total: cobro.total,
        ip: meta.ip,
        navegador: meta.navegador,
        fecha,
      });
      for (const [i, nino] of guardados.entries()) {
        const insninoId = await repo.insertarNinoDeInscripcion(client, {
          insId: id,
          orden: i + 1,
          nino,
          disciplinas: input.ninos[i]!.disciplinas,
          pdf: rutas[i]!,
          sha256: paquetes[i]!.sha256,
          cobro: cobro.alumnos[i]!,
        });
        for (const h of paquetes[i]!.huellas) {
          await repo.insertarAceptacion(client, {
            insId: id,
            insninoId,
            docId: h.doc_id,
            sha256: h.sha256,
            opciones: opcionesDe(h.tipo, nino),
            fecha,
          });
        }
      }
      return id;
    });

    // El representante se lleva su copia en el momento, con un nombre que
    // reconozca en su carpeta de descargas.
    const urls = await Promise.all(
      guardados.map((n, i) => firmarDescarga(rutas[i]!, nombreDeDescarga(n.nombre))),
    );
    return {
      ins_id: insId,
      total: cobro.total,
      paquetes: guardados.map((n, i) => ({ alumno: n.nombre, url: urls[i] ?? null })),
    };
  } catch (err) {
    await borrarArchivos(subidos);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Modulo interno

export interface ListaInscripciones extends Pagina<repo.InscripcionListada> {
  conteos: { pendientes: number; aprobadas: number };
}

export async function listar(query: ListarInscripcionesQuery): Promise<ListaInscripciones> {
  const [{ items, total }, conteos] = await Promise.all([repo.listar(query), repo.contarPorEstado()]);
  return { ...armarPagina(items, total, query), conteos };
}

export interface ConstanciaDetalle {
  tipo: TipoDocumento;
  nombre: string;
  version: number;
  sha256: string;
  opciones: Record<string, unknown>;
}

export interface NinoDetalle {
  insnino_id: number;
  datos: repo.NinoGuardado;
  colegio: string | null;
  grado: string | null;
  disciplinas: Array<{ colacthor_id: number; descripcion: string; disponible: boolean }>;
  /** El aprobado si existe; si no, el que se descargó al enviar. */
  paquete_url: string | null;
  paquete_sha256: string;
  constancias: ConstanciaDetalle[];
  cobro: CobroAlumno | null;
  nino_id: number | null;
}

export interface InscripcionDetalle extends Omit<repo.InscripcionFila, 'ins_comprobante'> {
  comprobante_url: string | null;
  ninos: NinoDetalle[];
  /** Usuarios que ya existen con ese correo o esa cedula. */
  coincidencias: repo.UsuarioCoincidente[];
  /** Lo que impide aprobar ahora mismo, en frases para el admin. Vacio si se puede. */
  bloqueos: string[];
}

/**
 * Por que no se puede aprobar todavia, si hay algo. Lo usa la ficha (para
 * ensenarlo antes de pulsar) y aprobar (para negarse).
 */
export function bloqueosDeAprobacion(
  coincidencias: repo.UsuarioCoincidente[],
  problemasDisciplinas: string[],
): string[] {
  const bloqueos: string[] = [];
  const porCorreo = coincidencias.find((c) => c.por_correo);
  const otroConCedula = coincidencias.find((c) => c.por_cedula && !c.por_correo);

  if (porCorreo && porCorreo.est_id !== ESTADO.ACTIVO) {
    bloqueos.push(
      `Ya existe un usuario con ese correo (${porCorreo.usu_nombre}) y está dado de baja. Reactívalo en Usuarios y vuelve a aprobar.`,
    );
  }
  if (otroConCedula) {
    bloqueos.push(
      `La cédula ya pertenece a otro usuario (${otroConCedula.usu_nombre}, ${otroConCedula.usu_correo}). Hay que aclararlo con el representante antes de aprobar.`,
    );
  }
  return [...bloqueos, ...problemasDisciplinas];
}

export async function detalle(insId: number): Promise<InscripcionDetalle> {
  const fila = await repo.obtener(insId);
  if (!fila) throw new ApiError(404, 'Inscripción no encontrada');

  const [ninos, aceptaciones] = await Promise.all([repo.ninosDe(insId), repo.aceptacionesDe(insId)]);
  const ids = [...new Set(ninos.flatMap((n) => n.insnino_disciplinas))];
  const paquetes = ninos.map((n) => n.insnino_pdf_aprobado ?? n.insnino_pdf);
  const [disciplinas, grados, coincidencias, firmadas] = await Promise.all([
    repo.disciplinasPorId(ids),
    repo.nombresDeGrados(ninos.map((n) => n.insnino_datos.catninograd_id)),
    repo.usuariosCoincidentes(fila.ins_representante.correo, fila.ins_representante.cedula),
    firmarArchivos([fila.ins_comprobante, ...paquetes]),
  ]);
  const porId = new Map(disciplinas.map((d) => [d.colacthor_id, d]));

  const pendiente = fila.ins_estado === 'pendiente';
  const problemas = pendiente
    ? problemasDeDisciplinas(
        ninos.map((n) => ({
          nombre: n.insnino_datos.nombre,
          col_id: n.insnino_datos.col_id,
          disciplinas: n.insnino_disciplinas,
        })),
        porId,
      )
    : [];

  const { ins_comprobante, ...resto } = fila;
  return {
    ...resto,
    comprobante_url: firmadas.get(ins_comprobante) ?? null,
    coincidencias,
    bloqueos: pendiente ? bloqueosDeAprobacion(coincidencias, problemas) : [],
    ninos: ninos.map((n, i) => {
      const propias = n.insnino_disciplinas.map((id) => porId.get(id));
      return {
        insnino_id: n.insnino_id,
        datos: n.insnino_datos,
        colegio: propias.find((d) => d)?.col_nombre ?? null,
        grado: grados.get(n.insnino_datos.catninograd_id) ?? null,
        disciplinas: n.insnino_disciplinas.map((id) => {
          const d = porId.get(id);
          return {
            colacthor_id: id,
            descripcion: d ? describirDisciplina(d) : 'Disciplina eliminada',
            disponible: !!d && d.est_id === ESTADO.ACTIVO && d.col_id === n.insnino_datos.col_id,
          };
        }),
        paquete_url: firmadas.get(paquetes[i]!) ?? null,
        paquete_sha256: n.insnino_pdf_aprobado_sha256 ?? n.insnino_pdf_sha256,
        constancias: aceptaciones
          .filter((a) => a.insnino_id === n.insnino_id)
          .map((a) => ({
            tipo: a.doc_tipo,
            nombre: NOMBRE_DOCUMENTO[a.doc_tipo],
            version: a.doc_version,
            sha256: a.acep_texto_sha256,
            opciones: a.acep_opciones,
          })),
        cobro: n.insnino_precio,
        nino_id: n.nino_id,
      };
    }),
  };
}

export interface ResultadoAprobacion {
  usu_id: number;
  cuenta_nueva: boolean;
  ninos: number[];
  correo_enviado: boolean;
}

/**
 * Aprobar: nacen (o se reutilizan) el usuario y su ficha de representante, y
 * nacen los alumnos, sus vinculos, sus contactos y sus altas en disciplinas.
 * Todo o nada.
 *
 * La cuenta de Supabase Auth va primero y fuera de la transaccion, como en
 * el alta de Usuarios: el CHECK de `usuario` no deja insertar un activo sin
 * ella. Si la transaccion falla, se borra la cuenta recien creada.
 *
 * Si el correo ya es de un usuario, no se crea otra cuenta: se le anade el
 * rol de representante (si no lo tenia) y se le cuelgan los alumnos.
 *
 * Cada paquete de documentos se vuelve a generar con "Aprobado por" bajo la
 * firma de Activa (decision del cliente, 2026-10-05: no hay firma dibujada;
 * aprobar es la firma de Activa). Sale de los mismos datos y versiones que
 * el de envio, asi que solo cambia esa linea.
 */
export async function aprobar(actor: AuthUser, insId: number): Promise<ResultadoAprobacion> {
  const fila = await repo.obtener(insId);
  if (!fila) throw new ApiError(404, 'Inscripción no encontrada');
  if (fila.ins_estado !== 'pendiente') throw new ApiError(409, 'Esta inscripción ya está aprobada');

  const rep = fila.ins_representante;
  const coincidencias = await repo.usuariosCoincidentes(rep.correo, rep.cedula);
  const bloqueos = bloqueosDeAprobacion(coincidencias, []);
  if (bloqueos.length > 0) throw new ApiError(409, bloqueos[0]!, { bloqueos });

  const existente = coincidencias.find((c) => c.por_correo) ?? null;

  // Los paquetes aprobados, antes de crear nada: si uno falla, no hay que deshacer.
  const fechaAprobacion = new Date();
  const [ninosPrevios, aceptaciones, membrete] = await Promise.all([
    repo.ninosDe(insId),
    repo.aceptacionesDe(insId),
    membreteActual(),
  ]);
  const aprobados: Array<{ pdf: Buffer; sha256: string }> = [];
  for (const n of ninosPrevios) {
    const documentos: DocumentoVigente[] = aceptaciones
      .filter((a) => a.insnino_id === n.insnino_id)
      .map((a) => ({
        doc_id: a.doc_id,
        tipo: a.doc_tipo,
        titulo: a.doc_titulo,
        contenido: a.doc_contenido,
        version: a.doc_version,
      }))
      .sort((a, b) => TIPOS_DOCUMENTO.indexOf(a.tipo) - TIPOS_DOCUMENTO.indexOf(b.tipo));
    if (!n.insnino_precio) throw new ApiError(409, 'Inscripción sin precio congelado');
    const datos = datosDelPaquete(rep, n.insnino_datos, n.insnino_precio, {
      fecha: new Date(fila.ins_fecha),
      insId,
      ip: fila.ins_ip,
      navegador: fila.ins_navegador,
      aprobacion: { nombre: actor.usuario.usu_nombre, fecha: fechaAprobacion },
    });
    const { pdf, sha256: huella } = await armarPaquete(documentos, datos, membrete);
    aprobados.push({ pdf, sha256: huella });
  }

  const subidos: string[] = [];
  let authCreada: string | null = null;
  let resultado: Omit<ResultadoAprobacion, 'correo_enviado'>;
  try {
    for (const p of aprobados) {
      subidos.push(await subirArchivo('contratos', p.pdf, 'application/pdf', 'pdf'));
    }

    if (!existente) {
      const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
        email: rep.correo,
        password: rep.cedula,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new ApiError(400, `No se pudo crear la cuenta de acceso: ${error?.message ?? 'sin detalle'}`);
      }
      authCreada = data.user.id;
    }

    resultado = await enTransaccion(async (client) => {
      // Bloqueo de la fila: dos clics seguidos en "Aprobar" no crean dos alumnos.
      const bloqueada = await repo.obtener(insId, client, true);
      if (!bloqueada || bloqueada.ins_estado !== 'pendiente') {
        throw new ApiError(409, 'Esta inscripción ya no está pendiente');
      }

      const ninos = await repo.ninosDe(insId, client);
      const ids = [...new Set(ninos.flatMap((n) => n.insnino_disciplinas))];
      const porId = new Map(
        (await repo.disciplinasPorId(ids, client)).map((d) => [d.colacthor_id, d]),
      );
      const problemas = problemasDeDisciplinas(
        ninos.map((n) => ({
          nombre: n.insnino_datos.nombre,
          col_id: n.insnino_datos.col_id,
          disciplinas: n.insnino_disciplinas,
        })),
        porId,
      );
      if (problemas.length > 0) throw new ApiError(409, problemas[0]!, { bloqueos: problemas });

      let usuId: number;
      if (existente) {
        usuId = existente.usu_id;
        await repo.completarCedula(client, usuId, rep.cedula);
      } else {
        usuId = await usuariosRepo.insertarUsuario(client, {
          authUserId: authCreada!,
          nombre: rep.nombre,
          correo: rep.correo,
          telefono: rep.telefono,
          foto: null,
          cedula: rep.cedula,
        });
      }
      await repo.agregarRolRepresentante(client, usuId);
      await usuariosRepo.upsertPadre(client, usuId);
      const padreId = await repo.padreIdDe(client, usuId);
      await repo.guardarFactura(client, padreId, rep.factura);

      const creados: number[] = [];
      for (const [i, n] of ninos.entries()) {
        const d = n.insnino_datos;
        const ninoId = await estudiantesRepo.insertarEstudiante(client, {
          nombre: d.nombre,
          colId: d.col_id,
          gradoId: d.catninograd_id,
          fechaNacimiento: d.fecha_nacimiento,
          modalidadSalida: d.modalidad_salida,
          detalleRetiro: d.detalle_retiro,
          // Sin autorización no se guardó el detalle (schemas.ts): aquí llega null.
          salud: d.salud.detalle,
          imagen: d.imagen,
          foto: null,
        });
        await repo.marcarSaludAutorizada(client, ninoId, d.salud.autoriza);
        await estudiantesRepo.guardarContacto(client, ninoId, 'emergencia', { ...d.emergencia, cedula: null });
        await estudiantesRepo.guardarContacto(client, ninoId, 'retiro', d.retiro);
        await repo.atarConParentesco(client, ninoId, padreId, d.parentesco);
        for (const colacthorId of n.insnino_disciplinas) {
          await repo.inscribirEnDisciplina(client, ninoId, colacthorId, n.insnino_id);
        }
        // ninosDe ordena por insnino_orden igual que ninosPrevios.
        await repo.fijarNino(client, n.insnino_id, ninoId, {
          ruta: subidos[i]!,
          sha256: aprobados[i]!.sha256,
        });
        creados.push(ninoId);
      }

      await repo.marcarAprobada(client, insId, usuId, actor.usuario.usu_id, fechaAprobacion);
      await auditar(
        {
          actor,
          accion: 'crear',
          entidad: 'inscripcion',
          entidadId: insId,
          detalle: { aprobada: true, usu_id: usuId, cuenta_nueva: !existente, ninos: creados },
        },
        client,
      );

      return { usu_id: usuId, cuenta_nueva: !existente, ninos: creados };
    });
  } catch (err) {
    await borrarArchivos(subidos);
    if (authCreada) {
      try {
        await getSupabaseAdmin().auth.admin.deleteUser(authCreada);
      } catch (limpieza) {
        console.error(
          `Quedo una cuenta de Auth huerfana (${authCreada}) tras fallar la aprobacion de la inscripcion ${insId}:`,
          limpieza,
        );
      }
    }
    throw err;
  }

  const correo_enviado = await enviarCorreo({
    ...correoDeAprobacion(rep.nombre, rep.correo, resultado.cuenta_nueva),
    adjuntos: ninosPrevios.map((n, i) => ({
      nombre: `Inscripcion ${n.insnino_datos.nombre}.pdf`,
      contenido: aprobados[i]!.pdf,
    })),
  });
  return { ...resultado, correo_enviado };
}

/**
 * La contrasena no se escribe en el correo: se dice que es la cedula. Asi el
 * correo no lleva ningun secreto aunque se reenvie. Los documentos firmados
 * van adjuntos.
 */
export function correoDeAprobacion(nombre: string, correo: string, cuentaNueva: boolean) {
  const enlace = `${frontendBaseUrl}/login`;
  const acceso = cuentaNueva
    ? 'Tu contraseña es tu número de cédula (o pasaporte), tal como lo escribiste en la inscripción. Puedes cambiarla cuando quieras desde tu Perfil.'
    : 'Entra con la contraseña que ya usas en la plataforma.';
  const documentos = 'Adjuntamos los documentos de la inscripción, aprobados.';

  const texto = [
    `Hola, ${nombre}:`,
    '',
    'Tu inscripción en Activa Reforce fue aprobada.',
    documentos,
    '',
    `Entra en ${enlace}`,
    `Usuario: ${correo}`,
    acceso,
    '',
    'Activa Reforce',
  ].join('\n');

  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:8px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 16px;font-size:16px">Hola, ${escaparHtml(nombre)}:</p>
<p style="margin:0 0 16px;font-size:16px">Tu inscripción en <strong>Activa Reforce</strong> fue aprobada. ${escaparHtml(documentos)}</p>
<p style="margin:0 0 8px;font-size:15px"><strong>Usuario:</strong> ${escaparHtml(correo)}</p>
<p style="margin:0 0 24px;font-size:15px">${escaparHtml(acceso)}</p>
<p style="margin:0 0 24px"><a href="${escaparHtml(enlace)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px">Entrar a la plataforma</a></p>
<p style="margin:0;font-size:13px;color:#52606d">Activa Reforce</p>
</td></tr></table></td></tr></table></body></html>`;

  return { para: correo, asunto: 'Tu inscripción fue aprobada', html, texto };
}

/**
 * Rechazar = borrar, como si nunca se hubiera inscrito (decision del
 * cliente). Solo una pendiente: una aprobada ya creo alumnos y cuenta, y eso
 * se gestiona desde Estudiantes y Usuarios.
 *
 * Como en todos los borrados permanentes del sistema, hay que escribir el
 * nombre. En auditoria queda el hecho, sin datos personales.
 */
export async function rechazar(actor: AuthUser, insId: number, confirmacion: string): Promise<void> {
  const fila = await repo.obtener(insId);
  if (!fila) throw new ApiError(404, 'Inscripción no encontrada');
  if (fila.ins_estado !== 'pendiente') {
    throw new ApiError(
      409,
      'Una inscripción aprobada no se rechaza: el alumno y la cuenta ya existen. Se gestionan desde Estudiantes y Usuarios.',
    );
  }
  if (normalizarNombre(confirmacion) !== normalizarNombre(fila.ins_representante.nombre)) {
    throw new ApiError(400, 'El nombre escrito no coincide con el del representante');
  }

  const rutas = await enTransaccion(async (client) => {
    const ninos = await repo.ninosDe(insId, client);
    const borradas = await repo.borrar(client, insId);
    await auditar(
      {
        actor,
        accion: 'eliminar',
        entidad: 'inscripcion',
        entidadId: insId,
        detalle: { rechazada: true, ninos: ninos.length },
      },
      client,
    );
    return borradas;
  });

  await borrarArchivos(rutas);
}

// ---------------------------------------------------------------------------
// Documentos
//
// Cada tipo tiene como mucho un borrador (la proxima version) y una vigente
// (la publicada mas alta). El borrador se edita y se borra; publicarlo lo
// congela para siempre (trigger de 0015) y pasa a ser lo que acepta quien se
// inscriba desde ese momento. No se publica uno al que le falte una pieza
// (casilla, tabla o firma): el formulario no tendria donde guardar la respuesta.

export async function documentos() {
  const [vigentes, borradores, historial] = await Promise.all([
    repo.documentosVigentes(),
    repo.borradores(),
    repo.historialDocumentos(),
  ]);
  return {
    vigentes,
    borradores,
    historial,
    marcadores: MARCADORES,
    reglas: REGLAS,
    /** Con qué arranca el editor de un tipo que todavía no tiene texto. */
    iniciales: PLANTILLAS_INICIALES,
  };
}

export async function documento(docId: number): Promise<repo.DocumentoLegal> {
  const doc = await repo.obtenerDocumento(docId);
  if (!doc) throw new ApiError(404, 'Documento no encontrado');
  return doc;
}

export async function guardarBorrador(
  actor: AuthUser,
  input: { tipo: TipoDocumento; titulo: string; contenido: string },
): Promise<repo.DocumentoLegal> {
  return enTransaccion(async (client) => {
    const doc = await repo.guardarBorrador(client, input.tipo, input.titulo, input.contenido);
    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'documento_legal',
        entidadId: doc.doc_id,
        detalle: { tipo: doc.doc_tipo, version: doc.doc_version, borrador: true },
      },
      client,
    );
    return doc;
  });
}

export async function publicarDocumento(actor: AuthUser, docId: number): Promise<repo.DocumentoLegal> {
  const borrador = await repo.obtenerDocumento(docId);
  if (borrador && borrador.doc_publicado === null) {
    const problemas = problemasDePlantilla(borrador.doc_tipo, borrador.doc_contenido);
    if (problemas.length > 0) {
      throw new ApiError(409, `No se puede publicar: ${problemas[0]}`, { problemas });
    }
  }
  return enTransaccion(async (client) => {
    const doc = await repo.publicarBorrador(client, docId);
    if (!doc) throw new ApiError(409, 'Solo se publica un borrador; ese documento ya está publicado o no existe');
    await auditar(
      {
        actor,
        accion: 'crear',
        entidad: 'documento_legal',
        entidadId: doc.doc_id,
        detalle: { tipo: doc.doc_tipo, version: doc.doc_version, publicado: true },
      },
      client,
    );
    return doc;
  });
}

export async function borrarBorrador(actor: AuthUser, docId: number): Promise<void> {
  await enTransaccion(async (client) => {
    const borrado = await repo.borrarBorrador(client, docId);
    if (!borrado) throw new ApiError(409, 'Solo se borra un borrador; uno publicado no se toca');
    await auditar(
      { actor, accion: 'eliminar', entidad: 'documento_legal', entidadId: docId, detalle: { borrador: true } },
      client,
    );
  });
}

/** Datos ficticios para el PDF de ejemplo. Los mismos que la vista previa del módulo. */
export const NINO_DE_EJEMPLO: repo.NinoGuardado = {
  nombre: 'Nombre del alumno',
  fecha_nacimiento: '2016-01-01',
  col_id: 1,
  catninograd_id: 1,
  parentesco: 'Madre',
  emergencia: { nombre: 'Contacto de emergencia', relacion: 'Relación', telefono: '0990000000' },
  retiro: { nombre: 'Persona autorizada', cedula: '0000000000', relacion: 'Relación', telefono: '0990000000' },
  modalidad_salida: 'privado',
  detalle_retiro: 'Instrucciones de retiro',
  salud: { tiene: false, detalle: null, autoriza: true },
  imagen: { familias: true, redes: false, promocional: false },
  documento: {
    colegio: {
      sede: 'Colegio de ejemplo',
      sede_corta: 'Sede de ejemplo',
      institucion: 'INSTITUCIÓN',
      minimo_alumnos: 15,
      tarifa: 30,
      descuento_hermano: 10,
    },
    curso: 'Curso',
    actividades: ['Disciplina'],
    horarios: ['Disciplina: Martes 16:00 a 17:00', 'Disciplina: Jueves 16:00 a 17:00'],
  },
};

export const REPRESENTANTE_DE_EJEMPLO: RepresentanteFormulario = {
  nombre: 'Nombre del representante',
  cedula: '0000000000',
  correo: 'correo@ejemplo.com',
  telefono: '0990000000',
  factura: {
    nombre: 'Nombre para la factura',
    identificacion: '0000000000001',
    correo: 'factura@ejemplo.com',
    direccion: 'Dirección para la factura',
  },
};

/**
 * El paquete de un alumno de ejemplo, con lo **guardado** de cada tipo (el
 * borrador si lo hay, si no la vigente) y una marca de "EJEMPLO". Es el
 * mismo generador que el de verdad, no una imitacion. Un tipo sin texto
 * todavia se salta.
 */
export async function ejemploPaquete(): Promise<Buffer> {
  const [vigentes, borradores, membrete] = await Promise.all([
    repo.documentosVigentes(),
    repo.borradores(),
    membreteActual(),
  ]);
  const documentos: DocumentoVigente[] = [];
  for (const tipo of TIPOS_DOCUMENTO) {
    const d = borradores.find((b) => b.doc_tipo === tipo) ?? vigentes.find((v) => v.doc_tipo === tipo);
    if (d) {
      documentos.push({
        doc_id: d.doc_id,
        tipo,
        titulo: d.doc_titulo,
        contenido: d.doc_contenido,
        version: d.doc_version,
      });
    }
  }
  if (documentos.length === 0) throw new ApiError(409, 'Todavía no hay ningún documento guardado');

  const cobro = calcularCobro(
    [{ colId: 1, disciplinas: 2 }],
    new Map([[1, { precio: 30, descuentoHermano: 10 }]]),
    IVA_PCT,
  );
  const datos = datosDelPaquete(REPRESENTANTE_DE_EJEMPLO, NINO_DE_EJEMPLO, cobro.alumnos[0]!, {
    fecha: new Date(),
    insId: 123,
    ip: '190.0.0.1',
    navegador: 'Ejemplo',
    aprobacion: { nombre: 'Nombre de quien aprueba', fecha: new Date() },
  });
  const { pdf } = await armarPaquete(documentos, { ...datos, ejemplo: true }, membrete);
  return pdf;
}

// ---------------------------------------------------------------------------
// Precios y datos de cada colegio (0015, 0016)

export async function precios() {
  return repo.listarPrecios();
}

export async function guardarPrecio(
  actor: AuthUser,
  colId: number,
  input: {
    precio: number;
    descuento_hermano: number;
    sede: string;
    sede_corta: string;
    institucion: string;
    minimo_alumnos: number;
  },
): Promise<void> {
  if (!(await repo.existeColegio(colId))) throw new ApiError(404, 'Colegio no encontrado');
  await enTransaccion(async (client) => {
    await repo.guardarPrecio(client, colId, {
      precio: input.precio,
      descuentoHermano: input.descuento_hermano,
      sede: input.sede,
      sede_corta: input.sede_corta,
      institucion: input.institucion,
      minimo_alumnos: input.minimo_alumnos,
    });
    await auditar(
      { actor, accion: 'editar', entidad: 'colegio_precio', entidadId: colId, detalle: { ...input } },
      client,
    );
  });
}

/** Quitar el precio saca el colegio del formulario publico. */
export async function borrarPrecio(actor: AuthUser, colId: number): Promise<void> {
  await enTransaccion(async (client) => {
    await repo.borrarPrecio(client, colId);
    await auditar({ actor, accion: 'eliminar', entidad: 'colegio_precio', entidadId: colId }, client);
  });
}

// ---------------------------------------------------------------------------
// Configuración: el membrete (0016). El IVA no se configura: IVA_PCT.

export interface ConfigVista {
  cuenta_bancaria: string | null;
  /** false = el membrete de serie (el de los Word del cliente). */
  membrete_propio: boolean;
  /** La imagen vigente, para enseñarla. */
  membrete_data_url: string | null;
}

export async function config(): Promise<ConfigVista> {
  const [c, membrete] = await Promise.all([repo.obtenerConfig(), membreteActual()]);
  const mime = membrete?.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'image/jpeg' : 'image/png';
  return {
    cuenta_bancaria: c.cuenta_bancaria,
    membrete_propio: c.membrete !== null,
    membrete_data_url: membrete ? `data:${mime};base64,${membrete.toString('base64')}` : null,
  };
}

/**
 * Cambia el membrete de los PDF que se generen desde ahora. Los ya
 * generados no cambian: están guardados con su huella.
 */
export async function subirMembrete(
  actor: AuthUser,
  input: { mime: 'image/jpeg' | 'image/png'; base64: string },
): Promise<void> {
  const contenido = Buffer.from(input.base64, 'base64');
  if (contenido.length > BYTES_MAX_MEMBRETE) throw new ApiError(400, 'El membrete pesa más de 700 KB.');
  if (!firmaDeImagenValida(contenido, input.mime)) {
    throw new ApiError(400, 'El archivo no es una imagen PNG o JPEG válida.');
  }
  const ruta = await subirArchivo('membretes', contenido, input.mime, input.mime === 'image/png' ? 'png' : 'jpg');
  let anterior: string | null;
  try {
    anterior = await enTransaccion(async (client) => {
      const previo = await repo.guardarMembrete(client, ruta);
      await auditar(
        { actor, accion: 'editar', entidad: 'inscripcion_config', entidadId: 1, detalle: { membrete: 'propio' } },
        client,
      );
      return previo;
    });
  } catch (err) {
    await borrarArchivos([ruta]);
    throw err;
  }
  if (anterior) await borrarArchivos([anterior]);
}

export async function guardarCuentaBancaria(actor: AuthUser, texto: string | null): Promise<void> {
  await enTransaccion(async (client) => {
    await repo.guardarCuentaBancaria(client, texto);
    await auditar(
      { actor, accion: 'editar', entidad: 'inscripcion_config', entidadId: 1, detalle: { cuenta_bancaria: true } },
      client,
    );
  });
}

/** Vuelve al membrete de serie. */
export async function restaurarMembrete(actor: AuthUser): Promise<void> {
  const anterior = await enTransaccion(async (client) => {
    const previo = await repo.guardarMembrete(client, null);
    await auditar(
      { actor, accion: 'editar', entidad: 'inscripcion_config', entidadId: 1, detalle: { membrete: 'de serie' } },
      client,
    );
    return previo;
  });
  if (anterior) await borrarArchivos([anterior]);
}
