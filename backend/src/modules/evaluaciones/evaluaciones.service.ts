import type { PoolClient } from 'pg';
import { alcanceDe, alcanzaDisciplina, type Alcance } from '../../lib/alcance.js';
import { auditar } from '../../lib/auditoria.js';
import { ESTADO } from '../../lib/constants.js';
import type { Pagina } from '../../lib/paginacion.js';
import { firmarFoto, firmarFotos } from '../../lib/storage.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as repo from './evaluaciones.repository.js';
import {
  columnasDelIntento,
  puntuarIntento,
  sumarPuntajes,
  type ParametroPuntuable,
} from './evaluaciones.scoring.js';
import type {
  ActualizarEvaluacionInput,
  CrearEvaluacionInput,
  IntentosInput,
  ListarEvaluacionesQuery,
  ListarPendientesQuery,
  ParametroInput,
} from './evaluaciones.schemas.js';

/**
 * Evaluaciones.
 *
 * El modulo con mas reglas de negocio del sistema, y el que menos se ha usado:
 * en produccion hay 5 evaluaciones, 72 vinculos, 1 261 pendientes y **un solo
 * intento registrado**. Eso significa que sus huecos no han hecho dano todavia,
 * no que no esten.
 *
 * Lo que cambia respecto al sistema viejo:
 *
 * 1. **La nota la calcula el servidor** (ver evaluaciones.scoring.ts). Antes la
 *    calculaba el navegador y la mandaba ya hecha.
 * 2. **Vincular una disciplina crea las pendientes en una transaccion**, con un
 *    solo INSERT ... SELECT. Antes eran dos peticiones por alumno desde el
 *    navegador, en un bucle, y los fallos se tragaban con un console.error.
 * 3. **Desvincular ya no borra las notas.** Antes hacia un DELETE de todas las
 *    pendientes de esa disciplina, evaluadas incluidas, sin avisar.
 * 4. **El borrado va por endpoint con permisos**, no por la RPC
 *    `delete_student_evaluation`, que estuvo abierta a la anon key hasta
 *    `0005_grants.sql`.
 */

function vacioANulo(v: string | undefined | null): string | null {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
}

// ---------------------------------------------------------------------------
// Catalogos

export async function metodos() {
  return repo.listarMetodos();
}

export async function categorias() {
  return repo.listarCategorias();
}

// ---------------------------------------------------------------------------
// Puertas

/**
 * Una evaluacion esta dentro del alcance si la creo el actor o si esta
 * vinculada a alguna disciplina suya. Los globales lo ven todo.
 *
 * El primer camino no es un capricho: sin el, un coordinador que crea una
 * evaluacion la pierde de vista en cuanto cierra el modal, antes de poder
 * vincularla a nada.
 */
async function exigirVisible(
  actor: AuthUser,
  evaId: number,
): Promise<{ evaluacion: repo.EvaluacionListada; alcance: Alcance }> {
  const evaluacion = await repo.obtenerEvaluacion(evaId);
  if (!evaluacion) throw new ApiError(404, 'Esa evaluacion no existe');

  const alcance = await alcanceDe(actor.usuario);
  if (alcance.global || evaluacion.eva_creador === actor.usuario.usu_id) {
    return { evaluacion, alcance };
  }

  const vinculadas = await repo.listarVinculadas(evaId);
  const suya = vinculadas.some(
    (v) => v.est_id === ESTADO.ACTIVO && alcanzaDisciplina(alcance, v.colacthor_id),
  );
  if (suya) return { evaluacion, alcance };

  throw new ApiError(403, 'Esa evaluacion esta fuera de tu alcance');
}

// ---------------------------------------------------------------------------
// Lista y ficha

export interface ListaEvaluaciones extends Pagina<repo.EvaluacionListada> {
  conteos: repo.ConteosEvaluaciones;
}

