import type { PoolClient } from 'pg';
import { alcanceDe, alcanzaColegio, type Alcance } from '../../lib/alcance.js';
import { auditar } from '../../lib/auditoria.js';
import { ESTADO, ROL } from '../../lib/constants.js';
import { armarPagina, type Pagina } from '../../lib/paginacion.js';
import { firmarFoto, firmarFotos } from '../../lib/storage.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as repo from './entrenadores.repository.js';
import type { AsignarInput, ListarEntrenadoresQuery } from './entrenadores.schemas.js';

/**
 * Entrenadores: quien imparte cada disciplina y quien lo respalda.
 *
 * Este modulo no crea personas — un entrenador es un usuario con el rol 3 y su
 * ficha nace en Usuarios — sino que decide asignaciones. Y las asignaciones
 * son lo que puebla el alcance de los roles 3, 6 y 7: tocar aqui cambia lo que
 * esas personas ven en todo el sistema.
 *
 * Regla que gobierna el modulo: **las asignaciones son historia, no estado**.
 * Quitar una disciplina no borra la fila, le pone fecha de fin. Las
 * asistencias de meses pasados se leen contra esas fechas.
 */

export type EntrenadorConFoto = repo.EntrenadorListado & { usu_foto_url: string | null };

async function conFotos(items: repo.EntrenadorListado[]): Promise<EntrenadorConFoto[]> {
  const firmadas = await firmarFotos(items.map((e) => e.usu_foto));
  return items.map((e) => ({
    ...e,
    usu_foto_url: e.usu_foto ? (firmadas.get(e.usu_foto) ?? e.usu_foto) : null,
  }));
}

export interface ListaEntrenadores extends Pagina<EntrenadorConFoto> {
  conteos: repo.ConteosEntrenadores;
}

export async function listar(
  actor: AuthUser,
  query: ListarEntrenadoresQuery,
): Promise<ListaEntrenadores> {
  const alcance = await alcanceDe(actor.usuario);

  const [pagina, conteos] = await Promise.all([
    repo.listarEntrenadores(query, alcance),
    repo.contarEntrenadores(query, alcance),
  ]);

  return {
    ...armarPagina(await conFotos(pagina.items), pagina.total, {
      page: query.page,
      limit: query.limit,
    }),
    conteos,
  };
}

export interface FichaEntrenador {
  entrenador: EntrenadorConFoto;
  asignaciones: repo.AsignacionListada[];
  auxiliares: repo.AuxiliarListado[];
}

export async function ficha(
  actor: AuthUser,
  entId: number,
  historial: boolean,
): Promise<FichaEntrenador> {
  const entrenador = await repo.obtenerEntrenador(entId);
  if (!entrenador) throw new ApiError(404, 'Entrenador no encontrado');

  await exigirAlcance(actor, entrenador);

  const [asignaciones, auxiliares] = await Promise.all([
    repo.listarAsignaciones(entId, historial),
    repo.listarAuxiliares(entId, historial),
  ]);

  return {
    entrenador: { ...entrenador, usu_foto_url: await firmarFoto(entrenador.usu_foto) },
    asignaciones,
    auxiliares,
  };
}

/**
 * Un entrenador entra en el alcance de alguien si da clase en uno de sus
 * colegios. El propio entrenador se ve siempre a si mismo: si no, un
 * entrenador no podria abrir su propia ficha.
 */
async function exigirAlcance(actor: AuthUser, entrenador: repo.EntrenadorListado): Promise<void> {
  if (entrenador.ent_id === actor.usuario.usu_id) return;

  const alcance = await alcanceDe(actor.usuario);
  if (alcance.global) return;

  const suyo = entrenador.colegios.some((c) => alcanzaColegio(alcance, c.col_id));
  if (!suyo) {
    throw new ApiError(403, 'Ese entrenador esta fuera de tu alcance');
  }
}

export async function disponibles(
  actor: AuthUser,
  entId: number,
  colegios: number[] | null,
): Promise<repo.DisciplinaDisponible[]> {
  const entrenador = await repo.obtenerEntrenador(entId);
  if (!entrenador) throw new ApiError(404, 'Entrenador no encontrado');
  await exigirAlcance(actor, entrenador);

  const alcance = await alcanceDe(actor.usuario);
  return repo.listarDisponibles(entId, alcance, colegios);
}

