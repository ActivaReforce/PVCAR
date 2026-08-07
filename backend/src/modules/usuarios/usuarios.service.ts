import type { PoolClient } from 'pg';
import { getSupabaseAdmin } from '../../config/supabase.js';
import { ApiError } from '../../middleware/error.js';
import type { AuthUser } from '../../middleware/auth.js';
import { alcanceDe, type Alcance } from '../../lib/alcance.js';
import { auditar } from '../../lib/auditoria.js';
import { ESTADO, ROL, ROLES_GLOBALES } from '../../lib/constants.js';
import { armarPagina, type Pagina } from '../../lib/paginacion.js';
import { borrarFoto, firmarFoto, firmarFotos } from '../../lib/storage.js';
import { enTransaccion } from '../../lib/tx.js';
import { getPool } from '../../config/db.js';
import * as repo from './usuarios.repository.js';
import type {
  ActualizarUsuarioInput,
  CrearUsuarioInput,
  ListarUsuariosQuery,
} from './usuarios.schemas.js';

/** Ruta valida dentro del bucket usufoto. Nada de URLs absolutas nuevas. */
const RUTA_FOTO = /^usuarios\/[A-Za-z0-9._-]{1,120}$/;

function validarFoto(foto: string | null | undefined): void {
  if (foto === null || foto === undefined || foto === '') return;
  if (!RUTA_FOTO.test(foto)) {
    throw new ApiError(400, 'La ruta de la foto no es valida');
  }
}

function vacioANulo(v: string | undefined): string | null {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
}

/**
 * usu_foto guarda la ruta dentro del bucket privado; el navegador no puede
 * usarla. usu_foto_url es la URL firmada, valida una hora, y es lo unico que
 * sale hacia el frontend.
 */
export type UsuarioListadoConFoto = repo.UsuarioListado & { usu_foto_url: string | null };
export type UsuarioDetalleConFoto = repo.UsuarioDetalle & { usu_foto_url: string | null };

async function conFotosFirmadas(items: repo.UsuarioListado[]): Promise<UsuarioListadoConFoto[]> {
  const firmadas = await firmarFotos(items.map((u) => u.usu_foto));
  return items.map((u) => ({
    ...u,
    usu_foto_url: u.usu_foto ? (firmadas.get(u.usu_foto) ?? u.usu_foto) : null,
  }));
}

async function conFotoFirmada(detalle: repo.UsuarioDetalle): Promise<UsuarioDetalleConFoto> {
  return { ...detalle, usu_foto_url: await firmarFoto(detalle.usu_foto) };
}

export interface ListaUsuarios extends Pagina<UsuarioListadoConFoto> {
  conteos: repo.ConteosUsuarios;
}

export async function listar(actor: AuthUser, query: ListarUsuariosQuery): Promise<ListaUsuarios> {
  const alcance = await alcanceDe(actor.usuario);
  const yo = actor.usuario.usu_id;

  // Las dos consultas son independientes: en paralelo cuestan un viaje, no dos.
  const [pagina, conteos] = await Promise.all([
    repo.listarUsuarios(query, alcance, yo),
    repo.contarUsuarios(query, alcance, yo),
  ]);

  return {
    ...armarPagina(await conFotosFirmadas(pagina.items), pagina.total, {
      page: query.page,
      limit: query.limit,
    }),
    conteos,
  };
}

/**
 * Ficha de un usuario. El alcance se comprueba reusando la lista: si el actor
 * no lo ve en su lista, tampoco lo ve por id. Sin esto, un coordinador
 * adivinando ids leeria la ficha de cualquiera.
 */
export async function obtener(actor: AuthUser, usuId: number): Promise<UsuarioDetalleConFoto> {
  const usuario = await repo.obtenerUsuario(usuId);
  if (!usuario) {
    throw new ApiError(404, 'Usuario no encontrado');
  }
  await exigirAlcance(actor, usuId);
  return conFotoFirmada(usuario);
}

