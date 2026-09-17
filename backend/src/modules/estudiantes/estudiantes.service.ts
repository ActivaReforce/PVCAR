import type { PoolClient } from 'pg';
import { alcanceDe, alcanzaColegio, alcanzaDisciplina, type Alcance } from '../../lib/alcance.js';
import { auditar } from '../../lib/auditoria.js';
import { ESTADO } from '../../lib/constants.js';
import { armarPagina, type Pagina } from '../../lib/paginacion.js';
import { borrarFoto, firmarFoto, firmarFotos, rutaValida } from '../../lib/storage.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as repo from './estudiantes.repository.js';
import type {
  ActualizarEstudianteInput,
  CrearEstudianteInput,
  ListarEstudiantesQuery,
} from './estudiantes.schemas.js';

/**
 * Estudiantes.
 *
 * 796 ninos, 1672 inscripciones y datos personales de menores: es el modulo
 * donde mas duelen las tres malas practicas del sistema viejo — traerselo todo
 * al navegador, decidir alli quien ve que, y escribir en varias tablas sin
 * transaccion.
 */

function vacioANulo(v: string | undefined | null): string | null {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
}

function validarFoto(foto: string | null | undefined): void {
  if (foto === null || foto === undefined || foto === '') return;
  if (!rutaValida(foto, 'estudiantes')) {
    throw new ApiError(400, 'La ruta de la foto no es valida');
  }
}

export type EstudianteConFoto = repo.EstudianteListado & { nino_foto_url: string | null };
export type EstudianteDetalleConFoto = repo.EstudianteDetalle & { nino_foto_url: string | null };

async function conFotos(items: repo.EstudianteListado[]): Promise<EstudianteConFoto[]> {
  const firmadas = await firmarFotos(items.map((n) => n.nino_foto));
  return items.map((n) => ({
    ...n,
    nino_foto_url: n.nino_foto ? (firmadas.get(n.nino_foto) ?? n.nino_foto) : null,
  }));
}

export interface ListaEstudiantes extends Pagina<EstudianteConFoto> {
  conteos: repo.ConteosEstudiantes;
}

export async function listar(
  actor: AuthUser,
  query: ListarEstudiantesQuery,
): Promise<ListaEstudiantes> {
  const alcance = await alcanceDe(actor.usuario);

  const [pagina, conteos] = await Promise.all([
    repo.listarEstudiantes(query, alcance),
    repo.contarEstudiantes(query, alcance),
  ]);

  return {
    ...armarPagina(await conFotos(pagina.items), pagina.total, {
      page: query.page,
      limit: query.limit,
    }),
    conteos,
  };
}

export interface FichaEstudiante {
  estudiante: EstudianteDetalleConFoto;
  inscripciones: repo.InscripcionListada[];
  representantes: repo.RepresentanteListado[];
}

export async function ficha(
  actor: AuthUser,
  ninoId: number,
  historial: boolean,
): Promise<FichaEstudiante> {
  const estudiante = await exigirVisible(actor, ninoId);

  const [inscripciones, representantes] = await Promise.all([
    repo.listarInscripciones(ninoId, historial),
    repo.listarRepresentantes(ninoId),
  ]);

  return {
    estudiante: { ...estudiante, nino_foto_url: await firmarFoto(estudiante.nino_foto) },
    inscripciones,
    representantes,
  };
}

/**
 * Un estudiante esta dentro del alcance si lo esta su colegio o si esta
 * inscrito en alguna disciplina del alcance. Los dos caminos importan: el
 * coordinador entra por colegio y el entrenador por disciplina.
 */
async function exigirVisible(
  actor: AuthUser,
  ninoId: number,
): Promise<repo.EstudianteDetalle> {
  const estudiante = await repo.obtenerEstudiante(ninoId);
  if (!estudiante) throw new ApiError(404, 'Estudiante no encontrado');

  const alcance = await alcanceDe(actor.usuario);
  if (alcance.global || alcanzaColegio(alcance, estudiante.col_id)) return estudiante;

  const inscripciones = await repo.listarInscripciones(ninoId, false);
  if (inscripciones.some((i) => alcanzaDisciplina(alcance, i.colacthor_id))) return estudiante;

  throw new ApiError(403, 'Ese estudiante esta fuera de tu alcance');
}

function exigirColegio(alcance: Alcance, colId: number): void {
  if (!alcanzaColegio(alcance, colId)) {
    throw new ApiError(403, 'Ese colegio esta fuera de tu alcance');
  }
}

