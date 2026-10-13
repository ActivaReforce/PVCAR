import type { PoolClient } from 'pg';
import { escaparHtml } from '../../lib/correo.js';
import { hoyEc } from '../../lib/fecha.js';
import type { HorarioDisciplina } from '../../lib/horarios.js';
import { ASISTENCIA } from '../asistencias/asistencias.schemas.js';
import { configuracion, enviarComo } from '../correos/correos.service.js';
import * as repo from './novedades.repository.js';

/**
 * Aviso automático de ausencia (punto 9, 2026-10-12).
 *
 * Al guardar la asistencia de alumnos, dentro de la misma transacción:
 *
 *   - Alumno en Ausente y su último aviso de esa clase no es una ausencia
 *     → novedad 'ausencia'.
 *   - Alumno en Presente, Tarde o Justificado y su último aviso de esa clase
 *     es una ausencia → novedad 'correccion'.
 *   - Lo demás no avisa. Guardar dos veces la misma lista no repite nada, y
 *     Ausente → Presente → Ausente avisa tres veces, que es lo que pasó.
 *
 * "Su último aviso" se busca entre las novedades (también las eliminadas de
 * la pantalla: el correo ya salió), no en la marca anterior: una corrección
 * solo tiene sentido si antes salió una ausencia.
 *
 * Los correos salen **después** del COMMIT, uno por alumno y en fila: si la
 * transacción se deshace no ha salido nada, y Resend admite dos por segundo.
 */

/** Solo se avisa de clases de hoy o de los últimos días: pasar lista atrasada de hace un mes no debe escribir a los padres. */
export const DIAS_DE_AVISO = 7;

const NOMBRE_ESTADO: Record<number, string> = {
  [ASISTENCIA.PRESENTE]: 'Presente',
  [ASISTENCIA.AUSENTE]: 'Ausente',
  [ASISTENCIA.TARDE]: 'Tarde',
  [ASISTENCIA.JUSTIFICADO]: 'Justificado',
};