async function exigirAlcance(actor: AuthUser, usuId: number): Promise<void> {
  if (usuId === actor.usuario.usu_id) return;

  const alcance = await alcanceDe(actor.usuario);
  if (alcance.global) return;

  if (!(await esVisible(alcance, usuId))) {
    throw new ApiError(403, 'Ese usuario esta fuera de tu alcance');
  }
}

/**
 * Mismo criterio de visibilidad que la lista, preguntado por un id concreto.
 * Se resuelve con una consulta minima en vez de paginar la lista entera.
 */
async function esVisible(alcance: Alcance, usuId: number): Promise<boolean> {
  const { rows } = await getPool().query(
    `SELECT 1
       FROM public.usuario u
      WHERE u.usu_id = $1
        AND ($2::boolean OR u.usu_id IN (
            SELECT cc.usu_id FROM public.colegio_coordinador cc WHERE cc.col_id = ANY($3::int[])
            UNION
            SELECT ea.ent_id FROM public.entrenador_asignacion ea
              JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
             WHERE cah.col_id = ANY($3::int[])
            UNION
            SELECT aux.usu_id FROM public.entrenador_auxiliar aux
              JOIN public.entrenador_asignacion ea ON ea.ent_id = aux.ent_id
              JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = ea.colacthor_id
             WHERE cah.col_id = ANY($3::int[])
            UNION
            SELECT p.usu_id FROM public.padre p
              JOIN public.nino_padre np ON np.padre_id = p.padre_id
              JOIN public.nino_asignacion na ON na.nino_id = np.nino_id
              JOIN public.colegio_actividad_horario cah ON cah.colacthor_id = na.colacthor_id
             WHERE cah.col_id = ANY($3::int[])
        ))
      LIMIT 1`,
    [usuId, alcance.global, alcance.colegios],
  );
  return rows.length > 0;
}

/**
 * Alta.
 *
 * El orden importa: primero la cuenta de Supabase Auth, despues la fila de
 * public.usuario. Es obligado, no una preferencia — el baseline tiene
 * CHECK (est_id <> 1 OR auth_user_id IS NOT NULL): un usuario activo sin
 * cuenta de Auth no se puede insertar. Es la misma razon por la que el
 * backfill del cutover va antes de la carga de datos.
 *
 * Si la transaccion falla despues de crear la cuenta, se borra la cuenta: sin
 * eso quedaria un huerfano en Auth que impide reintentar con el mismo correo.
 *
 * La contrasena la escribe el administrador (decision del cliente, 2026-08-07)
 * y la cuenta nace con el correo ya confirmado: si no, Supabase manda un
 * correo de verificacion que nadie espera y el usuario no puede entrar.
 */
export async function crear(actor: AuthUser, input: CrearUsuarioInput): Promise<UsuarioDetalleConFoto> {
  validarFoto(input.usu_foto);

  if (await repo.existeCorreo(input.usu_correo, null)) {
    throw new ApiError(409, 'Ya existe un usuario con ese correo');
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.usu_correo,
    password: input.password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new ApiError(400, `No se pudo crear la cuenta de acceso: ${error?.message ?? 'sin detalle'}`);
  }

  const authUserId = data.user.id;

  try {
    const usuId = await enTransaccion(async (client) => {
      const nuevoId = await repo.insertarUsuario(client, {
        authUserId,
        nombre: input.usu_nombre,
        correo: input.usu_correo,
        telefono: vacioANulo(input.usu_telefono),
        foto: vacioANulo(input.usu_foto ?? undefined),
      });

      await repo.sincronizarRoles(client, nuevoId, input.roles);
      await aplicarFichasDeRol(client, nuevoId, [], input.roles, {
        cedula: vacioANulo(input.ent_cedula),
        sector: vacioANulo(input.padre_sector_residencia),
        estadoUsuario: ESTADO.ACTIVO,
      });

      await auditar(
        {
          actor,
          accion: 'crear',
          entidad: 'usuario',
          entidadId: nuevoId,
          detalle: { correo: input.usu_correo, roles: input.roles },
        },
        client,
      );

      return nuevoId;
    });

    const creado = await repo.obtenerUsuario(usuId);
    return conFotoFirmada(creado!);
  } catch (err) {
    // Compensacion: la cuenta de Auth ya existe y la fila de dominio no.
    try {
      await admin.auth.admin.deleteUser(authUserId);
    } catch (limpieza) {
      console.error(
        `Quedo una cuenta de Auth huerfana (${authUserId}) tras fallar el alta de usuario:`,
        limpieza,
      );
    }
    throw err;
  }
}

