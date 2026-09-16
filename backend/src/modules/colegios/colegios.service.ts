import type { PoolClient } from 'pg';
import { alcanceDe, alcanzaColegio } from '../../lib/alcance.js';
import { auditar } from '../../lib/auditoria.js';
import { armarPagina, type Pagina } from '../../lib/paginacion.js';
import { borrarFoto, firmarFoto, firmarFotos, rutaValida } from '../../lib/storage.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as repo from './colegios.repository.js';
import type {
  ActualizarColegioInput,
  CrearColegioInput,
  ListarColegiosQuery,
} from './colegios.schemas.js';

/**
 * Colegios.
 *
 * El colegio es el contenedor de todo: define el alcance del coordinador y de
 * el cuelgan disciplinas, alumnos y asistencias. Por eso este modulo va justo
 * detras de Usuarios y antes que Disciplinas.
 */

function vacioANulo(v: string | undefined | null): string | null {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
}

function validarFoto(foto: string | null | undefined): void {
  if (foto === null || foto === undefined || foto === '') return;
  if (!rutaValida(foto, 'colegios')) {
    throw new ApiError(400, 'La ruta de la foto no es valida');
  }
}

export type ColegioListadoConFoto = repo.ColegioListado & { col_rep_foto_url: string | null };
export type ColegioDetalleConFoto = repo.ColegioDetalle & { col_rep_foto_url: string | null };

async function conFotosFirmadas(
  items: repo.ColegioListado[],
): Promise<ColegioListadoConFoto[]> {
  const firmadas = await firmarFotos(items.map((c) => c.col_rep_foto));
  return items.map((c) => ({
    ...c,
    col_rep_foto_url: c.col_rep_foto ? (firmadas.get(c.col_rep_foto) ?? c.col_rep_foto) : null,
  }));
}

export async function listar(
  actor: AuthUser,
  query: ListarColegiosQuery,
): Promise<Pagina<ColegioListadoConFoto>> {
  const alcance = await alcanceDe(actor.usuario);
  const { items, total } = await repo.listarColegios(query, alcance);
  return armarPagina(await conFotosFirmadas(items), total, {
    page: query.page,
    limit: query.limit,
  });
}

/**
 * Ficha. El alcance se comprueba con el propio col_id, que aqui si es directo:
 * en Usuarios habia que preguntar "¿este usuario toca alguno de mis colegios?"
 * y aqui la pregunta es literalmente el alcance.
 */
export async function obtener(actor: AuthUser, colId: number): Promise<ColegioDetalleConFoto> {
  const colegio = await repo.obtenerColegio(colId);
  if (!colegio) throw new ApiError(404, 'Colegio no encontrado');

  await exigirAlcance(actor, colId);

  return { ...colegio, col_rep_foto_url: await firmarFoto(colegio.col_rep_foto) };
}

async function exigirAlcance(actor: AuthUser, colId: number): Promise<void> {
  const alcance = await alcanceDe(actor.usuario);
  if (!alcanzaColegio(alcance, colId)) {
    throw new ApiError(403, 'Ese colegio esta fuera de tu alcance');
  }
}

/**
 * Crear un colegio es un acto global: quien lo crea no lo tiene todavia en su
 * alcance — no existe hasta que se guarda — asi que aqui no hay nada que
 * comprobar mas alla del permiso `colegios.crear`. Los coordinadores no lo
 * tienen; el Propietario si.
 */
export async function crear(
  actor: AuthUser,
  input: CrearColegioInput,
): Promise<ColegioDetalleConFoto> {
  validarFoto(input.col_rep_foto);

  if (await repo.existeNombre(input.col_nombre, null)) {
    throw new ApiError(409, 'Ya existe un colegio con ese nombre');
  }

  const colId = await enTransaccion(async (client) => {
    const nuevoId = await repo.insertarColegio(client, {
      nombre: input.col_nombre,
      direccion: input.col_direccion,
      repNombre: vacioANulo(input.col_rep_nombre),
      repTelefono: vacioANulo(input.col_rep_telefono),
      repEmail: vacioANulo(input.col_rep_email),
      repFoto: vacioANulo(input.col_rep_foto),
    });

    if (input.coordinadores && input.coordinadores.length > 0) {
      await exigirCoordinadoresValidos(client, input.coordinadores);
      await repo.sincronizarCoordinadores(client, nuevoId, input.coordinadores);
    }

    await auditar(
      {
        actor,
        accion: 'crear',
        entidad: 'colegio',
        entidadId: nuevoId,
        detalle: { nombre: input.col_nombre, coordinadores: input.coordinadores ?? [] },
      },
      client,
    );

    return nuevoId;
  });

  const creado = await repo.obtenerColegio(colId);
  return { ...creado!, col_rep_foto_url: await firmarFoto(creado!.col_rep_foto) };
}

/**
 * Edicion. Datos del colegio y coordinadores, en una sola transaccion.
 *
 * En el sistema viejo eran tres escrituras sueltas desde el navegador —update
 * del colegio, delete de todos los coordinadores, insert de los nuevos— y
 * entre la segunda y la tercera el colegio se quedaba sin nadie a cargo.
 */
