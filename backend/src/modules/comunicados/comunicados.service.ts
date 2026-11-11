import { env } from '../../config/env.js';
import { auditar } from '../../lib/auditoria.js';
import { ROL } from '../../lib/constants.js';
import { enviarCorreo } from '../../lib/correo.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import { obtenerConfig } from '../correos/correos.repository.js';
import { despertar } from './comunicados.envio.js';
import { armarCorreo, cuerpoVacio, textoPlano } from './comunicados.html.js';
import { clasificar, leerArchivo, type Revision } from './comunicados.importar.js';
import * as repo from './comunicados.repository.js';
import { hayClave } from './comunicados.resend.js';
import {
  MAX_DESTINATARIOS,
  type ComunicadoInput,
  type ContactoInput,
  type Destino,
  type ImportarInput,
  type PruebaInput,
} from './comunicados.schemas.js';

/**
 * Comunicados (2026-11-11): solo el rol Propietario, regla fija sin casilla
 * en Permisos (como la configuración de correos de Inscripciones).
 */

export function exigirPropietario(actor: AuthUser): void {
  if (!actor.usuario.roles.some((r) => r.rol_id === ROL.PROPIETARIO)) {
    throw new ApiError(403, 'Comunicados es solo del Propietario');
  }
}

/** Violación de un UNIQUE de Postgres. */
const esDuplicado = (err: unknown) => (err as { code?: string } | null)?.code === '23505';

// ---------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------

export async function listarContactos(buscar?: string, segmento?: number) {
  const [contactos, total] = await Promise.all([
    repo.listarContactos(buscar && buscar.length > 0 ? buscar : null, segmento ?? null),
    repo.contarContactos(),
  ]);
  return { contactos, total };
}

async function revisarCorreoNuevo(correo: string, forzar: boolean, excepto: number | null): Promise<void> {
  if (await repo.contactoPorCorreo(correo, excepto)) {
    throw new ApiError(409, `Ya hay un contacto con el correo ${correo}`);
  }
  if (!forzar) {
    const rep = await repo.representantePorCorreo(correo);
    if (rep) {
      throw new ApiError(409, `${correo} ya es representante (${rep.usu_nombre}). Ya le llegan los comunicados a representantes.`, {
        codigo: 'ES_REPRESENTANTE',
        representante: rep.usu_nombre,
      });
    }
  }
}

export async function crearContacto(actor: AuthUser, input: ContactoInput) {
  await revisarCorreoNuevo(input.correo, input.forzar, null);
  try {
    const id = await repo.crearContacto(input.nombre, input.correo);
    await auditar({ actor, accion: 'crear', entidad: 'comunicado_contacto', entidadId: id, detalle: { correo: input.correo } });
    return { id };
  } catch (err) {
    if (esDuplicado(err)) throw new ApiError(409, `Ya hay un contacto con el correo ${input.correo}`);
    throw err;
  }
}

export async function editarContacto(actor: AuthUser, id: number, input: ContactoInput) {
  await revisarCorreoNuevo(input.correo, input.forzar, id);
  try {
    if (!(await repo.editarContacto(id, input.nombre, input.correo))) throw new ApiError(404, 'Ese contacto ya no existe');
  } catch (err) {
    if (esDuplicado(err)) throw new ApiError(409, `Ya hay un contacto con el correo ${input.correo}`);
    throw err;
  }
  await auditar({ actor, accion: 'editar', entidad: 'comunicado_contacto', entidadId: id, detalle: { ...input } });
  return { id };
}

export async function borrarContactos(actor: AuthUser, ids: number[]) {
  const borrados = await repo.borrarContactos(ids);
  await auditar({ actor, accion: 'eliminar', entidad: 'comunicado_contacto', entidadId: ids.join(','), detalle: { borrados } });
  return { borrados };
}

export async function revisarImportacion(nombre: string, contenido: string): Promise<Revision> {
  const filas = await leerArchivo(nombre, contenido);
  if (filas.length === 0) throw new ApiError(400, 'El archivo no tiene filas con datos.');
  const [contactos, representantes] = await Promise.all([
    repo.todosLosCorreosDeContactos(),
    repo.correosDeRepresentantes(),
  ]);
  return clasificar(
    filas,
    new Set(contactos),
    new Map(representantes.map((r) => [r.correo, r.nombre])),
  );
}