/**
 * Edicion.
 *
 * Todo en una transaccion: en el sistema viejo esto eran hasta seis escrituras
 * sueltas y si fallaba la cuarta el usuario se quedaba sin ningun rol.
 *
 * Lo que toca Supabase Auth (correo y contrasena) se hace dentro del bloque,
 * antes del COMMIT. Si el COMMIT falla despues, se intenta devolver el correo
 * de Auth a su valor anterior; queda registrado si tampoco eso sale.
 */
export async function actualizar(
  actor: AuthUser,
  usuId: number,
  input: ActualizarUsuarioInput,
): Promise<UsuarioDetalleConFoto> {
  validarFoto(input.usu_foto);

  const antes = await repo.obtenerUsuario(usuId);
  if (!antes) {
    throw new ApiError(404, 'Usuario no encontrado');
  }

  if (input.usu_correo && input.usu_correo !== antes.usu_correo) {
    if (await repo.existeCorreo(input.usu_correo, usuId)) {
      throw new ApiError(409, 'Ya existe otro usuario con ese correo');
    }
  }

  if (input.roles) {
    await exigirQueNoSeQuedeSinPropietario(usuId, input.roles);
  }

  const admin = getSupabaseAdmin();
  let correoCambiado = false;

  await enTransaccion(async (client) => {
    await repo.actualizarUsuario(client, usuId, {
      nombre: input.usu_nombre,
      correo: input.usu_correo,
      telefono: vacioANulo(input.usu_telefono),
      tocarTelefono: input.usu_telefono !== undefined,
      foto: input.usu_foto === null ? null : vacioANulo(input.usu_foto ?? undefined),
      tocarFoto: input.usu_foto !== undefined,
    });

    let agregados: number[] = [];
    let quitados: number[] = [];

    if (input.roles) {
      const rolesAntes = await repo.rolesDe(usuId, client);
      const diff = await repo.sincronizarRoles(client, usuId, input.roles);
      agregados = diff.agregados;
      quitados = diff.quitados;
      await aplicarFichasDeRol(client, usuId, rolesAntes, input.roles, {
        cedula: vacioANulo(input.ent_cedula),
        sector: vacioANulo(input.padre_sector_residencia),
        estadoUsuario: antes.est_id,
      });
    } else {
      // Sin cambio de roles, los campos de ficha siguen siendo editables.
      const rolesActuales = await repo.rolesDe(usuId, client);
      await aplicarFichasDeRol(client, usuId, rolesActuales, rolesActuales, {
        cedula: vacioANulo(input.ent_cedula),
        sector: vacioANulo(input.padre_sector_residencia),
        estadoUsuario: antes.est_id,
      });
    }

    if (antes.auth_user_id) {
      const cambios: { email?: string; password?: string } = {};
      if (input.usu_correo && input.usu_correo !== antes.usu_correo) {
        cambios.email = input.usu_correo;
      }
      if (input.password) {
        cambios.password = input.password;
      }
      if (Object.keys(cambios).length > 0) {
        const { error } = await admin.auth.admin.updateUserById(antes.auth_user_id, {
          ...cambios,
          ...(cambios.email ? { email_confirm: true } : {}),
        });
        if (error) {
          throw new ApiError(400, `No se pudo actualizar la cuenta de acceso: ${error.message}`);
        }
        correoCambiado = Boolean(cambios.email);
      }
    } else if (input.password) {
      throw new ApiError(
        409,
        'Este usuario no tiene cuenta de acceso, no se le puede fijar contrasena',
      );
    }

    await auditar(
      {
        actor,
        accion: input.roles ? 'roles' : 'editar',
        entidad: 'usuario',
        entidadId: usuId,
        detalle: {
          campos: Object.keys(input).filter((k) => k !== 'password'),
          rolesAgregados: agregados,
          rolesQuitados: quitados,
          cambioPassword: Boolean(input.password),
        },
      },
      client,
    );
  }).catch(async (err: unknown) => {
    if (correoCambiado && antes.auth_user_id) {
      try {
        await admin.auth.admin.updateUserById(antes.auth_user_id, {
          email: antes.usu_correo,
          email_confirm: true,
        });
      } catch (revertir) {
        console.error(
          `El correo de Auth quedo desincronizado para usu_id=${usuId}:`,
          revertir,
        );
      }
    }
    throw err;
  });

  // La foto vieja se borra despues del COMMIT: si se borrara antes y la
  // transaccion fallara, la fila seguiria apuntando a un objeto inexistente.
  const fotoCambio = input.usu_foto !== undefined && input.usu_foto !== antes.usu_foto;
  if (fotoCambio) {
    await borrarFoto(antes.usu_foto);
  }

  const despues = await repo.obtenerUsuario(usuId);
  return conFotoFirmada(despues!);
}

