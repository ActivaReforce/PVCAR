import { auditar } from '../../lib/auditoria.js';
import { armarPagina, type Pagina } from '../../lib/paginacion.js';
import { enTransaccion } from '../../lib/tx.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error.js';
import * as repo from './actividades.repository.js';
import type {
  ActualizarActividadInput,
  CrearActividadInput,
  ListarActividadesQuery,
} from './actividades.schemas.js';

/**
 * Actividades: el catalogo de que se imparte.
 *
 * No lleva alcance. Una actividad no pertenece a ningun colegio —"Karate" es
 * "Karate" en los siete— y quien puede verla lo decide el permiso
 * `actividades.ver`, que tienen todos los roles administrativos. El colegio
 * entra en la ecuacion en Disciplinas.
 */

function vacioANulo(v: string | undefined | null): string | null {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
}

/** Lista limpia: sin vacios, sin repetidos y en el orden en que se escribio. */
function normalizarMateriales(lista: string[] | undefined): string[] | null {
  if (lista === undefined) return null;
  const limpios = [...new Set(lista.map((m) => m.trim()).filter((m) => m.length > 0))];
  return limpios.length > 0 ? limpios : null;
}

export async function listar(query: ListarActividadesQuery): Promise<Pagina<repo.ActividadListada>> {
  const { items, total } = await repo.listarActividades(query);
  return armarPagina(items, total, { page: query.page, limit: query.limit });
}

export async function obtener(actId: number): Promise<repo.ActividadListada> {
  const actividad = await repo.obtenerActividad(actId);
  if (!actividad) throw new ApiError(404, 'Actividad no encontrada');
  return actividad;
}

export async function categorias(): Promise<repo.Categoria[]> {
  return repo.listarCategorias();
}

export async function crear(
  actor: AuthUser,
  input: CrearActividadInput,
): Promise<repo.ActividadListada> {
  if (await repo.existeNombre(input.act_nombre, null)) {
    throw new ApiError(409, 'Ya existe una actividad con ese nombre');
  }

  const actId = await enTransaccion(async (client) => {
    if (input.cat_id != null && !(await repo.existeCategoria(input.cat_id, client))) {
      throw new ApiError(400, 'La categoria no existe');
    }

    const nuevoId = await repo.insertarActividad(client, {
      nombre: input.act_nombre,
      descripcion: vacioANulo(input.act_descripcion),
      catId: input.cat_id ?? null,
      indumentaria: vacioANulo(input.act_indumentaria_tipo),
      espacioTrabajo: vacioANulo(input.act_espacio_trabajo),
      tipoEspacio: vacioANulo(input.act_tipo_espacio),
      espacioSecundario: vacioANulo(input.act_espacio_secundario),
      materiales: normalizarMateriales(input.act_materiales_alumno),
    });

    await auditar(
      {
        actor,
        accion: 'crear',
        entidad: 'actividad',
        entidadId: nuevoId,
        detalle: { nombre: input.act_nombre, categoria: input.cat_id ?? null },
      },
      client,
    );

    return nuevoId;
  });

  return obtener(actId);
}

export async function actualizar(
  actor: AuthUser,
  actId: number,
  input: ActualizarActividadInput,
): Promise<repo.ActividadListada> {
  const antes = await repo.obtenerActividad(actId);
  if (!antes) throw new ApiError(404, 'Actividad no encontrada');

  if (input.act_nombre && input.act_nombre !== antes.act_nombre) {
    if (await repo.existeNombre(input.act_nombre, actId)) {
      throw new ApiError(409, 'Ya existe otra actividad con ese nombre');
    }
  }

  await enTransaccion(async (client) => {
    if (input.cat_id != null && !(await repo.existeCategoria(input.cat_id, client))) {
      throw new ApiError(400, 'La categoria no existe');
    }

    await repo.actualizarActividad(client, actId, {
      nombre: input.act_nombre,
      descripcion: vacioANulo(input.act_descripcion),
      tocarDescripcion: input.act_descripcion !== undefined,
      catId: input.cat_id ?? null,
      tocarCategoria: input.cat_id !== undefined,
      indumentaria: vacioANulo(input.act_indumentaria_tipo),
      tocarIndumentaria: input.act_indumentaria_tipo !== undefined,
      espacioTrabajo: vacioANulo(input.act_espacio_trabajo),
      tocarEspacioTrabajo: input.act_espacio_trabajo !== undefined,
      tipoEspacio: vacioANulo(input.act_tipo_espacio),
      tocarTipoEspacio: input.act_tipo_espacio !== undefined,
      espacioSecundario: vacioANulo(input.act_espacio_secundario),
      tocarEspacioSecundario: input.act_espacio_secundario !== undefined,
      materiales: normalizarMateriales(input.act_materiales_alumno),
      tocarMateriales: input.act_materiales_alumno !== undefined,
    });

    await auditar(
      {
        actor,
        accion: 'editar',
        entidad: 'actividad',
        entidadId: actId,
        detalle: { campos: Object.keys(input) },
      },
      client,
    );
  });

  return obtener(actId);
}

export async function impacto(actId: number): Promise<repo.ImpactoActividad> {
  const actividad = await repo.obtenerActividad(actId);
  if (!actividad) throw new ApiError(404, 'Actividad no encontrada');
  return repo.calcularImpacto(actId);
}

/**
 * Borrado permanente.
 *
 * Una actividad no tiene baja logica: la tabla no tiene estado, y una que ya
 * no se imparte simplemente deja de tener disciplinas. Si queda alguna
 * apuntando —aunque este de baja— no se borra, porque la clave foranea no
 * lleva cascada y el historial de esa disciplina tiene que seguir diciendo
 * que actividad era.
 */
export async function eliminar(
  actor: AuthUser,
  actId: number,
  confirmacion: string,
): Promise<repo.ImpactoActividad> {
  const actividad = await repo.obtenerActividad(actId);
  if (!actividad) throw new ApiError(404, 'Actividad no encontrada');

  if (confirmacion.trim().toLowerCase() !== actividad.act_nombre.trim().toLowerCase()) {
    throw new ApiError(400, 'El nombre escrito no coincide con el de la actividad');
  }

  const impactoPrevio = await repo.calcularImpacto(actId);
  if (!impactoPrevio.puedeEliminar) {
    throw new ApiError(
      409,
      'No se puede eliminar: hay disciplinas que usan esta actividad. Quitalas primero desde Disciplinas.',
      impactoPrevio.bloqueos,
    );
  }

  await enTransaccion(async (client) => {
    await auditar(
      {
        actor,
        accion: 'eliminar',
        entidad: 'actividad',
        entidadId: actId,
        detalle: { nombre: actividad.act_nombre },
      },
      client,
    );
    await repo.eliminarActividad(client, actId);
  });

  return impactoPrevio;
}
