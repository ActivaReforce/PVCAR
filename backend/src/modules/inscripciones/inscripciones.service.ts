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
  firmarArchivos,
  subirArchivo,
} from '../../lib/storageInscripciones.js';
import * as usuariosRepo from '../usuarios/usuarios.repository.js';
import * as estudiantesRepo from '../estudiantes/estudiantes.repository.js';
import * as repo from './inscripciones.repository.js';
import { MARCADORES, generarContrato } from './inscripciones.contrato.js';
import { calcularCobro, type Cobro, type CobroAlumno } from './inscripciones.precios.js';
import {
  PARENTESCOS,
  TIPOS_DOCUMENTO,
  type EnvioInscripcion,
  type ListarInscripcionesQuery,
  type TipoDocumento,
} from './inscripciones.schemas.js';

/**
 * Inscripciones (Fase 14B). Diseno en docs/fase14b-inscripciones.md.
 *
 *   formulario publico ──enviar──▶ pendiente ──aprobar──▶ aprobada
 *                                      │                  (nacen usuario,
 *                                      └──rechazar──▶ ∅    nino y altas)
 *
 * Mientras esta pendiente nada sale de las tablas de inscripcion, asi que
 * ningun otro modulo (listas, asistencias, reportes) puede ver a un alumno
 * sin pago aprobado. Rechazar es borrar.
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
// Publico

export interface Formulario {
  /** false si falta publicar alguno de los tres documentos: el formulario no se abre. */
  disponible: boolean;
  colegios: repo.ColegioOfertado[];
  grados: repo.GradoOfertado[];
  parentescos: readonly string[];
  documentos: Partial<Record<TipoDocumento, repo.DocumentoLegal>>;
}

export async function formulario(): Promise<Formulario> {
  const [colegios, grados, vigentes] = await Promise.all([
    repo.ofertaPublica(),
    repo.grados(),
    repo.documentosVigentes(),
  ]);
  const documentos: Partial<Record<TipoDocumento, repo.DocumentoLegal>> = {};
  for (const doc of vigentes) documentos[doc.doc_tipo] = doc;

  return {
    disponible: TIPOS_DOCUMENTO.every((t) => documentos[t]) && colegios.length > 0,
    colegios,
    grados,
    parentescos: PARENTESCOS,
    documentos,
  };
}

/**
 * Cuanto se paga. Lo calcula siempre el backend, con los precios de la base:
 * lo que diga el navegador no cuenta. Lo usan el formulario (para ensenar el
 * total antes del comprobante) y el envio (para congelarlo en el contrato).
 */
async function cobroDe(
  ninos: Array<{ nombre: string; col_id: number; disciplinas: number[] }>,
): Promise<{ cobro: Cobro; encontradas: Map<number, DisciplinaConEstado> }> {
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
  );
  return { cobro, encontradas };
}

export async function cotizar(
  ninos: Array<{ col_id: number; disciplinas: number[] }>,
): Promise<Cobro> {
  const { cobro } = await cobroDe(ninos.map((n, i) => ({ ...n, nombre: `Alumno ${i + 1}` })));
  return cobro;
}

export interface EnvioRecibido {
  ins_id: number;
  total: number;
  contratos: Array<{ alumno: string; url: string | null }>;
}