/**
 * Fichas de entrenador y representante segun los roles.
 *
 * El sistema viejo tenia esto repartido entre useRoleTransitions (175 lineas)
 * y useUserFormSubmission, con la comprobacion hecha por nombre de rol ademas
 * de por id ("entrenador", "padre de familia", "padre"). Aqui es por id, con
 * constante, y en un solo sitio.
 *
 * Quitar el rol de entrenador con asignaciones activas se rechaza, igual que
 * antes; quitar el de representante teniendo estudiantes vinculados tambien,
 * que antes borraba la fila de padre en silencio y con ella el vinculo.
 */
async function aplicarFichasDeRol(
  client: PoolClient,
  usuId: number,
  rolesAntes: number[],
  rolesDespues: number[],
  datos: { cedula: string | null; sector: string | null; estadoUsuario: number },
): Promise<void> {
  const eraEntrenador = rolesAntes.includes(ROL.ENTRENADOR);
  const esEntrenador = rolesDespues.includes(ROL.ENTRENADOR);
  const eraRepresentante = rolesAntes.includes(ROL.REPRESENTANTE);
  const esRepresentante = rolesDespues.includes(ROL.REPRESENTANTE);

  if (esEntrenador) {
    await repo.upsertEntrenador(client, usuId, datos.cedula, datos.estadoUsuario);
  } else if (eraEntrenador) {
    const activas = await repo.contarAsignacionesActivas(client, usuId);
    if (activas > 0) {
      throw new ApiError(
        409,
        `No se puede quitar el rol de entrenador: tiene ${activas} asignacion(es) activa(s). Cierralas primero.`,
      );
    }
    await repo.desactivarEntrenador(client, usuId);
  }

  // Quitar el rol de coordinador con colegios a su cargo dejaria filas en
  // colegio_coordinador sin rol que las respalde. alcanceDe ya no las cuenta
  // sin el rol, pero el dato quedaria mintiendo: mejor rechazarlo aqui.
  if (rolesAntes.includes(ROL.COORDINADOR) && !rolesDespues.includes(ROL.COORDINADOR)) {
    const colegios = await repo.contarColegiosCoordinados(client, usuId);
    if (colegios > 0) {
      throw new ApiError(
        409,
        `No se puede quitar el rol de coordinador: tiene ${colegios} colegio(s) a su cargo. Quitaselos primero desde Colegios.`,
      );
    }
  }

  if (esRepresentante) {
    await repo.upsertPadre(client, usuId, datos.sector);
  } else if (eraRepresentante) {
    const hijos = await repo.contarHijosDelPadre(client, usuId);
    if (hijos > 0) {
      throw new ApiError(
        409,
        `No se puede quitar el rol de representante: tiene ${hijos} estudiante(s) vinculado(s).`,
      );
    }
    await repo.borrarPadre(client, usuId);
  }
}

