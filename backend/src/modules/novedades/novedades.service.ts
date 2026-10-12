import { alcanceDe } from '../../lib/alcance.js';
import { auditar } from '../../lib/auditoria.js';
import { ROL, ROLES_GLOBALES } from '../../lib/constants.js';
import { ahoraEc } from '../../lib/fecha.js';
import { escaparHtml } from '../../lib/correo.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import { configuracion, enviarComo } from '../correos/correos.service.js';
import * as repo from './novedades.repository.js';
import type { CrearInput, FiltrosListar } from './novedades.schemas.js';

/**
 * Novedades (punto 8 del Roadmap, 2026-10-09).
 *
 * Reglas de visibilidad:
 *   - Propietario y Admin ven todas.
 *   - El resto ve las suyas (nov_autor_id = él).
 *   - Si el switch `notificar_mencionado` está activo, también ve las que
 *     lo mencionan (personal) o las que mencionan a sus hijos (alumno).
 *   - Las de tipo `general` solo las ve el autor y los globales.
 *
 * Correos:
 *   - Siempre al Para + CC configurado del tipo 'novedades'.
 *   - Si el switch está activo:
 *       personal → se añaden los correos de los usuarios mencionados.
 *       alumno   → se añaden los correos de los representantes.
 */

function esGlobal(actor: AuthUser): boolean {
  return actor.usuario.roles.some((r) => ROLES_GLOBALES.includes(r.rol_id));
}

function esRepresentante(actor: AuthUser): boolean {
  return actor.usuario.roles.some((r) => r.rol_id === ROL.REPRESENTANTE);
}

export async function listar(actor: AuthUser, filtros: FiltrosListar): Promise<repo.Novedad[]> {
  const global = esGlobal(actor);
  const config = await configuracion('novedades');
  const verSobreMi = config?.notificar_mencionado ?? false;

  const ninosDelActor = verSobreMi && esRepresentante(actor)
    ? await repo.ninosDelRepresentante(actor.usuario.usu_id)
    : [];

  return repo.listar({
    tipo: filtros.tipo,
    autor: filtros.autor,
    persona: filtros.persona,
    alumno: filtros.alumno,
    desde: filtros.desde,
    hasta: filtros.hasta,
    buscar: filtros.buscar,
    limit: filtros.limit,
    offset: filtros.offset,
    visibilidad: global
      ? null
      : {
          actorId: actor.usuario.usu_id,
          ninosDelActor,
          verSobreMi,
        },
  });
}

export async function obtener(actor: AuthUser, id: number): Promise<repo.Novedad> {
  const novedad = await repo.obtener(id);
  if (!novedad) throw new ApiError(404, 'La novedad no existe');

  if (!esGlobal(actor) && novedad.autor.usu_id !== actor.usuario.usu_id) {
    const config = await configuracion('novedades');
    const switchOn = config?.notificar_mencionado ?? false;
    let puedeVer = false;
    if (switchOn) {
      if (novedad.nov_tipo === 'personal') {
        puedeVer = novedad.personas.some((p) => p.id === actor.usuario.usu_id);
      } else if (novedad.nov_tipo === 'alumno' && esRepresentante(actor)) {
        const mios = new Set(await repo.ninosDelRepresentante(actor.usuario.usu_id));
        puedeVer = novedad.alumnos.some((a) => mios.has(a.id));
      }
    }
    if (!puedeVer) throw new ApiError(403, 'No puedes ver esta novedad');
  }

  return novedad;
}

