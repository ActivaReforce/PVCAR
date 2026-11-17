import { frontendBaseUrl } from '../../config/env.js';
import { getPool } from '../../config/db.js';
import { ROL } from '../../lib/constants.js';
import { escaparHtml } from '../../lib/correo.js';
import { ahoraEc, hoyEc } from '../../lib/fecha.js';
import { enTransaccion } from '../../lib/tx.js';
import { enviarComo } from '../correos/correos.service.js';
import { mesDe, nombreDeMes, type Mes } from './mensualidades.calculo.js';
import { registrosMensuales } from './mensualidades.service.js';
import * as repo from './mensualidades.repository.js';

/**
 * Aviso de mensualidades atrasadas (cliente, 2026-11-16).
 *
 * El día siguiente al día límite de cada colegio, a las 7:00 de Ecuador, sale
 * **una sola novedad** "Mensualidad atrasada" con todos los alumnos que deben
 * algún mes vencido (la ven solo Propietario y Admin) y **un solo correo** con
 * el mismo detalle a la lista de 'mensualidades_atrasadas' (nunca a los
 * representantes). Si nadie debe, no sale nada.
 *
 * Corre una vez al día a las 7:00 y además al arrancar el servidor: si Railway
 * estaba reiniciándose a esa hora, lo pendiente sale al volver. Que cada
 * colegio y mes avise una sola vez lo garantiza `mensualidad_aviso_atraso`
 * (se reclama con INSERT … ON CONFLICT DO NOTHING antes de hacer nada).
 */

const HORA = 7;

export interface Atrasado {
  alumno: string;
  colegio: string;
  representante: string;
  telefono: string;
  correo: string;
  meses: Mes[];
  debe: number;
}

/** Hora (0-23) de Ecuador ahora. */
const horaEc = () => Number(ahoraEc().slice(11, 13));

/** El texto de la novedad: una línea por alumno. */
export function textoDeNovedad(mes: Mes, atrasados: Atrasado[]): string {
  const total = atrasados.reduce((s, a) => s + Math.round(a.debe * 100), 0) / 100;
  const lineas = atrasados.map(
    (a) =>
      `• ${a.alumno} (${a.colegio}) — debe ${a.meses.map((m) => nombreDeMes(m)).join(', ')}: $${a.debe.toFixed(2)}` +
      (a.representante ? ` · ${a.representante}${a.telefono ? ` ${a.telefono}` : ''}` : ''),
  );
  return [
    `Mensualidad atrasada (${nombreDeMes(mes)}): ${atrasados.length} ${atrasados.length === 1 ? 'alumno debe' : 'alumnos deben'} $${total.toFixed(2)}.`,
    '',
    ...lineas,
  ].join('\n');
}