/**
 * Alta. El estudiante nace en un colegio y puede inscribirse de una vez en
 * disciplinas **de ese colegio**; todo en una transaccion.
 *
 * Al inscribirlo, el trigger `trigger_nino_asignacion_evaluation` le crea sus
 * evaluaciones pendientes. No se toca a mano: es del esquema y hay que
 * respetarlo.
 */
export async function crear(
  actor: AuthUser,
  input: CrearEstudianteInput,
): Promise<EstudianteDetalleConFoto> {
  validarFoto(input.nino_foto);

  const alcance = await alcanceDe(actor.usuario);
  exigirColegio(alcance, input.col_id);

  const ninoId = await enTransaccion(async (client) => {
    const nuevoId = await repo.insertarEstudiante(client, {
      nombre: input.nino_nombre,
      colId: input.col_id,
      gradoId: input.catninograd_id ?? null,
      edad: input.nino_edad ?? null,
      cedula: vacioANulo(input.nino_cedula),
      transporte: input.nino_toma_transporte ?? null,
      salud: vacioANulo(input.nino_info_salud),
      otra: vacioANulo(input.nino_otra_info),
      foto: vacioANulo(input.nino_foto ?? undefined),
    });

    for (const colacthorId of input.disciplinas ?? []) {
      await exigirDisciplinaDelColegio(client, colacthorId, input.col_id);
      await repo.inscribir(client, nuevoId, colacthorId);
    }

    await auditar(
      {
        actor,
        accion: 'crear',
        entidad: 'estudiante',
        entidadId: nuevoId,
        detalle: {
          nombre: input.nino_nombre,
          col_id: input.col_id,
          inscripciones: input.disciplinas?.length ?? 0,
        },
      },
      client,
    );

    return nuevoId;
  });

  const creado = await repo.obtenerEstudiante(ninoId);
  return { ...creado!, nino_foto_url: await firmarFoto(creado!.nino_foto) };
}

/**
 * Un estudiante solo se inscribe en disciplinas de su propio colegio.
 *
 * Nada lo impedia y en los datos reales no ha pasado nunca (0 de 1672), pero
 * el selector viejo se alimentaba del colegio elegido en pantalla, no del
 * colegio del nino: bastaba cambiar el filtro antes de guardar.
 */
async function exigirDisciplinaDelColegio(
  client: PoolClient,
  colacthorId: number,
  colId: number,
): Promise<void> {
  const disciplina = await repo.disciplinaDelColegio(client, colacthorId);
  if (!disciplina) throw new ApiError(400, 'La disciplina no existe');
  if (disciplina.col_id !== colId) {
    throw new ApiError(400, 'Esa disciplina es de otro colegio');
  }
  if (disciplina.est_id !== ESTADO.ACTIVO) {
    throw new ApiError(409, 'Esa disciplina esta dada de baja');
  }
}

/**
 * Edicion.
 *
 * Cambiar de colegio con inscripciones activas se rechaza: esas inscripciones
 * son de disciplinas del colegio viejo y quedarian cruzadas. Hay que darlas de
 * baja primero, y asi queda explicito que el alumno deja de ir a esas clases.
 */
export async function actualizar(
  actor: AuthUser,
  ninoId: number,
  input: ActualizarEstudianteInput,
): Promise<EstudianteDetalleConFoto> {
  validarFoto(input.nino_foto);

  const antes = await exigirVisible(actor, ninoId);
  const alcance = await alcanceDe(actor.usuario);

  if (input.col_id && input.col_id !== antes.col_id) {
    exigirColegio(alcance, input.col_id);
    if (antes.disciplinas > 0) {
      throw new ApiError(
        409,
        `No se puede cambiar de colegio con ${antes.disciplinas} inscripcion(es) activa(s). Dalas de baja primero.`,
      );
    }
  }

  await enTransaccion(async (client) => {
    await repo.actualizarEstudiante(client, ninoId, {
      nombre: input.nino_nombre,
      colId: input.col_id,
      gradoId: input.catninograd_id ?? null,
      tocarGrado: input.catninograd_id !== undefined,
      edad: input.nino_edad ?? null,
      tocarEdad: input.nino_edad !== undefined,
      cedula: vacioANulo(input.nino_cedula),
      tocarCedula: input.nino_cedula !== undefined,
      transporte: input.nino_toma_transporte ?? null,
      tocarTransporte: input.nino_toma_transporte !== undefined,
      salud: vacioANulo(input.nino_info_salud),
      tocarSalud: input.nino_info_salud !== undefined,
      otra: vacioANulo(input.nino_otra_info),
      tocarOtra: input.nino_otra_info !== undefined,
      foto: input.nino_foto === null ? null : vacioANulo(input.nino_foto ?? undefined),
      tocarFoto: input.nino_foto !== undefined,
    });

    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'estudiante',
        entidadId: ninoId,
        detalle: { campos: Object.keys(input) },
      },
      client,
    );
  });

  if (input.nino_foto !== undefined && input.nino_foto !== antes.nino_foto) {
    await borrarFoto(antes.nino_foto);
  }

  const despues = await repo.obtenerEstudiante(ninoId);
  return { ...despues!, nino_foto_url: await firmarFoto(despues!.nino_foto) };
}