export async function crear(actor: AuthUser, input: CrearInput): Promise<repo.Novedad> {
  // Validar que las menciones existan y estén activas, dentro del alcance.
  if (input.tipo === 'personal') {
    const existen = await repo.existenUsuariosActivos(input.usu_ids);
    const faltan = input.usu_ids.filter((id) => !existen.includes(id));
    if (faltan.length > 0) {
      throw new ApiError(400, `Hay personas que no se pueden mencionar: ${faltan.join(', ')}`);
    }
  } else if (input.tipo === 'alumno') {
    const existen = await repo.existenAlumnosActivos(input.nino_ids);
    const faltan = input.nino_ids.filter((id) => !existen.includes(id));
    if (faltan.length > 0) {
      throw new ApiError(400, `Hay alumnos que no se pueden mencionar: ${faltan.join(', ')}`);
    }
    // Alcance: el actor solo puede mencionar alumnos de su alcance.
    const alcance = await alcanceDe(actor.usuario);
    if (!alcance.global) {
      const permitidos = new Set<number>([
        ...alcance.ninos,
      ]);
      const porDisciplinas = new Set<number>();
      if (alcance.disciplinas.length > 0 || alcance.disciplinasDeHijos.length > 0) {
        // Delego: pido alumnos disponibles con mi alcance y chequeo que todos los
        // nino_ids pedidos estén dentro.
        const disponibles = await repo.alumnosDisponibles({
          limit: 1000,
          global: false,
          ninos: [...alcance.ninos, ...permitidos],
          disciplinas: [...alcance.disciplinas, ...alcance.disciplinasDeHijos],
          colegios: alcance.colegios,
        });
        for (const n of disponibles) porDisciplinas.add(n.nino_id);
      }
      const porColegio = new Set<number>();
      if (alcance.colegios.length > 0) {
        const disp = await repo.alumnosDisponibles({
          limit: 10000,
          global: false,
          colegios: alcance.colegios,
        });
        for (const n of disp) porColegio.add(n.nino_id);
      }
      const todos = new Set<number>([...permitidos, ...porDisciplinas, ...porColegio]);
      const fuera = input.nino_ids.filter((id) => !todos.has(id));
      if (fuera.length > 0) {
        throw new ApiError(403, 'Hay alumnos fuera de tu alcance');
      }
    }
  }

  const novedadId = await enTransaccion(async (client) => {
    const nov_id = await repo.insertar(client, {
      tipo: input.tipo,
      texto: input.texto,
      autor_id: actor.usuario.usu_id,
    });
    if (input.tipo === 'personal') {
      await repo.ligarPersonas(client, nov_id, input.usu_ids);
    } else if (input.tipo === 'alumno') {
      await repo.ligarAlumnos(client, nov_id, input.nino_ids);
    }
    await auditar(
      {
        actor,
        accion: 'crear',
        entidad: 'novedad',
        entidadId: nov_id,
        detalle: {
          tipo: input.tipo,
          personas: input.tipo === 'personal' ? input.usu_ids : undefined,
          alumnos: input.tipo === 'alumno' ? input.nino_ids : undefined,
        },
      },
      client,
    );
    return nov_id;
  });

  const novedad = await repo.obtener(novedadId);
  if (!novedad) throw new ApiError(500, 'La novedad se guardó pero no se puede releer');

  void mandarCorreo(novedad);
  return novedad;
}

export async function eliminar(actor: AuthUser, id: number): Promise<{ eliminada: true }> {
  const novedad = await repo.obtener(id);
  if (!novedad) throw new ApiError(404, 'La novedad no existe');

  if (novedad.autor.usu_id !== actor.usuario.usu_id && !esGlobal(actor)) {
    throw new ApiError(403, 'Solo el autor o un administrador puede borrarla');
  }

  await enTransaccion(async (client) => {
    await repo.eliminar(client, id);
    await auditar(
      {
        actor,
        accion: 'eliminar',
        entidad: 'novedad',
        entidadId: id,
        detalle: {
          tipo: novedad.nov_tipo,
          autor_id: novedad.autor.usu_id,
          texto: novedad.nov_texto,
        },
      },
      client,
    );
  });

  return { eliminada: true };
}

/**
 * Personal mencionable. En v1 cualquier usuario activo; el cliente lo
 * confirmó así ("cualquier persona de la plataforma"). Si luego pide
 * restringir por alcance, se aplica aquí.
 */
export async function personalMencionable(
  _actor: AuthUser,
  opts: { buscar?: string; limit: number },
) {
  return repo.personalDisponible(opts);
}