/**
 * Asignar una disciplina.
 *
 * Cinco comprobaciones, todas en el servidor:
 *   1. el entrenador existe, tiene el rol 3 y su ficha esta activa;
 *   2. la disciplina existe, esta activa y cae dentro del alcance;
 *   3. no la tiene ya asignada (409);
 *   4. si la tiene otro entrenador, se rechaza diciendo quien — salvo que
 *      llegue `reemplazar`, y entonces se cierra la del otro y se abre la
 *      nueva en la misma transaccion;
 *   5. la fecha de inicio no puede ser futura.
 *
 * El sistema viejo no hacia ninguna: insertaba y ya.
 */
export async function asignar(
  actor: AuthUser,
  entId: number,
  input: AsignarInput,
): Promise<repo.AsignacionListada[]> {
  const entrenador = await repo.obtenerEntrenador(entId);
  if (!entrenador) throw new ApiError(404, 'Entrenador no encontrado');
  await exigirAlcance(actor, entrenador);

  if (!entrenador.tiene_rol) {
    throw new ApiError(
      409,
      'Esa persona ya no tiene el rol de Entrenador. Devuelveselo desde Usuarios antes de asignarle disciplinas.',
    );
  }
  if (entrenador.est_id !== ESTADO.ACTIVO || entrenador.usuario_est_id !== ESTADO.ACTIVO) {
    throw new ApiError(409, 'El entrenador esta dado de baja: reactivalo antes de asignarle nada');
  }
  if (input.desde && input.desde > new Date().toISOString().slice(0, 10)) {
    throw new ApiError(400, 'La fecha de inicio no puede ser futura');
  }

  const alcance = await alcanceDe(actor.usuario);

  await enTransaccion(async (client) => {
    const disciplina = await repo.disciplinaActiva(client, input.colacthor_id);
    if (!disciplina) throw new ApiError(400, 'La disciplina no existe');
    if (disciplina.est_id !== ESTADO.ACTIVO) {
      throw new ApiError(409, 'La disciplina esta dada de baja: reactivala antes de asignarla');
    }
    if (!alcanzaColegio(alcance, disciplina.col_id)) {
      throw new ApiError(403, 'Esa disciplina esta fuera de tu alcance');
    }

    if (await repo.tieneAsignacionActiva(client, entId, input.colacthor_id)) {
      throw new ApiError(409, 'Ese entrenador ya tiene esa disciplina asignada');
    }

    const ocupada = await repo.entrenadorActivoDe(client, input.colacthor_id);
    if (ocupada && !input.reemplazar) {
      throw new ApiError(
        409,
        `Esa disciplina ya la da ${ocupada.usu_nombre}. Vuelve a intentarlo marcando "reemplazar" si quieres cambiarlo.`,
      );
    }
    if (ocupada && input.reemplazar) {
      await repo.cerrarAsignacion(client, ocupada.entasig_id);
    }

    const entasigId = await repo.abrirAsignacion(
      client,
      entId,
      input.colacthor_id,
      input.desde ?? null,
    );

    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'entrenador_asignacion',
        entidadId: entasigId,
        detalle: {
          ent_id: entId,
          colacthor_id: input.colacthor_id,
          reemplazo_a: ocupada?.ent_id ?? null,
        },
      },
      client,
    );
  });

  return repo.listarAsignaciones(entId, false);
}

/** Cerrar una asignacion: fecha de fin, no DELETE. */
export async function cerrar(
  actor: AuthUser,
  entId: number,
  entasigId: number,
): Promise<repo.AsignacionListada[]> {
  const entrenador = await repo.obtenerEntrenador(entId);
  if (!entrenador) throw new ApiError(404, 'Entrenador no encontrado');
  await exigirAlcance(actor, entrenador);

  const alcance = await alcanceDe(actor.usuario);

  await enTransaccion(async (client) => {
    const asignacion = await repo.obtenerAsignacion(client, entasigId);
    if (!asignacion) throw new ApiError(404, 'Esa asignacion no existe');
    if (asignacion.ent_id !== entId) {
      throw new ApiError(400, 'Esa asignacion no es de este entrenador');
    }
    if (!alcanzaColegio(alcance, asignacion.col_id)) {
      throw new ApiError(403, 'Esa disciplina esta fuera de tu alcance');
    }

    const cerrada = await repo.cerrarAsignacion(client, entasigId);
    if (!cerrada) throw new ApiError(409, 'Esa asignacion ya estaba cerrada');

    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'entrenador_asignacion',
        entidadId: entasigId,
        detalle: { ent_id: entId, colacthor_id: asignacion.colacthor_id, cerrada: true },
      },
      client,
    );
  });

  return repo.listarAsignaciones(entId, false);
}