export async function disponibles(
  actor: AuthUser,
  ninoId: number,
): Promise<repo.DisciplinaDisponible[]> {
  await exigirVisible(actor, ninoId);
  return repo.listarDisponibles(ninoId);
}

/**
 * Sincroniza las inscripciones: llega la lista completa de disciplinas
 * activas que debe tener y el backend calcula la diferencia.
 *
 * Reinscribir a alguien que ya estuvo **reabre** su fila en vez de crear otra
 * —lo exige el indice unico parcial— y con ella vuelven sus evaluaciones
 * pendientes. Eso lo hace `reactivate_nino_asignacion`, la funcion del
 * esquema, llamada dentro de esta misma transaccion.
 */
export async function sincronizarInscripciones(
  actor: AuthUser,
  ninoId: number,
  deseadas: number[],
): Promise<repo.InscripcionListada[]> {
  const estudiante = await exigirVisible(actor, ninoId);

  if (estudiante.est_id !== ESTADO.ACTIVO && deseadas.length > 0) {
    throw new ApiError(409, 'El estudiante esta dado de baja: reactivalo antes de inscribirlo');
  }

  await enTransaccion(async (client) => {
    const activas = await repo.inscripcionesActivas(client, ninoId);
    const actuales = activas.map((a) => a.colacthor_id);

    const aInscribir = deseadas.filter((id) => !actuales.includes(id));
    const aDarDeBaja = activas.filter((a) => !deseadas.includes(a.colacthor_id));

    for (const colacthorId of aInscribir) {
      await exigirDisciplinaDelColegio(client, colacthorId, estudiante.col_id);
      await repo.inscribir(client, ninoId, colacthorId);
    }
    for (const inscripcion of aDarDeBaja) {
      await repo.darDeBajaInscripcion(client, inscripcion.ninoasig_id);
    }

    if (aInscribir.length > 0 || aDarDeBaja.length > 0) {
      await auditar(
        {
          actor,
          accion: 'editar',
          entidad: 'estudiante',
          entidadId: ninoId,
          detalle: {
            inscritas: aInscribir,
            dadasDeBaja: aDarDeBaja.map((a) => a.colacthor_id),
          },
        },
        client,
      );
    }
  });

  return repo.listarInscripciones(ninoId, false);
}

/**
 * Baja del estudiante: `est_id = 2` y **sus inscripciones activas se cierran**.
 *
 * En el sistema viejo eran dos updates sueltos desde el navegador; si fallaba
 * el segundo, el alumno quedaba inactivo pero seguia apareciendo en las listas
 * de asistencia de sus disciplinas.
 */
export async function darDeBaja(
  actor: AuthUser,
  ninoId: number,
): Promise<EstudianteDetalleConFoto> {
  const antes = await exigirVisible(actor, ninoId);
  if (antes.est_id === ESTADO.INACTIVO) {
    throw new ApiError(409, 'El estudiante ya estaba dado de baja');
  }

  await enTransaccion(async (client) => {
    await repo.cambiarEstado(client, ninoId, ESTADO.INACTIVO);
    const cerradas = await repo.cerrarTodasLasInscripciones(client, ninoId);
    await auditar(
      {
        actor,
        accion: 'baja',
        entidad: 'estudiante',
        entidadId: ninoId,
        detalle: { nombre: antes.nino_nombre, inscripcionesCerradas: cerradas },
      },
      client,
    );
  });

  const despues = await repo.obtenerEstudiante(ninoId);
  return { ...despues!, nino_foto_url: await firmarFoto(despues!.nino_foto) };
}

