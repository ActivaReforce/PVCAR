import type { PoolClient } from 'pg';
import { getPool } from '../../config/db.js';
import { env } from '../../config/env.js';
import { contarEnvio } from '../../lib/correo.js';
import { obtenerConfig } from '../correos/correos.repository.js';
import * as repo from './comunicados.repository.js';
import * as resend from './comunicados.resend.js';
import { ResendError } from './comunicados.resend.js';

/**
 * El envío de un comunicado, por pasos y retomable.
 *
 *   en_cola → preparando → enviando → limpiando → enviado (o fallido)
 *
 * preparando  Crea en Resend un segmento temporal y mete en él a cada
 *             destinatario. Si el correo ya existía en Resend (contactos
 *             reales del cliente, 2026-11-11) solo se añade al segmento y se
 *             marca `existia`: nunca se borra ni se le cambia nada. Si no,
 *             se crea ya dentro del segmento y se marca `creado`. Luego crea
 *             el broadcast con `send: true`.
 * enviando    Pregunta a Resend hasta que el broadcast diga `sent`, y espera
 *             10 minutos más antes de limpiar para no quitar contactos a
 *             mitad de reparto.
 * limpiando   Borra los contactos `creado` y el segmento temporal (por su
 *             id: los segmentos del cliente no se tocan). Vacía la lista de
 *             trabajo: de un envío solo queda el texto del destino y el total.
 *
 * **De uno en uno.** El plan gratis de Resend admite 3 segmentos y el cliente
 * ya tiene 2; además, si dos envíos compartieran un correo, la limpieza del
 * primero se lo quitaría al segundo. Los demás esperan en cola.
 *
 * Lo mueve un temporizador cada 15 s (server.ts) y `despertar()` al enviar.
 * Un candado de Postgres (advisory lock) evita que dos procesos lo hagan a la
 * vez si algún día hay más de una réplica.
 */

const CANDADO = 74_044;
const LOTE = 50;
const ESPERA_TRAS_ENVIO_MS = 10 * 60_000;
const CADA_MS = 15_000;

let ocupado = false;

export function despertar(): void {
  void tick();
}

export function iniciarEnvios(): void {
  if (env.NODE_ENV === 'test') return;
  setInterval(despertar, CADA_MS).unref();
  despertar();
}

export async function tick(): Promise<void> {
  if (ocupado) return;
  ocupado = true;
  let client: PoolClient | null = null;
  try {
    client = await getPool().connect();
    const { rows } = await client.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [CANDADO]);
    if (!rows[0]?.ok) return;
    try {
      await procesar();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [CANDADO]);
    }
  } catch (err) {
    console.error('Comunicados: el envío se retomará en el siguiente turno:', err);
  } finally {
    client?.release();
    ocupado = false;
  }
}

/** Avanza lo que se pueda ahora. Sale cuando toca esperar a Resend o no queda nada. */
export async function procesar(): Promise<void> {
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    const c = await repo.siguienteEnvio();
    if (!c) return;

    try {
      switch (c.com_estado) {
        case 'en_cola':
          await repo.cambiarEstado(c.com_id, 'preparando', null);
          break;
        case 'preparando':
          await preparar(c);
          break;
        case 'enviando':
          if (!(await revisarEnvio(c))) return; // sigue en Resend: otro turno
          break;
        case 'limpiando':
          await limpiar(c);
          break;
        default:
          return;
      }
    } catch (err) {
      if (err instanceof ResendError && !err.pasajero) {
        // Definitivo (key sin permiso, datos rechazados…): se limpia lo hecho
        // y queda como fallido con el motivo.
        console.error(`Comunicado ${c.com_id}: Resend lo rechazó:`, err.message);
        // Si falla la propia limpieza, se da por terminado: reintentarla
        // para siempre no arregla una key sin permiso.
        await repo.cambiarEstado(c.com_id, c.com_estado === 'limpiando' ? 'fallido' : 'limpiando', err.message);
        continue;
      }
      throw err;
    }
  }
}