export async function listar(
  actor: AuthUser,
  query: ListarEvaluacionesQuery,
): Promise<ListaEvaluaciones> {
  const alcance = await alcanceDe(actor.usuario);

  const [pagina, conteos] = await Promise.all([
    repo.listarEvaluaciones(query, alcance, actor.usuario.usu_id),
    repo.contarEvaluaciones(alcance, actor.usuario.usu_id),
  ]);

  return { ...pagina, conteos };
}

export interface FichaEvaluacion {
  evaluacion: repo.EvaluacionListada;
  parametros: repo.ParametroDetalle[];
}

export async function ficha(actor: AuthUser, evaId: number): Promise<FichaEvaluacion> {
  const { evaluacion } = await exigirVisible(actor, evaId);
  return { evaluacion, parametros: await repo.listarParametros(evaId) };
}

// ---------------------------------------------------------------------------
// Plantilla

export async function crear(
  actor: AuthUser,
  input: CrearEvaluacionInput,
): Promise<FichaEvaluacion> {
  const evaId = await enTransaccion(async (client) => {
    const nuevoId = await repo.insertarEvaluacion(client, {
      titulo: input.eva_titulo,
      descripcion: vacioANulo(input.eva_descripcion),
      categoria: vacioANulo(input.eva_categoria),
      creador: actor.usuario.usu_id,
    });

    for (const parametro of input.parametros ?? []) {
      const evaparamId = await repo.insertarParametro(client, nuevoId, parametro);
      await repo.guardarRango(client, evaparamId, parametro.rango ?? null);
    }

    await auditar(
      {
        actor,
        accion: 'crear',
        entidad: 'evaluacion',
        entidadId: nuevoId,
        detalle: { titulo: input.eva_titulo, parametros: input.parametros?.length ?? 0 },
      },
      client,
    );

    return nuevoId;
  });

  return ficha(actor, evaId);
}

export async function actualizar(
  actor: AuthUser,
  evaId: number,
  input: ActualizarEvaluacionInput,
): Promise<FichaEvaluacion> {
  await exigirVisible(actor, evaId);

  await enTransaccion(async (client) => {
    await repo.actualizarEvaluacion(client, evaId, {
      titulo: input.eva_titulo,
      descripcion: vacioANulo(input.eva_descripcion),
      tocarDescripcion: input.eva_descripcion !== undefined,
      categoria: vacioANulo(input.eva_categoria),
      tocarCategoria: input.eva_categoria !== undefined,
    });

    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'evaluacion',
        entidadId: evaId,
        detalle: { campos: Object.keys(input) },
      },
      client,
    );
  });

  return ficha(actor, evaId);
}

/**
 * Sincroniza los parametros: llega la lista completa que debe tener.
 *
 * Los dos casos delicados, y los dos son datos que ya no se pueden recuperar:
 *
 * - **Borrar un parametro con intentos registrados.** La clave foranea de
 *   `evaluacion_intento` no tiene cascada, asi que la base lo rechazaria con un
 *   error de restriccion ilegible. Aqui sale un 409 que dice cuantas notas hay
 *   detras.
 * - **Cambiarle el metodo a un parametro con intentos.** La base lo permitiria
 *   y los intentos viejos se quedarian con el valor en la columna equivocada:
 *   un "logro: true" bajo un metodo por tiempo no significa nada, pero suma 0 y
 *   parece una nota legitima.
 *
 * El puntaje total no se toca: lo recalcula `trigger_update_evaluacion_puntaje_total`.
 */