// ---------------------------------------------------------------------------
// Auxiliares

export async function candidatosAAuxiliar(): Promise<
  Array<{ usu_id: number; usu_nombre: string; usu_correo: string; rol_id: number }>
> {
  return repo.listarCandidatosAAuxiliar();
}

/**
 * Atar un auxiliar (rol 6 Asistente o 7 Respaldo) a un entrenador titular.
 *
 * El auxiliar no tiene alcance propio: hereda el del titular. Por eso esto es
 * una decision de permisos disfrazada de dato, y por eso se valida:
 *   - el titular tiene rol 3 y ficha activa;
 *   - el auxiliar esta activo y tiene rol 6 o 7;
 *   - no respalda ya a otro (uno cada vez: si no, heredaria dos alcances y
 *     nadie sabria de quien es asistente);
 *   - nadie se respalda a si mismo.
 *
 * En los datos reales hay tres filas que no pasarian estas comprobaciones —dos
 * auxiliares sin el rol y dos con el usuario inactivo— creadas cuando no
 * existian. No se tocan, pero la ficha las marca en vez de disimularlas.
 */
export async function atarAuxiliar(
  actor: AuthUser,
  entId: number,
  usuId: number,
): Promise<repo.AuxiliarListado[]> {
  const entrenador = await repo.obtenerEntrenador(entId);
  if (!entrenador) throw new ApiError(404, 'Entrenador no encontrado');
  await exigirAlcance(actor, entrenador);

  if (!entrenador.tiene_rol || entrenador.est_id !== ESTADO.ACTIVO) {
    throw new ApiError(409, 'El titular tiene que ser un entrenador activo con el rol de Entrenador');
  }
  if (usuId === entId) {
    throw new ApiError(400, 'Nadie puede ser su propio auxiliar');
  }

  await enTransaccion(async (client) => {
    const rolId = await repo.rolAuxiliarDe(client, usuId);
    if (rolId === null) {
      throw new ApiError(
        400,
        'Ese usuario no tiene el rol de Asistente ni el de Respaldo Entrenador. Dáselo primero desde Usuarios.',
      );
    }

    const yaAtado = await repo.auxiliarDe(client, usuId);
    if (yaAtado) {
      throw new ApiError(
        409,
        yaAtado.ent_id === entId
          ? 'Ese auxiliar ya está atado a este entrenador'
          : `Ese auxiliar ya respalda a ${yaAtado.usu_nombre}. Suéltalo primero.`,
      );
    }

    const entauxId = await repo.atarAuxiliar(client, entId, usuId, rolId);
    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'entrenador_auxiliar',
        entidadId: entauxId,
        detalle: { ent_id: entId, usu_id: usuId, rol_id: rolId },
      },
      client,
    );
  });

  return repo.listarAuxiliares(entId, false);
}

export async function soltarAuxiliar(
  actor: AuthUser,
  entId: number,
  entauxId: number,
): Promise<repo.AuxiliarListado[]> {
  const entrenador = await repo.obtenerEntrenador(entId);
  if (!entrenador) throw new ApiError(404, 'Entrenador no encontrado');
  await exigirAlcance(actor, entrenador);

  await enTransaccion(async (client: PoolClient) => {
    const auxiliar = await repo.obtenerAuxiliar(client, entauxId);
    if (!auxiliar) throw new ApiError(404, 'Ese auxiliar no existe');
    if (auxiliar.ent_id !== entId) {
      throw new ApiError(400, 'Ese auxiliar no es de este entrenador');
    }

    const soltado = await repo.soltarAuxiliar(client, entauxId);
    if (!soltado) throw new ApiError(409, 'Ese auxiliar ya estaba suelto');

    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'entrenador_auxiliar',
        entidadId: entauxId,
        detalle: { ent_id: entId, usu_id: auxiliar.usu_id, soltado: true },
      },
      client,
    );
  });

  return repo.listarAuxiliares(entId, false);
}

export { ROL };