function correoDe(mes: Mes, atrasados: Atrasado[]): { asunto: string; html: string; texto: string } {
  const total = atrasados.reduce((s, a) => s + Math.round(a.debe * 100), 0) / 100;
  const asunto = `Mensualidades atrasadas — ${nombreDeMes(mes)}: ${atrasados.length} ${atrasados.length === 1 ? 'alumno' : 'alumnos'}, $${total.toFixed(2)}`;
  const enlace = `${frontendBaseUrl}/inscripciones`;
  const filas = atrasados
    .map(
      (a) => `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;">${escaparHtml(a.alumno)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;">${escaparHtml(a.colegio)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;">${escaparHtml(a.meses.map((m) => nombreDeMes(m)).join(', '))}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">$${a.debe.toFixed(2)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;">${escaparHtml(a.representante)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;">${escaparHtml(a.telefono)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;">${escaparHtml(a.correo)}</td>
      </tr>`,
    )
    .join('');
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;padding:16px;">
    <h2 style="margin:0 0 8px 0;font-size:18px;color:#b91c1c;">Mensualidades atrasadas — ${escaparHtml(nombreDeMes(mes))}</h2>
    <p style="margin:0 0 12px 0;font-size:15px;">${atrasados.length} ${atrasados.length === 1 ? 'alumno debe' : 'alumnos deben'} en total <strong>$${total.toFixed(2)}</strong>. Mientras deban, salen ausentes en Asistencias.</p>
    <table style="border-collapse:collapse;font-size:13px;">
      <tr style="background:#f4f4f5;text-align:left;">
        <th style="padding:4px 8px;">Alumno</th><th style="padding:4px 8px;">Colegio</th><th style="padding:4px 8px;">Debe</th>
        <th style="padding:4px 8px;">Valor</th><th style="padding:4px 8px;">Representante</th><th style="padding:4px 8px;">Teléfono</th><th style="padding:4px 8px;">Correo</th>
      </tr>${filas}
    </table>
    <p style="margin:12px 0 0 0;font-size:13px;">Detalle en <a href="${escaparHtml(enlace)}">${escaparHtml(enlace)}</a> → Mensualidades → Estado del mes.</p>
  </body></html>`;
  return { asunto, html, texto: textoDeNovedad(mes, atrasados) };
}

/**
 * Los atrasados de hoy, por colegio: lo vencido sin pagar (un mes en
 * revisión no cuenta). Agrupado por alumno.
 */
async function atrasadosPorColegio(): Promise<Map<number, Atrasado[]>> {
  const registros = await registrosMensuales(null);
  const porAlumno = new Map<string, Atrasado & { col_id: number }>();
  for (const r of registros) {
    if (r.estado !== 'atrasado' || r.col_id === null) continue;
    const k = `${r.col_id}|${r.nino_id ?? r.alumno}`;
    const a = porAlumno.get(k) ?? {
      col_id: r.col_id,
      alumno: r.alumno,
      colegio: r.col_nombre,
      representante: r.representante,
      telefono: r.telefono,
      correo: r.correo,
      meses: [],
      debe: 0,
    };
    a.meses.push(r.mes);
    a.debe = Math.round((a.debe + r.valor) * 100) / 100;
    porAlumno.set(k, a);
  }
  const resultado = new Map<number, Atrasado[]>();
  for (const { col_id, ...a } of porAlumno.values()) {
    a.meses.sort();
    resultado.set(col_id, [...(resultado.get(col_id) ?? []), a]);
  }
  for (const lista of resultado.values()) lista.sort((x, y) => x.alumno.localeCompare(y.alumno));
  return resultado;
}

/** El autor de la novedad automática: el primer Propietario activo. */
async function autorDelSistema(): Promise<number | null> {
  const { rows } = await getPool().query<{ usu_id: number }>(
    `SELECT u.usu_id FROM public.usuario u
       JOIN public.usuario_rol ur ON ur.usu_id = u.usu_id
      WHERE ur.rol_id = $1 AND u.est_id = 1
      ORDER BY u.usu_id LIMIT 1`,
    [ROL.PROPIETARIO],
  );
  return rows[0]?.usu_id ?? null;
}

/**
 * Revisa qué colegios ya pasaron su día límite este mes sin haber avisado, y
 * avisa de todos ellos en una sola novedad y un solo correo. Nunca lanza.
 */
export async function revisarAtrasos(): Promise<void> {
  try {
    const hoy = hoyEc();
    if (horaEc() < HORA) return;
    const mes = mesDe(hoy);
    const dia = Number(hoy.slice(8, 10));

    const colegios = await repo.colegios();
    const tocan = colegios.filter((c) => c.meses.includes(mes) && dia > c.diaLimite);
    if (tocan.length === 0) return;

    const { rows: hechos } = await getPool().query<{ col_id: number }>(
      `SELECT col_id FROM public.mensualidad_aviso_atraso WHERE menavi_mes = $1::date AND col_id = ANY($2::int[])`,
      [mes, tocan.map((c) => c.col_id)],
    );
    const pendientes = tocan.filter((c) => !hechos.some((h) => h.col_id === c.col_id));
    if (pendientes.length === 0) return;

    const porColegio = await atrasadosPorColegio();
    const autor = await autorDelSistema();

    const avisados = await enTransaccion(async (client) => {
      // Se reclaman los colegios: si otro proceso ya lo hizo, no se repite.
      const reclamados: number[] = [];
      for (const c of pendientes) {
        const { rowCount } = await client.query(
          `INSERT INTO public.mensualidad_aviso_atraso (col_id, menavi_mes) VALUES ($1, $2::date)
           ON CONFLICT (col_id, menavi_mes) DO NOTHING`,
          [c.col_id, mes],
        );
        if ((rowCount ?? 0) > 0) reclamados.push(c.col_id);
      }
      const atrasados = reclamados.flatMap((id) => porColegio.get(id) ?? []);
      if (atrasados.length === 0 || autor === null) return atrasados;

      const { rows } = await client.query<{ nov_id: number }>(
        `INSERT INTO public.novedad (nov_tipo, nov_texto, nov_autor_id) VALUES ('mensualidad', $1, $2) RETURNING nov_id`,
        [textoDeNovedad(mes, atrasados).slice(0, 20000), autor],
      );
      await client.query(
        `UPDATE public.mensualidad_aviso_atraso SET nov_id = $1 WHERE menavi_mes = $2::date AND col_id = ANY($3::int[])`,
        [rows[0]!.nov_id, mes, reclamados],
      );
      return atrasados;
    });

    if (avisados.length > 0) await enviarComo('mensualidades_atrasadas', correoDe(mes, avisados));
  } catch (err) {
    console.error('Aviso de mensualidades atrasadas no enviado:', err);
  }
}

/** Ms hasta las próximas 7:00 de Ecuador (UTC-5, sin horario de verano). */
export function msHastaLaHora(ahora: Date = new Date()): number {
  const ec = new Date(ahora.getTime() - 5 * 3_600_000);
  const objetivo = Date.UTC(ec.getUTCFullYear(), ec.getUTCMonth(), ec.getUTCDate(), HORA) + 5 * 3_600_000;
  const siguiente = objetivo > ahora.getTime() ? objetivo : objetivo + 24 * 3_600_000;
  return siguiente - ahora.getTime();
}

/** Arranca la revisión: ahora (por si quedó algo pendiente) y cada día a las 7:00. */
export function iniciarAvisosDeAtraso(): void {
  const programar = () => {
    setTimeout(() => {
      void revisarAtrasos().finally(programar);
    }, msHastaLaHora()).unref();
  };
  // Un minuto después de arrancar: deja que el servidor termine de levantarse.
  setTimeout(() => void revisarAtrasos(), 60_000).unref();
  programar();
}