export async function guardarParametros(
  actor: AuthUser,
  evaId: number,
  parametros: ParametroInput[],
): Promise<FichaEvaluacion> {
  await exigirVisible(actor, evaId);

  const actuales = await repo.listarParametros(evaId);
  const porId = new Map(actuales.map((p) => [p.evaparam_id, p]));

  await enTransaccion(async (client) => {
    const idsExistentes = await repo.idsDeParametros(client, evaId);
    const idsPedidos = parametros
      .map((p) => p.evaparam_id)
      .filter((id): id is number => id !== undefined);

    for (const id of idsPedidos) {
      if (!idsExistentes.includes(id)) {
        throw new ApiError(400, `El parametro ${id} no es de esta evaluacion`);
      }
    }

    // Borrar lo que sobra, si no tiene notas detras.
    for (const id of idsExistentes.filter((id) => !idsPedidos.includes(id))) {
      const previo = porId.get(id);
      if (previo && previo.intentos_registrados > 0) {
        throw new ApiError(
          409,
          `No se puede borrar "${previo.evaparam_nombre}": tiene ${previo.intentos_registrados} intento(s) registrado(s). Borra primero las evaluaciones de esos alumnos.`,
        );
      }
      await repo.borrarParametro(client, id);
    }

    for (const parametro of parametros) {
      if (parametro.evaparam_id === undefined) {
        const nuevoId = await repo.insertarParametro(client, evaId, parametro);
        await repo.guardarRango(client, nuevoId, parametro.rango ?? null);
        continue;
      }

      const previo = porId.get(parametro.evaparam_id);
      if (
        previo &&
        previo.intentos_registrados > 0 &&
        previo.evatipometo_id !== parametro.evatipometo_id
      ) {
        throw new ApiError(
          409,
          `No se puede cambiar el metodo de "${previo.evaparam_nombre}": tiene ${previo.intentos_registrados} intento(s) registrado(s) con el metodo anterior.`,
        );
      }

      await repo.actualizarParametro(client, parametro.evaparam_id, parametro);
      await repo.guardarRango(client, parametro.evaparam_id, parametro.rango ?? null);
    }

    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'evaluacion',
        entidadId: evaId,
        detalle: { parametros: parametros.length },
      },
      client,
    );
  });

  return ficha(actor, evaId);
}

export async function darDeBaja(actor: AuthUser, evaId: number): Promise<FichaEvaluacion> {
  const { evaluacion } = await exigirVisible(actor, evaId);
  if (evaluacion.est_id === ESTADO.INACTIVO) {
    throw new ApiError(409, 'Esa evaluacion ya estaba dada de baja');
  }

  await enTransaccion(async (client) => {
    await repo.cambiarEstadoEvaluacion(client, evaId, ESTADO.INACTIVO);
    await auditar(
      {
        actor,
        accion: 'baja',
        entidad: 'evaluacion',
        entidadId: evaId,
        detalle: { titulo: evaluacion.eva_titulo },
      },
      client,
    );
  });

  return ficha(actor, evaId);
}

export async function reactivar(actor: AuthUser, evaId: number): Promise<FichaEvaluacion> {
  const { evaluacion } = await exigirVisible(actor, evaId);
  if (evaluacion.est_id === ESTADO.ACTIVO) {
    throw new ApiError(409, 'Esa evaluacion ya estaba activa');
  }

  await enTransaccion(async (client) => {
    await repo.cambiarEstadoEvaluacion(client, evaId, ESTADO.ACTIVO);
    await auditar(
      {
        actor,
        accion: 'reactivar',
        entidad: 'evaluacion',
        entidadId: evaId,
        detalle: { titulo: evaluacion.eva_titulo },
      },
      client,
    );
  });

  return ficha(actor, evaId);
}

export async function impacto(actor: AuthUser, evaId: number): Promise<repo.ImpactoEvaluacion> {
  await exigirVisible(actor, evaId);
  return repo.calcularImpacto(evaId);
}

/**
 * Borrado permanente.
 *
 * Las cuatro tablas cuelgan con ON DELETE CASCADE: se lleva parametros,
 * vinculos, pendientes e **intentos ya puntuados**. Por eso el recuento se
 * ensena antes y hay que escribir el titulo, igual que en Estudiantes.
 */
export async function eliminar(
  actor: AuthUser,
  evaId: number,
  confirmacion: string,
): Promise<repo.ImpactoEvaluacion> {
  const { evaluacion } = await exigirVisible(actor, evaId);

  if (confirmacion.trim().toLowerCase() !== evaluacion.eva_titulo.trim().toLowerCase()) {
    throw new ApiError(400, 'El titulo escrito no coincide con el de la evaluacion');
  }

  const impactoPrevio = await repo.calcularImpacto(evaId);

  await enTransaccion(async (client) => {
    await auditar(
      {
        actor,
        accion: 'eliminar',
        entidad: 'evaluacion',
        entidadId: evaId,
        detalle: { titulo: evaluacion.eva_titulo, destruido: impactoPrevio.eliminables },
      },
      client,
    );
    await repo.eliminarEvaluacion(client, evaId);
  });

  return impactoPrevio;
}