/**
 * Guarda lo confirmado. Los que ya eran contactos no se duplican, pero si se
 * eligió un segmento también entran en él.
 */
export async function importar(actor: AuthUser, input: ImportarInput) {
  const filas = [...new Map(input.filas.map((f) => [f.correo, f])).values()];
  const resultado = await enTransaccion(async (client) => {
    const nuevos = await repo.insertarContactos(
      client,
      filas.map((f) => f.nombre),
      filas.map((f) => f.correo),
    );
    let segmento = input.segmento;
    if (!segmento && input.segmentoNuevo) {
      try {
        segmento = await repo.crearSegmento(input.segmentoNuevo, client);
      } catch (err) {
        if (esDuplicado(err)) throw new ApiError(409, `Ya existe un segmento llamado "${input.segmentoNuevo}"`);
        throw err;
      }
    }
    let enSegmento = 0;
    if (segmento) {
      const ids = await repo.idsPorCorreos(client, filas.map((f) => f.correo));
      enSegmento = await repo.anadirASegmento(segmento, ids, client);
    }
    return { nuevos, enSegmento, segmento };
  });
  await auditar({
    actor,
    accion: 'crear',
    entidad: 'comunicado_contacto',
    entidadId: 'importacion',
    detalle: { filas: filas.length, ...resultado },
  });
  return resultado;
}

// ---------------------------------------------------------------------------
// Segmentos
// ---------------------------------------------------------------------------

export async function crearSegmento(actor: AuthUser, nombre: string) {
  try {
    const id = await repo.crearSegmento(nombre);
    await auditar({ actor, accion: 'crear', entidad: 'comunicado_segmento', entidadId: id, detalle: { nombre } });
    return { id };
  } catch (err) {
    if (esDuplicado(err)) throw new ApiError(409, `Ya existe un segmento llamado "${nombre}"`);
    throw err;
  }
}

export async function renombrarSegmento(actor: AuthUser, id: number, nombre: string) {
  try {
    if (!(await repo.renombrarSegmento(id, nombre))) throw new ApiError(404, 'Ese segmento ya no existe');
  } catch (err) {
    if (esDuplicado(err)) throw new ApiError(409, `Ya existe un segmento llamado "${nombre}"`);
    throw err;
  }
  await auditar({ actor, accion: 'editar', entidad: 'comunicado_segmento', entidadId: id, detalle: { nombre } });
  return { id };
}

export async function borrarSegmento(actor: AuthUser, id: number) {
  const seg = await repo.segmentoPorId(id);
  if (!seg || !(await repo.borrarSegmento(id))) throw new ApiError(404, 'Ese segmento ya no existe');
  await auditar({ actor, accion: 'eliminar', entidad: 'comunicado_segmento', entidadId: id, detalle: { nombre: seg.comseg_nombre } });
  return { id };
}

export async function anadirASegmento(id: number, ids: number[]) {
  if (!(await repo.segmentoPorId(id))) throw new ApiError(404, 'Ese segmento ya no existe');
  return { anadidos: await repo.anadirASegmento(id, ids) };
}

