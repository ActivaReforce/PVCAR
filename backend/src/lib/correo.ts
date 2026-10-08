import { env } from '../config/env.js';

/**
 * Correo propio de la aplicacion, por la API HTTP de Resend.
 *
 * Hasta la Fase 14B el sistema solo mandaba un correo, el de recuperar la
 * contrasena, y ese lo manda Supabase Auth. El de "inscripcion aprobada" es
 * de la aplicacion y no tiene plantilla en Supabase: sale de aqui.
 *
 * Nunca lanza. Un correo que no sale no debe deshacer la operacion que lo
 * pidio (la inscripcion ya esta aprobada); devuelve si salio y el llamador
 * se lo cuenta al usuario.
 */
export interface Correo {
  para: string | string[];
  asunto: string;
  html: string;
  texto: string;
  /** "Nombre <usuario@dominio>". Lo arma modules/correos con la configuracion del tipo. */
  de: string;
  /** Copias visibles: el destinatario ve a quien mas le llego. */
  cc?: string[];
  responderA?: string | null;
  /** Resend acepta adjuntos en base64; el total no debe pasar de 40 MB. */
  adjuntos?: Array<{ nombre: string; contenido: Buffer }>;
}

export async function enviarCorreo(correo: Correo): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.error('Correo no enviado: falta RESEND_API_KEY.');
    return false;
  }

  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: correo.de,
        to: Array.isArray(correo.para) ? correo.para : [correo.para],
        ...(correo.cc?.length ? { cc: correo.cc } : {}),
        ...(correo.responderA ? { reply_to: correo.responderA } : {}),
        subject: correo.asunto,
        html: correo.html,
        text: correo.texto,
        ...(correo.adjuntos?.length
          ? {
              attachments: correo.adjuntos.map((a) => ({
                filename: a.nombre,
                content: a.contenido.toString('base64'),
              })),
            }
          : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!respuesta.ok) {
      console.error(`Resend respondio ${respuesta.status}:`, await respuesta.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('No se pudo llamar a Resend:', err);
    return false;
  }
}

/** Escapa texto para meterlo en el HTML de un correo. */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