// ---------------------------------------------------------------------------
// Disciplinas vinculadas

export interface DisciplinasDeEvaluacion {
  vinculadas: repo.DisciplinaVinculada[];
  disponibles: repo.DisciplinaDisponible[];
}

export async function disciplinas(
  actor: AuthUser,
  evaId: number,
): Promise<DisciplinasDeEvaluacion> {
  const { alcance } = await exigirVisible(actor, evaId);

  const [vinculadas, disponibles] = await Promise.all([
    repo.listarVinculadas(evaId),
    repo.listarDisponibles(evaId, alcance),
  ]);

  return { vinculadas: vinculadas.filter((v) => v.est_id === ESTADO.ACTIVO), disponibles };
}

export interface ResultadoVinculo {
  vinculadas: number;
  desvinculadas: number;
  pendientesCreadas: number;
  pendientesDesactivadas: number;
  notasConservadas: number;
}

/**
 * Sincroniza las disciplinas vinculadas: llega la lista completa.
 *
 * Una evaluacion sin parametros no se puede vincular: crearia pendientes de
 * algo que no se puede puntuar, y esos alumnos apareceran en la lista de
 * "faltan por evaluar" para siempre.
 */
export async function sincronizarDisciplinas(
  actor: AuthUser,
  evaId: number,
  deseadas: number[],
): Promise<DisciplinasDeEvaluacion & { resultado: ResultadoVinculo }> {
  const { evaluacion, alcance } = await exigirVisible(actor, evaId);

  if (deseadas.length > 0 && evaluacion.parametros === 0) {
    throw new ApiError(
      409,
      'Esa evaluacion no tiene parametros todavia: configuralos antes de vincularla a una disciplina',
    );
  }

  for (const colacthorId of deseadas) {
    if (!alcanzaDisciplina(alcance, colacthorId)) {
      throw new ApiError(403, 'Alguna de esas disciplinas esta fuera de tu alcance');
    }
  }

  const resultado = await enTransaccion(async (client) => {
    const activos = await repo.vinculosActivos(client, evaId);
    const actuales = activos.map((v) => v.colacthor_id);

    const aVincular = deseadas.filter((id) => !actuales.includes(id));
    /**
     * Solo se desvincula lo que el actor **puede ver**. Un coordinador que
     * abre la pantalla ve sus disciplinas; si al guardar se tomara su lista
     * como la verdad completa, desvincularia en silencio las de los demas
     * colegios. Es el mismo fallo que el sistema viejo tenia al reves.
     */
    const aDesvincular = actuales.filter(
      (id) => !deseadas.includes(id) && alcanzaDisciplina(alcance, id),
    );

    let pendientesCreadas = 0;
    for (const colacthorId of aVincular) {
      await repo.vincular(client, evaId, colacthorId);
      pendientesCreadas += await repo.crearPendientesDe(client, evaId, colacthorId);
    }

    let pendientesDesactivadas = 0;
    let notasConservadas = 0;
    for (const colacthorId of aDesvincular) {
      const r = await repo.desvincular(client, evaId, colacthorId);
      pendientesDesactivadas += r.desactivadas;
      notasConservadas += r.conservadas;
    }

    if (aVincular.length > 0 || aDesvincular.length > 0) {
      await auditar(
        {
          actor,
          accion: 'editar',
          entidad: 'evaluacion',
          entidadId: evaId,
          detalle: {
            vinculadas: aVincular,
            desvinculadas: aDesvincular,
            pendientesCreadas,
            pendientesDesactivadas,
            notasConservadas,
          },
        },
        client,
      );
    }

    return {
      vinculadas: aVincular.length,
      desvinculadas: aDesvincular.length,
      pendientesCreadas,
      pendientesDesactivadas,
      notasConservadas,
    };
  });

  return { ...(await disciplinas(actor, evaId)), resultado };
}