export async function actualizar(
  actor: AuthUser,
  colId: number,
  input: ActualizarColegioInput,
): Promise<ColegioDetalleConFoto> {
  validarFoto(input.col_rep_foto);

  const antes = await repo.obtenerColegio(colId);
  if (!antes) throw new ApiError(404, 'Colegio no encontrado');

  await exigirAlcance(actor, colId);

  if (input.col_nombre && input.col_nombre !== antes.col_nombre) {
    if (await repo.existeNombre(input.col_nombre, colId)) {
      throw new ApiError(409, 'Ya existe otro colegio con ese nombre');
    }
  }

  await enTransaccion(async (client) => {
    await repo.actualizarColegio(client, colId, {
      nombre: input.col_nombre,
      direccion: input.col_direccion,
      repNombre: vacioANulo(input.col_rep_nombre),
      tocarRepNombre: input.col_rep_nombre !== undefined,
      repTelefono: vacioANulo(input.col_rep_telefono),
      tocarRepTelefono: input.col_rep_telefono !== undefined,
      repEmail: vacioANulo(input.col_rep_email),
      tocarRepEmail: input.col_rep_email !== undefined,
      repFoto: input.col_rep_foto === null ? null : vacioANulo(input.col_rep_foto),
      tocarRepFoto: input.col_rep_foto !== undefined,
    });

    let agregados: number[] = [];
    let quitados: number[] = [];

    if (input.coordinadores) {
      await exigirCoordinadoresValidos(client, input.coordinadores);
      const diff = await repo.sincronizarCoordinadores(client, colId, input.coordinadores);
      agregados = diff.agregados;
      quitados = diff.quitados;
    }

    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'colegio',
        entidadId: colId,
        detalle: {
          campos: Object.keys(input),
          coordinadoresAgregados: agregados,
          coordinadoresQuitados: quitados,
        },
      },
      client,
    );
  });

  // Despues del COMMIT: si se borrara antes y la transaccion fallara, la fila
  // quedaria apuntando a un objeto que ya no existe.
  const fotoCambio =
    input.col_rep_foto !== undefined && input.col_rep_foto !== antes.col_rep_foto;
  if (fotoCambio) {
    await borrarFoto(antes.col_rep_foto);
  }

  const despues = await repo.obtenerColegio(colId);
  return { ...despues!, col_rep_foto_url: await firmarFoto(despues!.col_rep_foto) };
}

/**
 * Reemplaza la lista de coordinadores. Existe aparte del PATCH porque es la
 * operacion que cambia quien ve que: merece su propio endpoint y su propia
 * linea en la auditoria.
 */
export async function reemplazarCoordinadores(
  actor: AuthUser,
  colId: number,
  coordinadores: number[],
): Promise<ColegioDetalleConFoto> {
  const antes = await repo.obtenerColegio(colId);
  if (!antes) throw new ApiError(404, 'Colegio no encontrado');

  await exigirAlcance(actor, colId);

  await enTransaccion(async (client) => {
    await exigirCoordinadoresValidos(client, coordinadores);
    const { agregados, quitados } = await repo.sincronizarCoordinadores(
      client,
      colId,
      coordinadores,
    );
    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'colegio',
        entidadId: colId,
        detalle: { coordinadoresAgregados: agregados, coordinadoresQuitados: quitados },
      },
      client,
    );
  });

  const despues = await repo.obtenerColegio(colId);
  return { ...despues!, col_rep_foto_url: await firmarFoto(despues!.col_rep_foto) };
}

/**
 * Coordinar un colegio exige tener el rol de Coordinador y estar activo.
 *
 * Sin esto se puede dejar como coordinador a alguien que no lo es: la fila de
 * colegio_coordinador existiria, pero `alcanceDe` no se la cuenta —cada camino
 * exige el rol— asi que el colegio parece tener responsable y esa persona no
 * ve nada. Es justo el tipo de dato que miente sin dar error.
 */
async function exigirCoordinadoresValidos(client: PoolClient, ids: number[]): Promise<void> {
  const invalidos = await repo.idsQueNoPuedenCoordinar(client, ids);
  if (invalidos.length > 0) {
    throw new ApiError(
      400,
      `Estos usuarios no pueden coordinar un colegio (no existen, estan inactivos o no tienen el rol de Coordinador): ${invalidos.join(', ')}`,
    );
  }
}

export async function candidatos(): Promise<repo.CoordinadorResumen[]> {
  return repo.listarCandidatosACoordinador();
}

export async function impacto(actor: AuthUser, colId: number): Promise<repo.ImpactoColegio> {
  const colegio = await repo.obtenerColegio(colId);
  if (!colegio) throw new ApiError(404, 'Colegio no encontrado');
  await exigirAlcance(actor, colId);
  return repo.calcularImpacto(colId);
}

/**
 * Borrado permanente.
 *
 * Un colegio no se da de baja: la tabla no tiene estado. O esta vacio y se va,
 * o tiene historial y entonces no se borra. Las tres cerraduras son las mismas
 * que en Usuarios: permiso, nombre escrito a mano y recuento previo.
 */
export async function eliminar(
  actor: AuthUser,
  colId: number,
  confirmacion: string,
): Promise<repo.ImpactoColegio> {
  const colegio = await repo.obtenerColegio(colId);
  if (!colegio) throw new ApiError(404, 'Colegio no encontrado');

  await exigirAlcance(actor, colId);

  if (confirmacion.trim().toLowerCase() !== colegio.col_nombre.trim().toLowerCase()) {
    throw new ApiError(400, 'El nombre escrito no coincide con el del colegio');
  }

  const impactoPrevio = await repo.calcularImpacto(colId);
  if (!impactoPrevio.puedeEliminar) {
    throw new ApiError(
      409,
      'No se puede eliminar: el colegio todavia tiene datos atados. Quitalos primero.',
      impactoPrevio.bloqueos,
    );
  }

  await enTransaccion(async (client) => {
    await auditar(
      {
        actor,
        accion: 'eliminar',
        entidad: 'colegio',
        entidadId: colId,
        detalle: {
          nombre: colegio.col_nombre,
          direccion: colegio.col_direccion,
          eliminado: impactoPrevio.eliminables,
        },
      },
      client,
    );
    await repo.eliminarColegio(client, colId);
  });

  await borrarFoto(colegio.col_rep_foto);

  return impactoPrevio;
}