/** Alumnos mencionables dentro del alcance del actor. */
export async function alumnosMencionables(
  actor: AuthUser,
  opts: { buscar?: string; limit: number },
) {
  const alcance = await alcanceDe(actor.usuario);
  return repo.alumnosDisponibles({
    buscar: opts.buscar,
    limit: opts.limit,
    global: alcance.global,
    ninos: alcance.ninos,
    disciplinas: [...alcance.disciplinas, ...alcance.disciplinasDeHijos],
    colegios: alcance.colegios,
  });
}

// ---------------------------------------------------------------------------
// Correo

async function mandarCorreo(novedad: repo.Novedad): Promise<void> {
  const config = await configuracion('novedades');
  if (!config) return;

  const paraExtra: string[] = [];
  if (config.notificar_mencionado) {
    if (novedad.nov_tipo === 'personal') {
      const correos = await repo.correosDeUsuarios(novedad.personas.map((p) => p.id));
      paraExtra.push(...correos);
    } else if (novedad.nov_tipo === 'alumno') {
      const correos = await repo.correosDeRepresentantesDe(novedad.alumnos.map((a) => a.id));
      paraExtra.push(...correos);
    }
  }

  const asunto = asuntoDe(novedad);
  const { html, texto } = cuerpoDe(novedad);
  void enviarComo('novedades', { asunto, html, texto, paraExtra });
}

function asuntoDe(n: repo.Novedad): string {
  if (n.nov_tipo === 'general') return `Nueva novedad general — ${n.autor.usu_nombre}`;
  if (n.nov_tipo === 'personal') {
    const nombres = n.personas.map((p) => p.nombre);
    return `Novedad sobre ${listado(nombres)}`;
  }
  const nombres = n.alumnos.map((a) => a.nombre);
  return `Novedad sobre ${listado(nombres)}`;
}

function listado(xs: string[]): string {
  if (xs.length === 0) return '';
  if (xs.length === 1) return xs[0]!;
  if (xs.length === 2) return `${xs[0]} y ${xs[1]}`;
  if (xs.length === 3) return `${xs[0]}, ${xs[1]} y ${xs[2]}`;
  return `${xs[0]}, ${xs[1]} y ${xs.length - 2} más`;
}

function cuerpoDe(n: repo.Novedad): { html: string; texto: string } {
  const fecha = ahoraEc();
  const tipoTexto =
    n.nov_tipo === 'general' ? 'General' : n.nov_tipo === 'personal' ? 'Sobre personal' : 'Sobre alumnos';

  const mencionesTexto =
    n.nov_tipo === 'personal'
      ? n.personas.map((p) => p.nombre).join(', ')
      : n.nov_tipo === 'alumno'
        ? n.alumnos
            .map((a) => `${a.nombre}${a.col_nombre ? ` (${a.col_nombre})` : ''}`)
            .join(', ')
        : '';

  const texto = [
    `Novedad — ${tipoTexto}`,
    `Autor: ${n.autor.usu_nombre}`,
    `Fecha: ${fecha}`,
    mencionesTexto ? `Menciona: ${mencionesTexto}` : null,
    '',
    n.nov_texto,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <!doctype html>
    <html>
    <body style="font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;padding:16px;">
      <h2 style="margin:0 0 8px 0;font-size:18px;">Novedad — ${escaparHtml(tipoTexto)}</h2>
      <p style="margin:0 0 4px 0;font-size:14px;color:#555;"><strong>Autor:</strong> ${escaparHtml(
        n.autor.usu_nombre,
      )}</p>
      <p style="margin:0 0 4px 0;font-size:14px;color:#555;"><strong>Fecha:</strong> ${escaparHtml(
        fecha,
      )}</p>
      ${
        mencionesTexto
          ? `<p style="margin:0 0 12px 0;font-size:14px;color:#555;"><strong>Menciona:</strong> ${escaparHtml(
              mencionesTexto,
            )}</p>`
          : ''
      }
      <div style="margin-top:12px;padding:12px;border-left:4px solid #d1d5db;background:#f9fafb;white-space:pre-wrap;font-size:15px;line-height:1.5;">${escaparHtml(
        n.nov_texto,
      )}</div>
    </body>
    </html>
  `;
  return { html, texto };
}