// ---------------------------------------------------------------------------
// Evaluar alumnos

export type AlumnoConFoto = repo.AlumnoPendiente & { nino_foto_url: string | null };

export interface ListaPendientes {
  alumnos: AlumnoConFoto[];
  conteos: { total: number; pendientes: number; evaluados: number };
  eva_puntaje_total: number;
}

export async function pendientes(
  actor: AuthUser,
  query: ListarPendientesQuery,
): Promise<ListaPendientes> {
  const { evaluacion, alcance } = await exigirVisible(actor, query.evaluacion);

  if (!alcanzaDisciplina(alcance, query.disciplina)) {
    throw new ApiError(403, 'Esa disciplina esta fuera de tu alcance');
  }

  const alumnos = await repo.listarPendientes(query);
  const firmadas = await firmarFotos(alumnos.map((a) => a.nino_foto));

  /**
   * Los conteos salen de la consulta **sin el filtro de estado**: si se
   * contaran sobre la lista filtrada, elegir "Pendientes" pondria "evaluados:
   * 0". Es la leccion de la Fase 6, y aqui importa mas porque el contador de
   * cuantos faltan es justo lo que el modulo no tenia.
   */
  const todos =
    query.estado === undefined
      ? alumnos
      : await repo.listarPendientes({ ...query, estado: undefined });

  return {
    alumnos: alumnos.map((a) => ({
      ...a,
      nino_foto_url: a.nino_foto ? (firmadas.get(a.nino_foto) ?? a.nino_foto) : null,
    })),
    conteos: {
      total: todos.length,
      pendientes: todos.filter((a) => a.est_id === ESTADO.PENDIENTE).length,
      evaluados: todos.filter((a) => a.est_id === ESTADO.EVALUADO).length,
    },
    eva_puntaje_total: evaluacion.eva_puntaje_total,
  };
}

export interface FichaDeEvaluacion {
  pendiente: repo.FichaPendiente & { nino_foto_url: string | null };
  parametros: repo.ParametroDetalle[];
  intentos: repo.IntentoGuardado[];
  puntaje: number;
}

async function exigirPendienteVisible(
  actor: AuthUser,
  evaninopenId: number,
): Promise<repo.FichaPendiente> {
  const pendiente = await repo.obtenerPendiente(evaninopenId);
  if (!pendiente) throw new ApiError(404, 'Esa evaluacion de alumno no existe');

  const alcance = await alcanceDe(actor.usuario);
  if (!alcanzaDisciplina(alcance, pendiente.colacthor_id)) {
    throw new ApiError(403, 'Ese alumno esta fuera de tu alcance');
  }

  return pendiente;
}

export async function fichaDeAlumno(
  actor: AuthUser,
  evaninopenId: number,
): Promise<FichaDeEvaluacion> {
  const pendiente = await exigirPendienteVisible(actor, evaninopenId);

  const [parametros, intentos] = await Promise.all([
    repo.listarParametros(pendiente.eva_id),
    repo.listarIntentos(evaninopenId),
  ]);

  return {
    pendiente: { ...pendiente, nino_foto_url: await firmarFoto(pendiente.nino_foto) },
    parametros,
    intentos,
    puntaje: sumarPuntajes(intentos.map((i) => i.evaint_puntaje_obtenido)),
  };
}

/**
 * Guarda los intentos de un alumno y decide si queda evaluado.
 *
 * Llega la lista completa de lo registrado y **se reemplaza entera**: es lo
 * unico que evita quedarse con intentos huerfanos de una version anterior de la
 * evaluacion. Cada puntaje lo calcula el servidor; el cliente no lo manda.
 *
 * El alumno pasa a Evaluado cuando estan **todos** los intentos de **todos** los
 * parametros. Con uno menos sigue pendiente, y eso es lo correcto: una
 * evaluacion a medias no es una nota.
 */
