import type { PoolClient } from 'pg';
import { alcanceDe, alcanzaColegio, alcanzaDisciplina, type Alcance } from '../../lib/alcance.js';
import { auditar } from '../../lib/auditoria.js';
import { afectadosPorCruce } from '../../lib/horarios.js';
import { ESTADO } from '../../lib/constants.js';
import { armarPagina, type Pagina } from '../../lib/paginacion.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as repo from './disciplinas.repository.js';
import type {
  ActualizarDisciplinaInput,
  CrearDisciplinaInput,
  ListarDisciplinasQuery,
} from './disciplinas.schemas.js';

/**
 * Disciplinas — el eje del modelo.
 *
 * De `colegio_actividad_horario` cuelgan inscripciones, asignaciones de
 * entrenador, evaluaciones y asistencias, las cuatro sin cascada. Eso decide
 * casi todo lo de aqui: una disciplina que se ha usado alguna vez no se borra,
 * se da de baja.
 */

export interface ListaDisciplinas extends Pagina<repo.DisciplinaListada> {
  conteos: repo.ConteosDisciplinas;
}

export async function listar(
  actor: AuthUser,
  query: ListarDisciplinasQuery,
): Promise<ListaDisciplinas> {
  const alcance = await alcanceDe(actor.usuario);

  const [pagina, conteos] = await Promise.all([
    repo.listarDisciplinas(query, alcance),
    repo.contarDisciplinas(query, alcance),
  ]);

  return {
    ...armarPagina(pagina.items, pagina.total, { page: query.page, limit: query.limit }),
    conteos,
  };
}

export async function obtener(
  actor: AuthUser,
  colacthorId: number,
): Promise<repo.DisciplinaListada> {
  const disciplina = await repo.obtenerDisciplina(colacthorId);
  if (!disciplina) throw new ApiError(404, 'Disciplina no encontrada');
  await exigirAlcance(actor, disciplina);
  return disciplina;
}

/**
 * Una disciplina esta dentro del alcance si lo esta ella misma o su colegio.
 *
 * Las dos vias importan: el entrenador tiene alcance sobre disciplinas sueltas
 * (las que le asignaron) y el coordinador sobre colegios enteros — y una
 * disciplina recien creada en su colegio todavia no esta en ninguna lista de
 * `alcance.disciplinas`, porque nadie la imparte.
 */
async function exigirAlcance(actor: AuthUser, disciplina: repo.DisciplinaListada): Promise<void> {
  const alcance = await alcanceDe(actor.usuario);
  if (alcanzaDisciplina(alcance, disciplina.colacthor_id)) return;
  if (alcanzaColegio(alcance, disciplina.col_id)) return;
  throw new ApiError(403, 'Esa disciplina esta fuera de tu alcance');
}

function exigirColegioEnAlcance(alcance: Alcance, colId: number): void {
  if (!alcanzaColegio(alcance, colId)) {
    throw new ApiError(403, 'Ese colegio esta fuera de tu alcance');
  }
}

/** Nombre legible para mensajes y auditoria: "Karate — Quitumbe, Lun y Mié 15:00–16:00". */
function nombreDe(d: repo.DisciplinaListada): string {
  return `${d.act_nombre} — ${d.col_nombre}, ${d.horario_texto ?? 'sin horario'}`;
}

/**
 * Alta de una disciplina con sus dias. Todo en una transaccion.
 */
export async function crear(
  actor: AuthUser,
  input: CrearDisciplinaInput,
): Promise<repo.DisciplinaListada> {
  const alcance = await alcanceDe(actor.usuario);
  exigirColegioEnAlcance(alcance, input.col_id);

  const id = await enTransaccion(async (client) => {
    if (!(await repo.existeColegio(client, input.col_id))) {
      throw new ApiError(400, 'El colegio no existe');
    }
    if (!(await repo.existeActividad(client, input.act_id))) {
      throw new ApiError(400, 'La actividad no existe');
    }

    const nuevo = await repo.insertarDisciplina(client, {
      colId: input.col_id,
      actId: input.act_id,
    });
    await repo.reemplazarHorarios(client, nuevo, input.horarios);
    await exigirSinSolape(client, nuevo);

    await auditar(
      {
        actor,
        accion: 'crear',
        entidad: 'disciplina',
        entidadId: nuevo,
        detalle: { col_id: input.col_id, act_id: input.act_id, horarios: input.horarios },
      },
      client,
    );
    return nuevo;
  });

  return (await repo.obtenerDisciplina(id))!;
}

/**
 * La misma actividad en el mismo colegio no puede tener dos grupos que se
 * pisen ningun dia. Se comprueba con los horarios ya escritos en la
 * transaccion: si falla, el rollback los deshace.
 */