/**
 * Nadie puede dejar al sistema sin Propietario. Si el ultimo activo con ese
 * rol se queda sin el, se da de baja o se borra, no queda quien administre
 * permisos y el sistema se cierra por dentro.
 */
async function exigirQueNoSeQuedeSinPropietario(
  usuId: number,
  rolesNuevos?: number[],
): Promise<void> {
  const pierdeElRol = rolesNuevos ? !rolesNuevos.includes(ROL.PROPIETARIO) : true;
  if (!pierdeElRol) return;

  const { rows } = await getPool().query<{ n: string }>(
    `SELECT count(*) AS n
       FROM public.usuario u
       JOIN public.usuario_rol ur ON ur.usu_id = u.usu_id
      WHERE ur.rol_id = $1 AND u.est_id = $2 AND u.usu_id <> $3`,
    [ROL.PROPIETARIO, ESTADO.ACTIVO, usuId],
  );

  if (Number(rows[0]?.n ?? 0) === 0) {
    const { rows: esPropietario } = await getPool().query(
      'SELECT 1 FROM public.usuario_rol WHERE usu_id = $1 AND rol_id = $2',
      [usuId, ROL.PROPIETARIO],
    );
    if (esPropietario.length > 0) {
      throw new ApiError(
        409,
        'Es el ultimo Propietario PVCAR activo: nombra otro antes de quitarle el rol, darlo de baja o eliminarlo.',
      );
    }
  }
}

/** Baja logica. Arrastra la ficha de entrenador y cierra sus asignaciones. */
export async function darDeBaja(actor: AuthUser, usuId: number): Promise<UsuarioDetalleConFoto> {
  if (usuId === actor.usuario.usu_id) {
    throw new ApiError(409, 'No puedes darte de baja a ti mismo');
  }

  const antes = await repo.obtenerUsuario(usuId);
  if (!antes) throw new ApiError(404, 'Usuario no encontrado');
  if (antes.est_id === ESTADO.INACTIVO) {
    throw new ApiError(409, 'El usuario ya estaba dado de baja');
  }

  await exigirQueNoSeQuedeSinPropietario(usuId);

  await enTransaccion(async (client) => {
    await repo.cambiarEstado(client, usuId, ESTADO.INACTIVO);
    const roles = await repo.rolesDe(usuId, client);
    if (roles.includes(ROL.ENTRENADOR)) {
      await repo.desactivarEntrenador(client, usuId);
    }
    await auditar(
      { actor, accion: 'baja', entidad: 'usuario', entidadId: usuId, detalle: { correo: antes.usu_correo } },
      client,
    );
  });

  // La sesion viva del usuario no se revoca: requireAuth ya responde 403 a los
  // inactivos en la siguiente peticion, y banear en Auth se olvida de deshacer
  // al reactivar.
  const despues = await repo.obtenerUsuario(usuId);
  return conFotoFirmada(despues!);
}

