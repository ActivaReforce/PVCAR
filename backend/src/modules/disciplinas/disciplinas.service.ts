import type { PoolClient } from 'pg';
import { alcanceDe, alcanzaColegio, alcanzaDisciplina, type Alcance } from '../../lib/alcance.js';
import { auditar } from '../../lib/auditoria.js';
import { ESTADO } from '../../lib/constants.js';
import { armarPagina, type Pagina } from '../../lib/paginacion.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as repo from './disciplinas.repository.js';
import type {
  ActualizarDisciplinaInput,
  CrearDisciplinasInput,
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

/** Nombre legible para mensajes y auditoria: "Karate — Quitumbe, lunes 15:00". */
function nombreDe(d: repo.DisciplinaListada): string {
  const hora = d.colacthor_hora_inicio?.slice(0, 5) ?? '';
  return `${d.act_nombre} — ${d.col_nombre}, ${d.dia_nombre.toLowerCase()} ${hora}`.trim();
}

/**
 * Alta por lote: un colegio, una actividad, varias franjas.
 *
 * Todo en una transaccion: o entran las cuatro franjas o no entra ninguna. El
 * formulario viejo las insertaba una a una y si la tercera fallaba dejaba dos
 * creadas sin decir cuales.
 */
export async function crear(
  actor: AuthUser,
  input: CrearDisciplinasInput,
): Promise<repo.DisciplinaListada[]> {
  const alcance = await alcanceDe(actor.usuario);
  exigirColegioEnAlcance(alcance, input.col_id);

  const ids = await enTransaccion(async (client) => {
    if (!(await repo.existeColegio(client, input.col_id))) {
      throw new ApiError(400, 'El colegio no existe');
    }
    if (!(await repo.existeActividad(client, input.act_id))) {
      throw new ApiError(400, 'La actividad no existe');
    }

    const creados: number[] = [];
    for (const franja of input.horarios) {
      await exigirHorarioLibre(client, {
        colId: input.col_id,
        actId: input.act_id,
        diaId: franja.dia_id,
        horaInicio: franja.colacthor_hora_inicio,
        horaFin: franja.colacthor_hora_fin,
        excluyendo: null,
      });

      creados.push(
        await repo.insertarDisciplina(client, {
          colId: input.col_id,
          actId: input.act_id,
          diaId: franja.dia_id,
          horaInicio: franja.colacthor_hora_inicio,
          horaFin: franja.colacthor_hora_fin,
        }),
      );
    }

    await auditar(
      {
        actor,
        accion: 'crear',
        entidad: 'disciplina',
        entidadId: creados.join(','),
        detalle: { col_id: input.col_id, act_id: input.act_id, creadas: creados.length },
      },
      client,
    );

    return creados;
  });

  const disciplinas = await Promise.all(ids.map((id) => repo.obtenerDisciplina(id)));
  return disciplinas.filter((d): d is repo.DisciplinaListada => d !== null);
}

/**
 * Dos comprobaciones distintas, con dos mensajes distintos:
 *
 *  - **Duplicado exacto**: misma actividad, colegio, dia y hora de inicio. La
 *    base no lo impide y en el sistema viejo se podian crear copias que
 *    aparecian dos veces en el calendario y en todos los selectores.
 *  - **Solape**: la misma actividad en el mismo colegio y dia pisando horario.
 *    No es la misma fila, pero es el mismo grupo partido en dos, y las
 *    asistencias de esa tarde acabarian en una u otra al azar.
 */
async function exigirHorarioLibre(
  client: PoolClient,
  datos: {
    colId: number;
    actId: number;
    diaId: number;
    horaInicio: string;
    horaFin: string;
    excluyendo: number | null;
  },
): Promise<void> {
  if (await repo.existeIgual(client, datos, datos.excluyendo)) {
    throw new ApiError(409, 'Ya existe esa disciplina: mismo colegio, actividad, día y hora');
  }

  const solape = await repo.haySolape(client, datos, datos.excluyendo);
  if (solape) {
    throw new ApiError(
      409,
      `Se pisa con otra disciplina de la misma actividad ese día (${solape.inicio.slice(0, 5)}–${solape.fin.slice(0, 5)}). Ajusta el horario o edita la existente.`,
    );
  }
}

/**
 * Edicion.
 *
 * Cambiar el dia o la hora de una disciplina con asistencias ya registradas
 * reescribe la historia: las asistencias guardan la fecha, pero la sesion a la
 * que pertenecen pasa a ser otra. No se bloquea —a veces el horario cambia de
 * verdad— pero la respuesta lo dice para que la pantalla avise.
 */
export async function actualizar(
  actor: AuthUser,
  colacthorId: number,
  input: ActualizarDisciplinaInput,
): Promise<repo.DisciplinaListada> {
  const antes = await repo.obtenerDisciplina(colacthorId);
  if (!antes) throw new ApiError(404, 'Disciplina no encontrada');

  await exigirAlcance(actor, antes);

  const colId = input.col_id ?? antes.col_id;
  if (input.col_id && input.col_id !== antes.col_id) {
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

    const horaInicio = input.colacthor_hora_inicio ?? antes.colacthor_hora_inicio ?? '00:00';
    const horaFin = input.colacthor_hora_fin ?? antes.colacthor_hora_fin ?? '00:00';
    if (horaFin <= horaInicio) {
      throw new ApiError(400, 'La hora de fin tiene que ser posterior a la de inicio');
    }

    await exigirHorarioLibre(client, {
      colId,
      actId: input.act_id ?? antes.act_id,
      diaId: input.dia_id ?? antes.dia_id,
      horaInicio,
      horaFin,
      excluyendo: colacthorId,
    });

    await repo.actualizarDisciplina(client, colacthorId, {
      colId: input.col_id,
      actId: input.act_id,
      diaId: input.dia_id,
      horaInicio: input.colacthor_hora_inicio,
      horaFin: input.colacthor_hora_fin,
    });

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
    await exigirHorarioLibre(client, {
      colId: antes.col_id,
      actId: antes.act_id,
      diaId: antes.dia_id,
      horaInicio: antes.colacthor_hora_inicio ?? '00:00',
      horaFin: antes.colacthor_hora_fin ?? '00:00',
      excluyendo: colacthorId,
    });
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
  // grande. Pedir "Karate — Quitumbe, lunes 15:00" seria pedir un dictado.
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