async function exigirSinSolape(client: PoolClient, colacthorId: number): Promise<void> {
  const solape = await repo.haySolape(client, colacthorId);
  if (solape) {
    throw new ApiError(
      409,
      `Se pisa con otro grupo de la misma actividad en este colegio el ${solape.dia_nombre.toLowerCase()} (${solape.inicio}–${solape.fin}). Ajusta el horario o edita el existente.`,
    );
  }
}

/**
 * Nadie inscrito ni asignado puede quedar con dos disciplinas a la vez por
 * culpa del cambio de horario. Se dice a quien afecta, con nombres.
 */
async function exigirSinCrucesDeGente(client: PoolClient, colacthorId: number): Promise<void> {
  const { alumnos, entrenadores } = await afectadosPorCruce(client, colacthorId);
  if (alumnos.length === 0 && entrenadores.length === 0) return;
  const partes: string[] = [];
  if (alumnos.length > 0) partes.push(`alumnos: ${alumnos.join(', ')}`);
  if (entrenadores.length > 0) partes.push(`entrenadores: ${entrenadores.join(', ')}`);
  throw new ApiError(
    409,
    `Con ese horario se cruzaría con otra disciplina de ${partes.join('; ')}. Cambia el horario o mueve primero a esas personas.`,
    { alumnos, entrenadores },
  );
}

/**
 * Edicion.
 *
 * Los horarios se pueden cambiar aunque la disciplina tenga historia (a veces
 * el horario cambia de verdad): las asistencias guardan su fecha. Lo que no se
 * deja es que el cambio cruce a un alumno o a un entrenador con su otra
 * disciplina.
 */
export async function actualizar(
  actor: AuthUser,
  colacthorId: number,
  input: ActualizarDisciplinaInput,
): Promise<repo.DisciplinaListada> {
  const antes = await repo.obtenerDisciplina(colacthorId);
  if (!antes) throw new ApiError(404, 'Disciplina no encontrada');

  await exigirAlcance(actor, antes);

  const cambiaColegio = input.col_id !== undefined && input.col_id !== antes.col_id;
  const cambiaActividad = input.act_id !== undefined && input.act_id !== antes.act_id;

  /*
   * El colegio y la actividad son la identidad de la disciplina. Si ya tiene
   * historia —alumnos inscritos alguna vez, entrenadores, evaluaciones o
   * asistencias— cambiarlos la reescribe entera: las asistencias de Fútbol en
   * Quitumbe pasarían a ser de Ajedrez, o de otro colegio con alumnos que no
   * son suyos. Los horarios sí se pueden mover; para lo otro se crea una
   * disciplina nueva y se da de baja esta.
   */
  if (cambiaColegio || cambiaActividad) {
    const historia = await repo.calcularImpacto(colacthorId);
    if (!historia.puedeEliminar) {
      throw new ApiError(
        409,
        `Esta disciplina ya tiene historia: no se le puede cambiar ${
          cambiaColegio ? 'el colegio' : 'la actividad'
        }. Crea una disciplina nueva y da de baja esta.`,
        historia.bloqueos,
      );
    }
  }

  if (cambiaColegio && input.col_id) {
    const alcance = await alcanceDe(actor.usuario);
    exigirColegioEnAlcance(alcance, input.col_id);
  }

  await enTransaccion(async (client) => {
    if (input.col_id && !(await repo.existeColegio(client, input.col_id))) {
      throw new ApiError(400, 'El colegio no existe');
    }
    if (input.act_id && !(await repo.existeActividad(client, input.act_id))) {
      throw new ApiError(400, 'La actividad no existe');
    }

    await repo.actualizarDisciplina(client, colacthorId, {
      colId: input.col_id,
      actId: input.act_id,
    });
    if (input.horarios) {
      await repo.reemplazarHorarios(client, colacthorId, input.horarios);
      await exigirSinCrucesDeGente(client, colacthorId);
    }
    if (antes.est_id === ESTADO.ACTIVO) await exigirSinSolape(client, colacthorId);

    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'disciplina',
        entidadId: colacthorId,
        detalle: { campos: Object.keys(input), antes: nombreDe(antes) },
      },
      client,
    );
  });

  return (await repo.obtenerDisciplina(colacthorId))!;
}

/** Lo que va a arrastrar la baja. La pantalla lo ensena antes de confirmar. */
export async function previoBaja(
  actor: AuthUser,
  colacthorId: number,
): Promise<{ inscripciones: number; asignaciones: number }> {
  const disciplina = await repo.obtenerDisciplina(colacthorId);
  if (!disciplina) throw new ApiError(404, 'Disciplina no encontrada');
  await exigirAlcance(actor, disciplina);
  return repo.contarDependenciasActivas(colacthorId);
}