/** Reactivar no reabre inscripciones: se vuelve a inscribir a mano. */
export async function reactivar(
  actor: AuthUser,
  ninoId: number,
): Promise<EstudianteDetalleConFoto> {
  const antes = await exigirVisible(actor, ninoId);
  if (antes.est_id === ESTADO.ACTIVO) {
    throw new ApiError(409, 'El estudiante ya estaba activo');
  }

  await enTransaccion(async (client) => {
    await repo.cambiarEstado(client, ninoId, ESTADO.ACTIVO);
    await auditar(
      {
        actor,
        accion: 'reactivar',
        entidad: 'estudiante',
        entidadId: ninoId,
        detalle: { nombre: antes.nino_nombre },
      },
      client,
    );
  });

  const despues = await repo.obtenerEstudiante(ninoId);
  return { ...despues!, nino_foto_url: await firmarFoto(despues!.nino_foto) };
}

export async function impacto(
  actor: AuthUser,
  ninoId: number,
): Promise<repo.ImpactoEstudiante> {
  await exigirVisible(actor, ninoId);
  return repo.calcularImpacto(ninoId);
}

/**
 * Borrado permanente.
 *
 * Aqui no hay nada que lo bloquee: las tres claves foraneas que apuntan a
 * `nino` son ON DELETE CASCADE y desde `nino_asignacion` la cascada sigue
 * hasta las evaluaciones pendientes y sus intentos. Borrar a un nino **se
 * lleva su historial entero**, que es exactamente lo que el cliente pidio
 * (2026-08-07) y exactamente por lo que hay que ensenar el recuento antes y
 * exigir que se escriba el nombre.
 */
export async function eliminar(
  actor: AuthUser,
  ninoId: number,
  confirmacion: string,
): Promise<repo.ImpactoEstudiante> {
  const estudiante = await exigirVisible(actor, ninoId);

  if (confirmacion.trim().toLowerCase() !== estudiante.nino_nombre.trim().toLowerCase()) {
    throw new ApiError(400, 'El nombre escrito no coincide con el del estudiante');
  }

  const impactoPrevio = await repo.calcularImpacto(ninoId);

  await enTransaccion(async (client) => {
    await auditar(
      {
        actor,
        accion: 'eliminar',
        entidad: 'estudiante',
        entidadId: ninoId,
        detalle: {
          nombre: estudiante.nino_nombre,
          colegio: estudiante.col_nombre,
          destruido: impactoPrevio.eliminables,
        },
      },
      client,
    );
    await repo.eliminarEstudiante(client, ninoId);
  });

  await borrarFoto(estudiante.nino_foto);

  return impactoPrevio;
}

// ---------------------------------------------------------------------------
// Representantes

export async function candidatosARepresentante(): Promise<
  Array<{ usu_id: number; padre_id: number; usu_nombre: string; usu_correo: string }>
> {
  return repo.listarCandidatosARepresentante();
}

/**
 * Atar un representante.
 *
 * Exige que el usuario tenga el rol 4 **y** ficha de `padre`; las dos cosas
 * las crea Usuarios al concederle el rol. Hoy no hay ni un representante en
 * los datos reales: el modulo se estrena vacio.
 */
export async function atarRepresentante(
  actor: AuthUser,
  ninoId: number,
  usuId: number,
): Promise<repo.RepresentanteListado[]> {
  await exigirVisible(actor, ninoId);

  await enTransaccion(async (client) => {
    const padre = await repo.padreDeUsuario(client, usuId);
    if (!padre) {
      throw new ApiError(
        400,
        'Ese usuario no es un representante activo. Dale el rol de Representante desde Usuarios.',
      );
    }

    const ninopadreId = await repo.atarRepresentante(client, ninoId, padre.padre_id);
    if (ninopadreId === null) {
      throw new ApiError(409, 'Ese representante ya esta atado a este estudiante');
    }

    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'estudiante',
        entidadId: ninoId,
        detalle: { representanteAtado: usuId },
      },
      client,
    );
  });

  return repo.listarRepresentantes(ninoId);
}

/**
 * Soltar un representante si es un DELETE: `nino_padre` es una tabla de
 * vinculo pura, sin estado ni fechas. No se pierde historial porque no lo
 * guarda.
 */
export async function soltarRepresentante(
  actor: AuthUser,
  ninoId: number,
  ninopadreId: number,
): Promise<repo.RepresentanteListado[]> {
  await exigirVisible(actor, ninoId);

  await enTransaccion(async (client) => {
    const soltado = await repo.soltarRepresentante(client, ninoId, ninopadreId);
    if (!soltado) throw new ApiError(404, 'Ese vinculo no existe');

    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'estudiante',
        entidadId: ninoId,
        detalle: { representanteSoltado: ninopadreId },
      },
      client,
    );
  });

  return repo.listarRepresentantes(ninoId);
}

export async function grados(): Promise<repo.Grado[]> {
  return repo.listarGrados();
}