export async function enviar(
  input: EnvioInscripcion,
  meta: { ip: string | null; navegador: string | null },
): Promise<EnvioRecibido> {
  const vigentes = await repo.documentosVigentes();
  const doc = (tipo: TipoDocumento) => vigentes.find((d) => d.doc_tipo === tipo);
  const contrato = doc('contrato');
  const terminos = doc('terminos');
  const privacidad = doc('privacidad');

  if (!contrato || !terminos || !privacidad) {
    throw new ApiError(503, 'Las inscripciones no están abiertas todavía.');
  }
  if (
    input.documentos.contrato !== contrato.doc_id ||
    input.documentos.terminos !== terminos.doc_id ||
    input.documentos.privacidad !== privacidad.doc_id
  ) {
    throw new ApiError(
      409,
      'El contrato o las condiciones se actualizaron mientras llenabas el formulario. Recarga la página y vuelve a leerlos antes de aceptar.',
    );
  }

  const { cobro, encontradas } = await cobroDe(input.ninos);

  const comprobante = Buffer.from(input.comprobante.base64, 'base64');
  if (comprobante.length > 2 * 1024 * 1024) {
    throw new ApiError(400, 'El comprobante pesa más de 2 MB.');
  }
  if (!firmaDeImagenValida(comprobante, input.comprobante.mime)) {
    throw new ApiError(400, 'El comprobante no es una imagen válida.');
  }

  const grados = await repo.nombresDeGrados(
    input.ninos.map((n) => n.catninograd_id).filter((g): g is number => g !== null),
  );
  const fecha = new Date();

  // Los PDF se generan antes de tocar nada: si uno falla, no queda nada subido.
  const contratos: Array<{ pdf: Buffer; sha256: string }> = [];
  for (const [i, nino] of input.ninos.entries()) {
    const elegidas = nino.disciplinas.map((id) => encontradas.get(id)!);
    contratos.push(
      await generarContrato({
        titulo: contrato.doc_titulo,
        texto: contrato.doc_contenido,
        versionContrato: contrato.doc_version,
        versionTerminos: terminos.doc_version,
        versionPrivacidad: privacidad.doc_version,
        representante: { ...input.representante, sector: input.representante.sector_residencia },
        alumno: {
          nombre: nino.nombre,
          fechaNacimiento: nino.fecha_nacimiento,
          cedula: nino.cedula,
          colegio: elegidas[0]!.col_nombre,
          grado: nino.catninograd_id ? (grados.get(nino.catninograd_id) ?? null) : null,
          parentesco: nino.parentesco,
        },
        disciplinas: elegidas.map(describirDisciplina),
        cobro: cobro.alumnos[i]!,
        fecha,
        ip: meta.ip,
      }),
    );
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

    const rutasContrato: string[] = [];
    for (const c of contratos) {
      const ruta = await subirArchivo('contratos', c.pdf, 'application/pdf', 'pdf');
      subidos.push(ruta);
      rutasContrato.push(ruta);
    }

    const insId = await enTransaccion(async (client) => {
      const id = await repo.insertarInscripcion(client, {
        representante: input.representante,
        comprobante: rutaComprobante,
        total: cobro.total,
        docContrato: contrato.doc_id,
        docTerminos: terminos.doc_id,
        docPrivacidad: privacidad.doc_id,
        ip: meta.ip,
        navegador: meta.navegador,
      });
      for (const [i, nino] of input.ninos.entries()) {
        await repo.insertarNinoDeInscripcion(client, {
          insId: id,
          orden: i + 1,
          nino,
          contrato: rutasContrato[i]!,
          sha256: contratos[i]!.sha256,
          cobro: cobro.alumnos[i]!,
        });
      }
      return id;
    });

    // El representante se lleva su copia firmada en el momento.
    const firmadas = await firmarArchivos(rutasContrato);
    return {
      ins_id: insId,
      total: cobro.total,
      contratos: input.ninos.map((n, i) => ({
        alumno: n.nombre,
        url: firmadas.get(rutasContrato[i]!) ?? null,
      })),
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

export interface NinoDetalle {
  insnino_id: number;
  datos: repo.NinoDeInscripcion['insnino_datos'];
  colegio: string | null;
  grado: string | null;
  disciplinas: Array<{ colacthor_id: number; descripcion: string; disponible: boolean }>;
  contrato_url: string | null;
  contrato_sha256: string;
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

  const ninos = await repo.ninosDe(insId);
  const ids = [...new Set(ninos.flatMap((n) => n.insnino_disciplinas))];
  const [disciplinas, grados, coincidencias, firmadas] = await Promise.all([
    repo.disciplinasPorId(ids),
    repo.nombresDeGrados(
      ninos.map((n) => n.insnino_datos.catninograd_id).filter((g): g is number => g !== null),
    ),
    repo.usuariosCoincidentes(fila.ins_representante.correo, fila.ins_representante.cedula),
    firmarArchivos([fila.ins_comprobante, ...ninos.map((n) => n.insnino_contrato)]),
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
    ninos: ninos.map((n) => {
      const propias = n.insnino_disciplinas.map((id) => porId.get(id));
      return {
        insnino_id: n.insnino_id,
        datos: n.insnino_datos,
        colegio: propias.find((d) => d)?.col_nombre ?? null,
        grado: n.insnino_datos.catninograd_id
          ? (grados.get(n.insnino_datos.catninograd_id) ?? null)
          : null,
        disciplinas: n.insnino_disciplinas.map((id) => {
          const d = porId.get(id);
          return {
            colacthor_id: id,
            descripcion: d ? describirDisciplina(d) : 'Disciplina eliminada',
            disponible: !!d && d.est_id === ESTADO.ACTIVO && d.col_id === n.insnino_datos.col_id,
          };
        }),
        contrato_url: firmadas.get(n.insnino_contrato) ?? null,
        contrato_sha256: n.insnino_contrato_sha256,
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
 * nacen los alumnos, sus vinculos y sus altas en disciplinas. Todo o nada.
 *
 * La cuenta de Supabase Auth va primero y fuera de la transaccion, como en
 * el alta de Usuarios: el CHECK de `usuario` no deja insertar un activo sin
 * ella. Si la transaccion falla, se borra la cuenta recien creada.
 *
 * Si el correo ya es de un usuario, no se crea otra cuenta: se le anade el
 * rol de representante (si no lo tenia) y se le cuelgan los alumnos.
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

  let authCreada: string | null = null;
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

  let resultado: Omit<ResultadoAprobacion, 'correo_enviado'>;
  try {
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
      await usuariosRepo.upsertPadre(client, usuId, rep.sector_residencia ?? null);
      const padreId = await repo.padreIdDe(client, usuId);

      const creados: number[] = [];
      for (const n of ninos) {
        const d = n.insnino_datos;
        const ninoId = await estudiantesRepo.insertarEstudiante(client, {
          nombre: d.nombre,
          colId: d.col_id,
          gradoId: d.catninograd_id,
          fechaNacimiento: d.fecha_nacimiento,
          cedula: d.cedula,
          transporte: d.toma_transporte,
          salud: d.info_salud,
          otra: d.otra_info,
          foto: null,
        });
        await repo.atarConParentesco(client, ninoId, padreId, d.parentesco);
        for (const colacthorId of n.insnino_disciplinas) {
          await repo.inscribirEnDisciplina(client, ninoId, colacthorId, n.insnino_id);
        }
        await repo.fijarNino(client, n.insnino_id, ninoId);
        creados.push(ninoId);
      }

      await repo.marcarAprobada(client, insId, usuId, actor.usuario.usu_id);
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

  const correo_enviado = await enviarCorreo(
    correoDeAprobacion(rep.nombre, rep.correo, resultado.cuenta_nueva),
  );
  return { ...resultado, correo_enviado };
}

/**
 * La contrasena no se escribe en el correo: se dice que es la cedula. Asi el
 * correo no lleva ningun secreto aunque se reenvie.
 */
export function correoDeAprobacion(nombre: string, correo: string, cuentaNueva: boolean) {
  const enlace = `${frontendBaseUrl}/login`;
  const acceso = cuentaNueva
    ? 'Tu contraseña es tu número de cédula (o pasaporte), tal como lo escribiste en la inscripción. Puedes cambiarla cuando quieras desde tu Perfil.'
    : 'Entra con la contraseña que ya usas en la plataforma.';

  const texto = [
    `Hola, ${nombre}:`,
    '',
    'Tu inscripción en Activa Reforce fue aprobada.',
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
<p style="margin:0 0 16px;font-size:16px">Tu inscripción en <strong>Activa Reforce</strong> fue aprobada.</p>
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
// Documentos legales
//
// Cada tipo tiene como mucho un borrador (la proxima version) y una vigente
// (la publicada mas alta). El borrador se edita y se borra; publicarlo lo
// congela para siempre (trigger de 0015) y pasa a ser lo que firma quien se
// inscriba desde ese momento.

export async function documentos() {
  const [vigentes, borradores, historial] = await Promise.all([
    repo.documentosVigentes(),
    repo.borradores(),
    repo.historialDocumentos(),
  ]);
  return { vigentes, borradores, historial, marcadores: MARCADORES };
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

/**
 * El contrato tal como lo recibiria un representante, con datos ficticios y
 * una marca de "EJEMPLO". Sirve para revisar un borrador antes de publicarlo:
 * es el mismo generador que el de verdad, no una imitacion.
 */
export async function ejemploContrato(docId: number): Promise<Buffer> {
  const doc = await documento(docId);
  if (doc.doc_tipo !== 'contrato') throw new ApiError(400, 'Solo el contrato tiene ejemplo en PDF');

  const cobro = calcularCobro(
    [
      { colId: 1, disciplinas: 2 },
      { colId: 1, disciplinas: 1 },
    ],
    new Map([[1, { precio: 45, descuentoHermano: 10 }]]),
  );
  const { pdf } = await generarContrato({
    titulo: doc.doc_titulo,
    texto: doc.doc_contenido,
    versionContrato: doc.doc_version,
    versionTerminos: 1,
    versionPrivacidad: 1,
    representante: {
      nombre: 'María José Pérez Andrade',
      cedula: '1712345678',
      correo: 'maria.perez@ejemplo.com',
      telefono: '0991234567',
      sector: 'Cumbayá',
    },
    alumno: {
      nombre: 'Martín Pérez Andrade',
      fechaNacimiento: '2016-05-14',
      cedula: '1755555555',
      colegio: 'Colegio de ejemplo',
      grado: '4to de Básica',
      parentesco: 'Madre',
    },
    disciplinas: ['Fútbol — Martes 16:00 a 17:00', 'Natación — Jueves 15:00 a 16:00'],
    cobro: cobro.alumnos[0]!,
    fecha: new Date(),
    ip: '190.0.0.1',
    ejemplo: true,
  });
  return pdf;
}

// ---------------------------------------------------------------------------
// Precios por colegio (0015)

export async function precios() {
  return repo.listarPrecios();
}

export async function guardarPrecio(
  actor: AuthUser,
  colId: number,
  input: { precio: number; descuento_hermano: number },
): Promise<void> {
  if (!(await repo.existeColegio(colId))) throw new ApiError(404, 'Colegio no encontrado');
  await enTransaccion(async (client) => {
    await repo.guardarPrecio(client, colId, {
      precio: input.precio,
      descuentoHermano: input.descuento_hermano,
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