async function preparar(c: repo.EnCurso): Promise<void> {
  let segmento = c.com_resend_segmento;
  if (!segmento) {
    segmento = await resend.crearSegmento(`PVCAR comunicado ${c.com_id} (${env.NODE_ENV})`);
    await repo.guardarSegmentoResend(c.com_id, segmento);
  }

  for (;;) {
    const lote = await repo.destinatariosPorEstado(c.com_id, ['pendiente', 'creando'], LOTE);
    if (lote.length === 0) break;
    for (const d of lote) {
      if (await resend.existeContacto(d.correo)) {
        // 'creando' que ya existe: lo creó este mismo envío antes de un corte.
        await resend.anadirASegmento(d.correo, segmento);
        await repo.marcarDestinatario(c.com_id, d.correo, d.estado === 'creando' ? 'creado' : 'existia');
      } else {
        await repo.marcarDestinatario(c.com_id, d.correo, 'creando');
        try {
          await resend.crearContacto(d.correo, d.nombre, segmento);
        } catch (err) {
          // Un correo que Resend no acepta (400/422) se salta; el resto sigue.
          if (err instanceof ResendError && (err.status === 400 || err.status === 422)) {
            console.error(`Comunicado ${c.com_id}: Resend no aceptó ${d.correo}:`, err.message);
            await repo.marcarDestinatario(c.com_id, d.correo, 'borrado');
            continue;
          }
          throw err;
        }
        await repo.marcarDestinatario(c.com_id, d.correo, 'creado');
      }
    }
  }

  if (!c.com_resend_broadcast) {
    const config = await obtenerConfig('comunicados');
    if (!config || !env.CORREO_DOMINIO) {
      throw new ResendError(400, 'Falta el remitente de Comunicados (Configuración) o CORREO_DOMINIO');
    }
    if (!c.com_html) throw new ResendError(400, 'El comunicado no tiene contenido');
    const id = await resend.enviarBroadcast({
      segmentoId: segmento,
      de: `${config.nombre} <${config.usuario}@${env.CORREO_DOMINIO}>`,
      responderA: config.responder_a,
      asunto: c.com_asunto,
      html: c.com_html,
      nombre: `PVCAR #${c.com_id}: ${c.com_asunto}`.slice(0, 200),
    });
    await repo.guardarBroadcastResend(c.com_id, id);
    // "Correos enviados hoy" del tablero: los que de verdad entraron al segmento.
    const enSegmento = await repo.contarDestinatariosEnSegmento(c.com_id);
    await contarEnvio('comunicados', enSegmento);
  }
  await repo.cambiarEstado(c.com_id, 'enviando', null);
}

/** true si ya se puede limpiar. */
async function revisarEnvio(c: repo.EnCurso): Promise<boolean> {
  if (!c.com_resend_broadcast) {
    await repo.cambiarEstado(c.com_id, 'limpiando', 'No quedó registrado el envío en Resend');
    return true;
  }
  const { status, sent_at } = await resend.estadoBroadcast(c.com_resend_broadcast);
  if (status === 'sent') {
    const desde = sent_at ? Date.parse(sent_at) : NaN;
    if (Number.isFinite(desde) && Date.now() - desde < ESPERA_TRAS_ENVIO_MS) return false;
    await repo.cambiarEstado(c.com_id, 'limpiando', null);
    return true;
  }
  if (status === 'canceled' || status === 'draft' || status === null) {
    const motivo =
      status === 'canceled'
        ? 'Resend canceló el envío'
        : status === 'draft'
          ? 'Resend no lo envió (quedó como borrador)'
          : 'El envío ya no existe en Resend';
    await repo.cambiarEstado(c.com_id, 'limpiando', motivo);
    return true;
  }
  return false; // queued / scheduled / sending
}

async function limpiar(c: repo.EnCurso): Promise<void> {
  for (;;) {
    const lote = await repo.destinatariosPorEstado(c.com_id, ['creado', 'creando'], LOTE);
    if (lote.length === 0) break;
    for (const d of lote) {
      await resend.borrarContacto(d.correo);
      await repo.marcarDestinatario(c.com_id, d.correo, 'borrado');
    }
  }
  if (c.com_resend_segmento) await resend.borrarSegmento(c.com_resend_segmento);
  await repo.vaciarDestinatarios(c.com_id);
  await repo.cambiarEstado(c.com_id, c.com_error ? 'fallido' : 'enviado', null);
}
