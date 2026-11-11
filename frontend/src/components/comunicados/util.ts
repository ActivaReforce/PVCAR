import { MARCADOR, type Destino, type Opciones, type Segmento } from '@/api/comunicados';
import { ZONA } from '@/lib/fecha';

/** Lo que comparten las pantallas de Comunicados. */

export const fechaHora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: ZONA,
      })
    : '—';

export function nombreDestino(d: Destino, ops: Opciones | undefined, segmentos: Segmento[] | undefined): string {
  if (d.tipo === 'contactos') return 'Todos los contactos';
  if (d.tipo === 'segmento') {
    const s = segmentos?.find((x) => x.comseg_id === d.segmento);
    return `Segmento «${s?.comseg_nombre ?? '…'}»`;
  }
  const col = d.colegio ? ops?.colegios.find((c) => c.id === d.colegio)?.nombre : null;
  const cur = d.curso ? ops?.cursos.find((c) => c.id === d.curso)?.nombre : null;
  const dis = d.disciplina ? ops?.disciplinas.find((c) => c.id === d.disciplina) : null;
  const partes = [col, cur, dis ? `${dis.nombre}${dis.horario ? ` (${dis.horario})` : ''}` : null].filter(Boolean);
  return partes.length ? `Representantes · ${partes.join(' · ')}` : 'Todos los representantes';
}

/** Estilos parecidos a los que el servidor pone en línea al enviar. */
const ESTILO_BASE = `
  table{border-collapse:collapse;width:100%;margin:12px 0}
  th,td{border:1px solid #d0d5dd;padding:6px 10px;text-align:left;vertical-align:top}
  th{background:#f2f4f7}
  p{margin:0 0 12px}
  img{max-width:100%;height:auto}
  ul,ol{margin:0 0 12px;padding-left:24px}
  blockquote{margin:0 0 12px;padding:4px 12px;border-left:3px solid #d0d5dd;color:#475467}
`;

/** Lo mismo que hace el servidor: contenido dentro de la plantilla o de un marco simple. */
export function previsualizar(cuerpo: string, plantilla: string | null): string {
  const estilo = `<style>${ESTILO_BASE}</style>`;
  if (!plantilla) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${estilo}</head><body style="margin:0;background:#fff"><div style="max-width:640px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f2937">${cuerpo}</div></body></html>`;
  }
  const html = plantilla.split(MARCADOR).join(cuerpo);
  return /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, `<head$1>${estilo}`) : `${estilo}${html}`;
}

