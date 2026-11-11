/**
 * El HTML de un comunicado: lo escrito + la plantilla = el correo que sale.
 *
 * Los clientes de correo (Gmail, Outlook) ignoran casi todo el CSS que no va
 * en línea, así que a las tablas, celdas, párrafos e imágenes que trae el
 * editor se les pone el estilo en el atributo `style`. Lo que ya traía un
 * estilo propio lo conserva: va después y manda.
 */

export const MARCADOR = '{{contenido}}';

/**
 * Quita lo que no debe ir en un correo: scripts, manejadores `on…` y enlaces
 * `javascript:`. Lo escribe el Propietario, no un desconocido, pero un correo
 * con eso acaba en spam o directamente rechazado.
 */
export function limpiarHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

const ESTILOS: Record<string, string> = {
  table: 'border-collapse:collapse;width:100%;margin:12px 0',
  th: 'border:1px solid #d0d5dd;padding:6px 10px;text-align:left;vertical-align:top;background:#f2f4f7',
  td: 'border:1px solid #d0d5dd;padding:6px 10px;text-align:left;vertical-align:top',
  p: 'margin:0 0 12px',
  img: 'max-width:100%;height:auto',
  h1: 'margin:0 0 12px;font-size:24px;line-height:1.3',
  h2: 'margin:0 0 12px;font-size:20px;line-height:1.3',
  h3: 'margin:0 0 12px;font-size:17px;line-height:1.3',
  ul: 'margin:0 0 12px;padding-left:24px',
  ol: 'margin:0 0 12px;padding-left:24px',
  blockquote: 'margin:0 0 12px;padding:4px 12px;border-left:3px solid #d0d5dd;color:#475467',
};

/** Pone en línea el estilo base de cada etiqueta, sin pisar el que ya tenga. */
export function estilarCuerpo(html: string): string {
  return html.replace(/<(table|th|td|p|img|h1|h2|h3|ul|ol|blockquote)\b([^>]*)>/gi, (_todo, etiqueta: string, attrs: string) => {
    const base = ESTILOS[etiqueta.toLowerCase()];
    if (!base) return _todo;
    const conEstilo = /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i.exec(attrs);
    if (conEstilo) {
      const propio = conEstilo[2] ?? '';
      const nuevo = attrs.replace(conEstilo[0], ` style="${base};${propio}"`);
      return `<${etiqueta}${nuevo}>`;
    }
    const cierre = attrs.endsWith('/') ? attrs.slice(0, -1) : attrs;
    const barra = attrs.endsWith('/') ? ' /' : '';
    return `<${etiqueta}${cierre} style="${base}"${barra}>`;
  });
}

/** Sin plantilla: un correo limpio, centrado y legible. */
function marcoSimple(contenido: string): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="es"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#ffffff">',
    '<div style="max-width:640px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f2937">',
    contenido,
    '</div></body></html>',
  ].join('');
}

/** El correo final: el cuerpo, limpio y con estilos en línea, dentro de su plantilla. */
export function armarCorreo(cuerpo: string, plantilla: string | null): string {
  const contenido = estilarCuerpo(limpiarHtml(cuerpo));
  if (!plantilla) return marcoSimple(contenido);
  // split/join y no replace: un "$&" escrito en el correo no debe expandirse.
  return limpiarHtml(plantilla).split(MARCADOR).join(contenido);
}

/** Texto plano para el correo de prueba (Resend lo pide junto al HTML). */
export function textoPlano(html: string): string {
  return html
    .replace(/<(style|head)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|table|blockquote)>/gi, '\n')
    .replace(/<(td|th)\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, '$3 ($2)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/** ¿El cuerpo dice algo? Un editor vacío deja `<p></p>`. */
export function cuerpoVacio(html: string): boolean {
  if (/<(img|table)\b/i.test(html)) return false;
  return textoPlano(html).length === 0;
}