export async function reactivar(actor: AuthUser, usuId: number): Promise<UsuarioDetalleConFoto> {
  const antes = await repo.obtenerUsuario(usuId);
  if (!antes) throw new ApiError(404, 'Usuario no encontrado');
  if (antes.est_id === ESTADO.ACTIVO) {
    throw new ApiError(409, 'El usuario ya estaba activo');
  }
  if (!antes.auth_user_id) {
    // El CHECK del baseline lo rechazaria con un error de constraint ilegible.
    throw new ApiError(
      409,
      'No se puede reactivar: el usuario no tiene cuenta de acceso. Creale una primero.',
    );
  }

  await enTransaccion(async (client) => {
    await repo.cambiarEstado(client, usuId, ESTADO.ACTIVO);
    const roles = await repo.rolesDe(usuId, client);
    if (roles.includes(ROL.ENTRENADOR)) {
      // La ficha vuelve a activa; las asignaciones cerradas NO se reabren:
      // se vuelven a asignar desde Entrenadores, que es donde se decide.
      await repo.upsertEntrenador(client, usuId, null, ESTADO.ACTIVO);
    }
    await auditar(
      { actor, accion: 'reactivar', entidad: 'usuario', entidadId: usuId },
      client,
    );
  });

  const despues = await repo.obtenerUsuario(usuId);
  return conFotoFirmada(despues!);
}

export async function impacto(usuId: number): Promise<repo.ImpactoEliminacion> {
  const usuario = await repo.obtenerUsuario(usuId);
  if (!usuario) throw new ApiError(404, 'Usuario no encontrado');
  return repo.calcularImpacto(usuId);
}

/**
 * Borrado permanente.
 *
 * Tres cerraduras, todas en el servidor:
 *   1. permiso usuarios.eliminar;
 *   2. hay que escribir el nombre exacto del usuario (el modal no basta: si la
 *      comprobacion vive en el navegador, se la salta cualquiera);
 *   3. si algo lo referencia sin cascada, no se borra y se dice que es.
 */
export async function eliminar(
  actor: AuthUser,
  usuId: number,
  confirmacion: string,
): Promise<repo.ImpactoEliminacion> {
  if (usuId === actor.usuario.usu_id) {
    throw new ApiError(409, 'No puedes eliminarte a ti mismo');
  }

  const usuario = await repo.obtenerUsuario(usuId);
  if (!usuario) throw new ApiError(404, 'Usuario no encontrado');

  if (confirmacion.trim().toLowerCase() !== usuario.usu_nombre.trim().toLowerCase()) {
    throw new ApiError(400, 'El nombre escrito no coincide con el del usuario');
  }

  await exigirQueNoSeQuedeSinPropietario(usuId);

  const impactoPrevio = await repo.calcularImpacto(usuId);
  if (!impactoPrevio.puedeEliminar) {
    throw new ApiError(
      409,
      'No se puede eliminar: tiene historial que otras filas referencian. Usa la baja para desactivarlo.',
      impactoPrevio.bloqueos,
    );
  }

  await enTransaccion(async (client) => {
    // La auditoria se escribe antes del DELETE: la FK del actor no estorba
    // (es ON DELETE SET NULL) y asi el detalle queda dentro de la transaccion.
    await auditar(
      {
        actor,
        accion: 'eliminar',
        entidad: 'usuario',
        entidadId: usuId,
        detalle: {
          nombre: usuario.usu_nombre,
          correo: usuario.usu_correo,
          eliminado: impactoPrevio.eliminables,
        },
      },
      client,
    );
    await repo.eliminarUsuario(client, usuId);
  });

  await borrarFoto(usuario.usu_foto);

  if (usuario.auth_user_id) {
    try {
      await getSupabaseAdmin().auth.admin.deleteUser(usuario.auth_user_id);
    } catch (err) {
      // La fila ya no existe; dejar la cuenta de Auth viva solo impediria
      // reutilizar ese correo. Se registra para poder limpiarlo a mano.
      console.error(
        `Usuario ${usuId} eliminado, pero su cuenta de Auth (${usuario.auth_user_id}) sigue viva:`,
        err,
      );
    }
  }

  return impactoPrevio;
}

export async function catalogoRoles(): Promise<
  Array<{ rol_id: number; rol_nombre: string; rol_titulo: string; rol_descripcion: string | null }>
> {
  return repo.listarRoles();
}

export { ROLES_GLOBALES };