/**
 * Baja logica: la operacion de todos los dias.
 *
 * Una disciplina que deja de impartirse no se puede borrar —las cuatro tablas
 * que cuelgan de ella no tienen cascada— asi que el sistema viejo se quedaba
 * sin salida: o la dejabas ahi para siempre o te comia un error de clave
 * foranea. La columna `est_id` existia desde el principio y nadie la usaba: en
 * los datos reales las 94 disciplinas estan activas.
 *
 * Dar de baja cierra ademas las inscripciones y las asignaciones abiertas. Si
 * no, el alumno seguiria inscrito en algo que ya no existe y el entrenador la
 * seguiria viendo en su alcance.
 */
export async function darDeBaja(
  actor: AuthUser,
  colacthorId: number,
): Promise<repo.DisciplinaListada> {
  const antes = await repo.obtenerDisciplina(colacthorId);
  if (!antes) throw new ApiError(404, 'Disciplina no encontrada');
  await exigirAlcance(actor, antes);

  if (antes.est_id === ESTADO.INACTIVO) {
    throw new ApiError(409, 'La disciplina ya estaba dada de baja');
  }

  await enTransaccion(async (client) => {
    await repo.cambiarEstado(client, colacthorId, ESTADO.INACTIVO);
    const cerradas = await repo.cerrarDependenciasActivas(client, colacthorId);
    await auditar(
      {
        actor,
        accion: 'baja',
        entidad: 'disciplina',
        entidadId: colacthorId,
        detalle: { disciplina: nombreDe(antes), ...cerradas },
      },
      client,
    );
  });

  return (await repo.obtenerDisciplina(colacthorId))!;
}

/**
 * Reactivar devuelve la disciplina al calendario, pero **no** reabre las
 * inscripciones ni las asignaciones que la baja cerro: quien vuelva a
 * inscribirse se inscribe de nuevo, y el entrenador se asigna desde su modulo.
 * Es la misma regla que en Usuarios, y por el mismo motivo: reabrir a ciegas
 * resucita vinculos que a lo mejor ya no corresponden.
 */
export async function reactivar(
  actor: AuthUser,
  colacthorId: number,
): Promise<repo.DisciplinaListada> {
  const antes = await repo.obtenerDisciplina(colacthorId);
  if (!antes) throw new ApiError(404, 'Disciplina no encontrada');
  await exigirAlcance(actor, antes);

  if (antes.est_id === ESTADO.ACTIVO) {
    throw new ApiError(409, 'La disciplina ya estaba activa');
  }

  await enTransaccion(async (client) => {
    await exigirSinSolape(client, colacthorId);
    await repo.cambiarEstado(client, colacthorId, ESTADO.ACTIVO);
    await auditar(
      {
        actor,
        accion: 'reactivar',
        entidad: 'disciplina',
        entidadId: colacthorId,
        detalle: { disciplina: nombreDe(antes) },
      },
      client,
    );
  });

  return (await repo.obtenerDisciplina(colacthorId))!;
}

export async function impacto(
  actor: AuthUser,
  colacthorId: number,
): Promise<repo.ImpactoDisciplina> {
  const disciplina = await repo.obtenerDisciplina(colacthorId);
  if (!disciplina) throw new ApiError(404, 'Disciplina no encontrada');
  await exigirAlcance(actor, disciplina);
  return repo.calcularImpacto(colacthorId);
}

/**
 * Borrado permanente. Solo para disciplinas que nunca se usaron: las creadas
 * por error. Para el resto esta la baja, y el mensaje lo dice.
 */
export async function eliminar(
  actor: AuthUser,
  colacthorId: number,
  confirmacion: string,
): Promise<repo.ImpactoDisciplina> {
  const disciplina = await repo.obtenerDisciplina(colacthorId);
  if (!disciplina) throw new ApiError(404, 'Disciplina no encontrada');
  await exigirAlcance(actor, disciplina);

  // Se confirma escribiendo la actividad, que es lo que la pantalla ensena
  // grande. Pedir "Karate — Quitumbe, Lun y Mié 15:00–16:00" seria pedir un dictado.
  if (confirmacion.trim().toLowerCase() !== disciplina.act_nombre.trim().toLowerCase()) {
    throw new ApiError(400, 'El nombre escrito no coincide con el de la actividad');
  }

  const impactoPrevio = await repo.calcularImpacto(colacthorId);
  if (!impactoPrevio.puedeEliminar) {
    throw new ApiError(
      409,
      'No se puede eliminar: la disciplina tiene historial. Dala de baja para que deje de impartirse.',
      impactoPrevio.bloqueos,
    );
  }

  await enTransaccion(async (client) => {
    await auditar(
      {
        actor,
        accion: 'eliminar',
        entidad: 'disciplina',
        entidadId: colacthorId,
        detalle: { disciplina: nombreDe(disciplina) },
      },
      client,
    );
    await repo.eliminarDisciplina(client, colacthorId);
  });

  return impactoPrevio;
}

export async function dias(): Promise<repo.Dia[]> {
  return repo.listarDias();
}