export async function guardarIntentos(
  actor: AuthUser,
  evaninopenId: number,
  input: IntentosInput,
): Promise<FichaDeEvaluacion> {
  const pendiente = await exigirPendienteVisible(actor, evaninopenId);
  const parametros = await repo.listarParametros(pendiente.eva_id);

  if (parametros.length === 0) {
    throw new ApiError(409, 'Esa evaluacion no tiene parametros: no hay nada que puntuar');
  }

  const porParametro = new Map<number, ParametroPuntuable>(
    parametros.map((p) => [p.evaparam_id, p]),
  );

  // Primero se puntua todo; si algo falla, no se ha borrado nada todavia.
  const calculados = input.intentos.map((intento) => {
    const parametro = porParametro.get(intento.evaparam_id);
    if (!parametro) {
      throw new ApiError(400, `El parametro ${intento.evaparam_id} no es de esta evaluacion`);
    }
    if (intento.evaint_intento > parametro.evaparam_intentos) {
      throw new ApiError(
        400,
        `"${parametro.evaparam_nombre}" tiene ${parametro.evaparam_intentos} intento(s); llego el numero ${intento.evaint_intento}`,
      );
    }

    const valor = {
      tiempo: intento.tiempo,
      logro: intento.logro,
      escala: intento.escala,
      mobak: intento.mobak,
    };

    return {
      evaparam_id: intento.evaparam_id,
      evaint_intento: intento.evaint_intento,
      ...columnasDelIntento(parametro, valor),
      puntaje: puntuarIntento(parametro, valor),
    };
  });

  const esperados = parametros.reduce((total, p) => total + p.evaparam_intentos, 0);
  const completa = calculados.length >= esperados;

  await enTransaccion(async (client: PoolClient) => {
    await repo.borrarIntentosDe(client, evaninopenId);
    for (const intento of calculados) {
      await repo.insertarIntento(client, evaninopenId, intento);
    }
    await repo.marcarEstadoPendiente(client, evaninopenId, completa, actor.usuario.usu_id);

    /**
     * Se audita reevaluar, no evaluar por primera vez. Poner la nota es el
     * trabajo; **cambiar una nota ya puesta** es lo que hay que poder rastrear.
     */
    if (pendiente.est_id === ESTADO.EVALUADO) {
      await auditar(
        {
          actor,
          accion: 'editar',
          entidad: 'evaluacion_alumno',
          entidadId: evaninopenId,
          detalle: {
            alumno: pendiente.nino_nombre,
            evaluacion: pendiente.eva_titulo,
            puntaje: sumarPuntajes(calculados.map((c) => c.puntaje)),
          },
        },
        client,
      );
    }
  });

  return fichaDeAlumno(actor, evaninopenId);
}

/**
 * Borra la evaluacion de un alumno y lo devuelve a pendiente.
 *
 * Sustituye a la RPC `delete_student_evaluation`, que es `SECURITY DEFINER` y
 * estuvo ejecutable por la anon key hasta `0005_grants.sql`: con la clave del
 * bundle y un id cualquiera se podian borrar notas desde fuera de la
 * aplicacion. La RPC sigue existiendo en el esquema pero ya no es el camino.
 */
export async function borrarEvaluacionDeAlumno(
  actor: AuthUser,
  evaninopenId: number,
): Promise<FichaDeEvaluacion> {
  const pendiente = await exigirPendienteVisible(actor, evaninopenId);

  await enTransaccion(async (client) => {
    const borrados = await repo.borrarIntentosDe(client, evaninopenId);
    await repo.marcarEstadoPendiente(client, evaninopenId, false, null);

    await auditar(
      {
        actor,
        accion: 'eliminar',
        entidad: 'evaluacion_alumno',
        entidadId: evaninopenId,
        detalle: {
          alumno: pendiente.nino_nombre,
          evaluacion: pendiente.eva_titulo,
          intentosBorrados: borrados,
        },
      },
      client,
    );
  });

  return fichaDeAlumno(actor, evaninopenId);
}
