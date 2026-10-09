import { env } from '../../config/env.js';
import { auditar } from '../../lib/auditoria.js';
import { ROL } from '../../lib/constants.js';
import { enviarCorreo, type Correo } from '../../lib/correo.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as repo from './correos.repository.js';
import type { ConfigCorreoInput } from './correos.schemas.js';

/**
 * Configuracion de correos: quien envia cada tipo y a quien va en copia.
 *
 * Solo el Propietario (decidido por el cliente el 2026-10-07). No es un
 * permiso del modal de Permisos: es una regla fija, como la de no quedarse
 * sin Propietario, y se comprueba aqui aunque la pantalla ya la esconda.
 */
/** Tipos que van a una lista fija de destinatarios (avisos internos). */
export const TIPOS_CON_PARA: readonly repo.TipoCorreo[] = ['inscripciones_aviso', 'novedades'];

/** Tipos que usan el switch `notificar_mencionado`. */
export const TIPOS_CON_MENCIONADO: readonly repo.TipoCorreo[] = ['novedades'];

function exigirPropietario(actor: AuthUser): void {
  if (!actor.usuario.roles.some((r) => r.rol_id === ROL.PROPIETARIO)) {
    throw new ApiError(403, 'Solo el Propietario configura los correos');
  }
}

export interface ConfigCorreoConDominio extends repo.ConfigCorreo {
  /** CORREO_DOMINIO de Railway; null si falta, y entonces no sale ningun correo. */
  dominio: string | null;
}

export async function obtener(actor: AuthUser, tipo: repo.TipoCorreo): Promise<ConfigCorreoConDominio> {
  exigirPropietario(actor);
  const config = await repo.obtenerConfig(tipo);
  if (!config) throw new ApiError(404, 'Ese tipo de correo no tiene configuracion');
  return { ...config, dominio: env.CORREO_DOMINIO ?? null };
}

export async function guardar(
  actor: AuthUser,
  tipo: repo.TipoCorreo,
  input: ConfigCorreoInput,
): Promise<ConfigCorreoConDominio> {
  exigirPropietario(actor);
  await enTransaccion(async (client) => {
    const antes = await repo.obtenerConfig(tipo, client);
    if (!antes) throw new ApiError(404, 'Ese tipo de correo no tiene configuracion');
    // Solo el aviso interno tiene destinatarios fijos: en el resto el
    // destinatario es la persona del caso (el representante).
    const para = TIPOS_CON_PARA.includes(tipo) ? input.para : [];
    const notificar_mencionado = TIPOS_CON_MENCIONADO.includes(tipo)
      ? input.notificar_mencionado
      : false;
    await repo.guardarConfig(client, { tipo, ...input, para, notificar_mencionado });
    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'correo_config',
        entidadId: tipo,
        detalle: { tipo, antes, despues: input },
      },
      client,
    );
  });
  return obtener(actor, tipo);
}

/**
 * Envia un correo con el remitente, las copias y la respuesta de su tipo.
 *
 * Igual que enviarCorreo, nunca lanza: devuelve si salio. Sin dominio o sin
 * fila de configuracion no sale y se avisa en el log.
 */
export async function enviarComo(
  tipo: repo.TipoCorreo,
  correo: Omit<Correo, 'de' | 'cc' | 'responderA' | 'para'> & {
    /** Si se pasa, sustituye al Para fijo de la configuración. */
    para?: string | string[];
    /** Correos extra a sumar al Para configurado. */
    paraExtra?: string[];
  },
): Promise<boolean> {
  if (!env.CORREO_DOMINIO) {
    console.error('Correo no enviado: falta CORREO_DOMINIO.');
    return false;
  }
  let config: repo.ConfigCorreo | null;
  try {
    config = await repo.obtenerConfig(tipo);
  } catch (err) {
    console.error(`Correo no enviado: no se pudo leer la configuracion de "${tipo}":`, err);
    return false;
  }
  if (!config) {
    console.error(`Correo no enviado: "${tipo}" no tiene fila en correo_config.`);
    return false;
  }
  // Con destinatario propio (el representante) va a él; si no, a la lista fija.
  const base = correo.para
    ? Array.isArray(correo.para)
      ? correo.para
      : [correo.para]
    : config.para;
  const para = [...new Set([...base, ...(correo.paraExtra ?? [])])].filter(Boolean);
  if (para.length === 0) {
    console.error(`Correo "${tipo}" no enviado: no tiene destinatarios.`);
    return false;
  }
  const { paraExtra: _ignorado, ...resto } = correo;
  return enviarCorreo({
    ...resto,
    para,
    de: `${config.nombre} <${config.usuario}@${env.CORREO_DOMINIO}>`,
    cc: config.cc,
    responderA: config.responder_a,
  });
}

export async function configuracion(
  tipo: repo.TipoCorreo,
): Promise<repo.ConfigCorreo | null> {
  return repo.obtenerConfig(tipo);
}