export function fechaAvisable(fecha: string, hoy: string = hoyEc()): boolean {
  const dias = (Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${fecha}T00:00:00Z`)) / 86_400_000;
  return dias >= 0 && dias <= DIAS_DE_AVISO;
}

/** Qué aviso toca a una marca, sabiendo el último que salió de esa clase. */
export function avisoQueToca(
  asisest_id: number,
  ultimo: 'ausencia' | 'correccion' | undefined,
): 'ausencia' | 'correccion' | null {
  if (asisest_id === ASISTENCIA.AUSENTE) return ultimo === 'ausencia' ? null : 'ausencia';
  return ultimo === 'ausencia' ? 'correccion' : null;
}

export interface ClaseParaAviso {
  colacthor_id: number;
  col_nombre: string;
  act_nombre: string;
  horarios: HorarioDisciplina[];
}

export interface MarcaParaAviso {
  nino_id: number;
  asisest_id: number;
  hora_tarde?: string | null;
  razon?: string | null;
}

/** dia_id ISO de una fecha AAAA-MM-DD, sin depender de la zona del servidor. */
function diaIso(fecha: string): number {
  const d = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** 2026-10-12 → 12/10/2026 */
export const fechaLegible = (fecha: string) => fecha.split('-').reverse().join('/');

export function datosDe(clase: ClaseParaAviso, fecha: string, marca: MarcaParaAviso): repo.DatosClase {
  const h = clase.horarios.find((x) => x.dia_id === diaIso(fecha));
  return {
    colacthor_id: clase.colacthor_id,
    fecha,
    colegio: clase.col_nombre,
    actividad: clase.act_nombre,
    dia: (h?.dia_nombre ?? '').toLowerCase(),
    horario: h ? `${h.inicio}–${h.fin}` : null,
    estado: NOMBRE_ESTADO[marca.asisest_id] ?? '',
    hora_tarde: marca.asisest_id === ASISTENCIA.TARDE ? (marca.hora_tarde ?? null) : null,
    razon: marca.asisest_id === ASISTENCIA.JUSTIFICADO ? (marca.razon ?? null) : null,
  };
}

/** El texto de la tarjeta: se lee solo, sin abrir nada. */
export function textoDe(tipo: 'ausencia' | 'correccion', alumno: string, d: repo.DatosClase): string {
  const clase = `${d.actividad} en ${d.colegio} el ${d.dia ? `${d.dia} ` : ''}${fechaLegible(d.fecha)}${
    d.horario ? ` (${d.horario})` : ''
  }`;
  if (tipo === 'ausencia') return `${alumno} faltó a ${clase}.`;
  if (d.estado === 'Tarde') {
    return `Corrección: ${alumno} no faltó a ${clase}: llegó tarde${d.hora_tarde ? `, a las ${d.hora_tarde}` : ''}.`;
  }
  if (d.estado === 'Justificado') {
    return `Corrección: la ausencia de ${alumno} a ${clase} quedó justificada${d.razon ? `: ${d.razon}` : ''}.`;
  }
  return `Corrección: ${alumno} no faltó a ${clase}: estuvo presente.`;
}

/**
 * Escribe las novedades que tocan por este guardado. Devuelve sus ids para
 * mandar los correos cuando la transacción se haya confirmado.
 */
export async function registrarAvisos(
  client: PoolClient,
  opts: { clase: ClaseParaAviso; fecha: string; marcas: MarcaParaAviso[]; autorId: number },
): Promise<number[]> {
  if (opts.marcas.length === 0 || !fechaAvisable(opts.fecha)) return [];

  const ultimos = await repo.ultimoAvisoDeClase(
    client,
    opts.clase.colacthor_id,
    opts.fecha,
    opts.marcas.map((m) => m.nino_id),
  );
  const tocan = opts.marcas
    .map((m) => ({ marca: m, tipo: avisoQueToca(m.asisest_id, ultimos.get(m.nino_id)) }))
    .filter((x): x is { marca: MarcaParaAviso; tipo: 'ausencia' | 'correccion' } => x.tipo !== null);
  if (tocan.length === 0) return [];

  const nombres = await repo.nombresDeAlumnos(client, tocan.map((x) => x.marca.nino_id));
  const ids: number[] = [];
  for (const { marca, tipo } of tocan) {
    const datos = datosDe(opts.clase, opts.fecha, marca);
    ids.push(
      await repo.insertarAviso(client, {
        tipo,
        texto: textoDe(tipo, nombres.get(marca.nino_id) ?? 'El alumno', datos),
        autor_id: opts.autorId,
        nino_id: marca.nino_id,
        datos,
      }),
    );
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Correo

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resend admite 2 por segundo: uno cada 600 ms. */
const PAUSA_ENTRE_CORREOS = 600;

/** Nunca lanza: corre después de responder al entrenador. */
export async function enviarAvisos(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const [config, novedades] = await Promise.all([
      configuracion('ausencias'),
      repo.obtenerVarias(ids),
    ]);
    if (!config) {
      console.error('Avisos de ausencia no enviados: falta la fila "ausencias" en correo_config.');
      return;
    }
    for (const [i, n] of novedades.entries()) {
      if (i > 0) await esperar(PAUSA_ENTRE_CORREOS);
      const paraExtra = config.notificar_representante
        ? await repo.correosDeRepresentantesDe(n.alumnos.map((a) => a.id))
        : [];
      await enviarComo('ausencias', { ...correoDe(n), paraExtra });
    }
  } catch (err) {
    console.error('Avisos de ausencia no enviados:', err);
  }
}

export function correoDe(n: repo.Novedad): { asunto: string; html: string; texto: string } {
  const d = n.datos!;
  const alumno = n.alumnos[0];
  const nombre = alumno?.nombre ?? 'Alumno';
  const esAusencia = n.nov_tipo === 'ausencia';
  const titulo = esAusencia ? 'Ausencia' : 'Corrección de ausencia';
  const asunto = `${titulo}: ${nombre} — ${d.actividad}, ${fechaLegible(d.fecha)}`;

  const representantes = (alumno?.representantes ?? []).map((r) =>
    [r.nombre, r.telefono, r.correo].filter(Boolean).join(' · '),
  );
  const filas: Array<[string, string]> = [
    ['Alumno', nombre],
    ['Colegio', d.colegio],
    ['Disciplina', d.actividad],
    ['Fecha', `${d.dia ? `${d.dia} ` : ''}${fechaLegible(d.fecha)}`],
    ...(d.horario ? ([['Horario', d.horario]] as Array<[string, string]>) : []),
    ['Asistencia', d.estado],
    ...(d.hora_tarde ? ([['Hora de llegada', d.hora_tarde]] as Array<[string, string]>) : []),
    ...(d.razon ? ([['Motivo', d.razon]] as Array<[string, string]>) : []),
    ...(representantes.length > 0
      ? ([['Representante', representantes.join('\n')]] as Array<[string, string]>)
      : []),
    ['Registró', n.autor.usu_nombre],
  ];

  const texto = [titulo, '', n.nov_texto, '', ...filas.map(([k, v]) => `${k}: ${v}`)].join('\n');

  const color = esAusencia ? '#b91c1c' : '#047857';
  const html = `
    <!doctype html>
    <html>
    <body style="font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;padding:16px;">
      <h2 style="margin:0 0 8px 0;font-size:18px;color:${color};">${escaparHtml(titulo)}</h2>
      <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;">${escaparHtml(n.nov_texto)}</p>
      <table style="border-collapse:collapse;font-size:14px;">
        ${filas
          .map(
            ([k, v]) => `<tr>
          <td style="padding:4px 12px 4px 0;color:#555;vertical-align:top;white-space:nowrap;"><strong>${escaparHtml(k)}</strong></td>
          <td style="padding:4px 0;white-space:pre-line;">${escaparHtml(v)}</td>
        </tr>`,
          )
          .join('')}
      </table>
    </body>
    </html>
  `;
  return { asunto, html, texto };
}