export async function quitarDeSegmento(id: number, ids: number[]) {
  return { quitados: await repo.quitarDeSegmento(id, ids) };
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

export async function crearPlantilla(actor: AuthUser, nombre: string, html: string) {
  const id = await repo.crearPlantilla(nombre, html);
  await auditar({ actor, accion: 'crear', entidad: 'comunicado_plantilla', entidadId: id, detalle: { nombre } });
  return { id };
}

export async function editarPlantilla(actor: AuthUser, id: number, nombre: string, html: string) {
  if (!(await repo.editarPlantilla(id, nombre, html))) throw new ApiError(404, 'Esa plantilla ya no existe');
  await auditar({ actor, accion: 'editar', entidad: 'comunicado_plantilla', entidadId: id, detalle: { nombre } });
  return { id };
}

export async function borrarPlantilla(actor: AuthUser, id: number) {
  if (!(await repo.borrarPlantilla(id))) throw new ApiError(404, 'Esa plantilla ya no existe');
  await auditar({ actor, accion: 'eliminar', entidad: 'comunicado_plantilla', entidadId: id });
  return { id };
}

// ---------------------------------------------------------------------------
// Destinatarios
// ---------------------------------------------------------------------------

/** Junta los grupos elegidos, sin correos repetidos (gana el primer nombre). */
export async function resolverDestinos(destinos: Destino[]): Promise<{ lista: repo.Destinatario[]; porGrupo: number[] }> {
  const todos = new Map<string, repo.Destinatario>();
  const porGrupo: number[] = [];
  for (const d of destinos) {
    let lista: repo.Destinatario[];
    if (d.tipo === 'contactos') lista = await repo.destinatariosContactos(null);
    else if (d.tipo === 'segmento') {
      if (!(await repo.segmentoPorId(d.segmento))) throw new ApiError(400, 'Uno de los segmentos elegidos ya no existe');
      lista = await repo.destinatariosContactos(d.segmento);
    } else lista = await repo.destinatariosRepresentantes(d);
    porGrupo.push(lista.length);
    for (const p of lista) {
      const correo = p.correo.trim().toLowerCase();
      if (correo && !todos.has(correo)) todos.set(correo, { correo, nombre: p.nombre ?? '' });
    }
  }
  return { lista: [...todos.values()], porGrupo };
}

export async function contar(destinos: Destino[]) {
  const { lista, porGrupo } = await resolverDestinos(destinos);
  return { total: lista.length, porGrupo, maximo: MAX_DESTINATARIOS };
}

/** "Representantes · Colegio X · 2.º EGB · Fútbol" + " + " entre grupos. */
async function textoDestinos(destinos: Destino[]): Promise<string> {
  const ops = await repo.opciones();
  const nombre = <T extends { id: number; nombre: string }>(lista: T[], id: number | null) =>
    id ? (lista.find((x) => x.id === id)?.nombre ?? `#${id}`) : null;
  const partes: string[] = [];
  for (const d of destinos) {
    if (d.tipo === 'contactos') partes.push('Todos los contactos');
    else if (d.tipo === 'segmento') {
      const seg = await repo.segmentoPorId(d.segmento);
      partes.push(`Segmento «${seg?.comseg_nombre ?? d.segmento}»`);
    } else {
      const disc = d.disciplina ? ops.disciplinas.find((x) => x.id === d.disciplina) : null;
      const filtros = [
        nombre(ops.colegios, d.colegio),
        nombre(ops.cursos, d.curso),
        disc ? `${disc.nombre}${disc.horario ? ` (${disc.horario})` : ''}` : null,
      ].filter(Boolean);
      partes.push(filtros.length ? `Representantes · ${filtros.join(' · ')}` : 'Todos los representantes');
    }
  }
  return partes.join(' + ');
}

// ---------------------------------------------------------------------------
// Comunicados
// ---------------------------------------------------------------------------

/** Estado en palabras para la pantalla: el detalle interno no le importa al cliente. */
export function estadoVisible(estado: repo.EstadoComunicado): 'borrador' | 'enviando' | 'enviado' | 'fallido' {
  if (estado === 'borrador' || estado === 'enviado' || estado === 'fallido') return estado;
  return 'enviando';
}

export async function listar() {
  const filas = await repo.listarComunicados();
  if (filas.some((f) => estadoVisible(f.com_estado) === 'enviando')) despertar();
  return filas.map((f) => ({ ...f, estado: estadoVisible(f.com_estado) }));
}

export async function obtener(id: number) {
  const c = await repo.obtenerComunicado(id);
  if (!c) throw new ApiError(404, 'Ese comunicado ya no existe');
  return { ...c, estado: estadoVisible(c.com_estado) };
}

async function exigirPlantilla(id: number | null): Promise<repo.Plantilla | null> {
  if (!id) return null;
  const p = await repo.obtenerPlantilla(id);
  if (!p) throw new ApiError(400, 'La plantilla elegida ya no existe');
  return p;
}

export async function crear(actor: AuthUser, input: ComunicadoInput) {
  await exigirPlantilla(input.plantilla);
  const id = await repo.crearComunicado(
    actor.usuario.usu_id,
    input.asunto,
    input.cuerpo,
    input.modo,
    input.plantilla,
    JSON.stringify(input.destinos),
  );
  return { id };
}

export async function editar(id: number, input: ComunicadoInput) {
  await exigirPlantilla(input.plantilla);
  const ok = await repo.editarComunicado(
    id,
    input.asunto,
    input.cuerpo,
    input.modo,
    input.plantilla,
    JSON.stringify(input.destinos),
  );
  if (!ok) throw new ApiError(409, 'Solo se puede editar un borrador');
  return { id };
}

export async function borrar(actor: AuthUser, id: number) {
  if (!(await repo.borrarComunicado(id))) {
    throw new ApiError(409, 'No se puede borrar un comunicado mientras se envía');
  }
  await auditar({ actor, accion: 'eliminar', entidad: 'comunicado', entidadId: id });
  return { id };
}

async function remitente(): Promise<{ de: string; responderA: string | null }> {
  const config = await obtenerConfig('comunicados');
  if (!config) throw new ApiError(500, 'Falta la fila de comunicados en correo_config (migración 0044)');
  if (!env.CORREO_DOMINIO) throw new ApiError(500, 'Falta CORREO_DOMINIO en Railway');
  return { de: `${config.nombre} <${config.usuario}@${env.CORREO_DOMINIO}>`, responderA: config.responder_a };
}

/**
 * Correo de prueba a una sola dirección, por la API de siempre (la de los
 * correos sueltos), no por Broadcasts: no crea contactos ni segmentos.
 */
export async function prueba(input: PruebaInput) {
  if (cuerpoVacio(input.cuerpo)) throw new ApiError(400, 'El correo está vacío');
  const plantilla = await exigirPlantilla(input.plantilla);
  const { de, responderA } = await remitente();
  const html = armarCorreo(input.cuerpo, plantilla?.complan_html ?? null);
  const salio = await enviarCorreo({
    para: input.correo,
    asunto: `[Prueba] ${input.asunto}`,
    html,
    texto: textoPlano(html),
    de,
    responderA,
    tipo: 'comunicados_prueba',
  });
  if (!salio) throw new ApiError(502, 'No salió la prueba. Revisa RESEND_API_KEY y el remitente.');
  return { enviado: true };
}

/** Pasa el borrador a la cola. El envío lo hace comunicados.envio.ts. */
export async function enviar(actor: AuthUser, id: number) {
  const c = await repo.obtenerComunicado(id);
  if (!c) throw new ApiError(404, 'Ese comunicado ya no existe');
  if (c.com_estado !== 'borrador') throw new ApiError(409, 'Este comunicado ya se envió');
  if (!c.com_asunto.trim()) throw new ApiError(400, 'Escribe el asunto');
  if (cuerpoVacio(c.com_cuerpo)) throw new ApiError(400, 'El correo está vacío');
  const destinos = c.com_destinos as Destino[];
  if (!Array.isArray(destinos) || destinos.length === 0) throw new ApiError(400, 'Elige a quién se envía');
  if (!hayClave()) throw new ApiError(500, 'Falta RESEND_API_KEY_BROADCASTS en Railway');
  await remitente();

  const plantilla = await exigirPlantilla(c.complan_id);
  const { lista } = await resolverDestinos(destinos);
  if (lista.length === 0) throw new ApiError(400, 'Con lo elegido no le llega a nadie');
  if (lista.length > MAX_DESTINATARIOS) {
    throw new ApiError(
      400,
      `Son ${lista.length} correos y el máximo por comunicado es ${MAX_DESTINATARIOS}. Divide el envío en grupos más pequeños.`,
    );
  }
  const texto = await textoDestinos(destinos);
  const html = armarCorreo(c.com_cuerpo, plantilla?.complan_html ?? null);

  await enTransaccion(async (client) => {
    if (!(await repo.ponerEnCola(client, id, actor.usuario.usu_id, texto, lista.length, html))) {
      throw new ApiError(409, 'Este comunicado ya se envió');
    }
    await repo.insertarDestinatarios(
      client,
      id,
      lista.map((d) => d.correo),
      lista.map((d) => d.nombre),
    );
    await auditar(
      { actor, accion: 'crear', entidad: 'comunicado_envio', entidadId: id, detalle: { destino: texto, total: lista.length } },
      client,
    );
  });
  despertar();
  return { id, total: lista.length, destino: texto };
}
