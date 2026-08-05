import { getPool } from '../../config/db.js';

/** Fila de public.rol tal como la consume el frontend. */
export interface Rol {
  rol_id: number;
  rol_nombre: string;
  rol_titulo: string;
  rol_descripcion: string | null;
}

/** Permiso efectivo del usuario: la union de los permisos de todos sus roles. */
export interface Permiso {
  modulo: string;
  accion: string;
}

/**
 * Usuario de dominio + roles + permisos efectivos.
 * Los nombres de campo son los de public.usuario a proposito: el frontend
 * ya los consume asi en 39 archivos y renombrarlos no aporta nada.
 * usu_contrasena no existe: las contrasenas viven en auth.users (bcrypt).
 */
export interface UsuarioConRoles {
  usu_id: number;
  auth_user_id: string | null;
  usu_nombre: string;
  usu_correo: string;
  usu_foto: string | null;
  usu_telefono: string | null;
  usu_fecha_creacion: string | null;
  usu_fecha_modificacion: string | null;
  est_id: number;
  roles: Rol[];
  permisos: Permiso[];
}

/**
 * Una sola consulta trae usuario, roles y permisos. Importa: cada request
 * autenticado pasa por aqui, y Railway (us-east4) a Supabase (us-east-2)
 * cuesta ~12 ms por viaje. Tres consultas serian tres viajes.
 *
 * json_agg(DISTINCT jsonb_build_object(...)) y no json_build_object: json no
 * tiene operador de igualdad, jsonb si, y sin DISTINCT un permiso repetido en
 * dos roles del mismo usuario saldria duplicado.
 */
const SELECT_USUARIO = `
  SELECT
      u.usu_id,
      u.auth_user_id,
      u.usu_nombre,
      u.usu_correo,
      u.usu_foto,
      u.usu_telefono,
      u.usu_fecha_creacion,
      u.usu_fecha_modificacion,
      u.est_id,
      COALESCE(r.roles, '[]'::json)     AS roles,
      COALESCE(p.permisos, '[]'::json)  AS permisos
  FROM public.usuario u
  LEFT JOIN LATERAL (
      SELECT json_agg(
                 jsonb_build_object(
                     'rol_id',          rol.rol_id,
                     'rol_nombre',      rol.rol_nombre,
                     'rol_titulo',      rol.rol_titulo,
                     'rol_descripcion', rol.rol_descripcion
                 ) ORDER BY rol.rol_id
             ) AS roles
      FROM public.usuario_rol ur
      JOIN public.rol rol ON rol.rol_id = ur.rol_id
      WHERE ur.usu_id = u.usu_id
  ) r ON TRUE
  LEFT JOIN LATERAL (
      SELECT json_agg(
                 DISTINCT jsonb_build_object('modulo', rp.modulo, 'accion', rp.accion)
             ) AS permisos
      FROM public.usuario_rol ur
      JOIN public.rol_permiso rp ON rp.rol_id = ur.rol_id
      WHERE ur.usu_id = u.usu_id
  ) p ON TRUE
`;

/** Resuelve el usuario de dominio a partir del id de auth.users. */
export async function findUsuarioByAuthUserId(
  authUserId: string,
): Promise<UsuarioConRoles | null> {
  const { rows } = await getPool().query<UsuarioConRoles>(
    `${SELECT_USUARIO} WHERE u.auth_user_id = $1`,
    [authUserId],
  );
  return rows[0] ?? null;
}

/**
 * Resuelve el usuario por correo, normalizado igual que el indice unico de
 * la tabla: lower(trim(...)). Supabase Auth guarda el correo en minusculas,
 * asi que sin normalizar 'Juan@x.com' no encuentra a 'juan@x.com'.
 */
export async function findUsuarioByCorreo(correo: string): Promise<UsuarioConRoles | null> {
  const { rows } = await getPool().query<UsuarioConRoles>(
    `${SELECT_USUARIO} WHERE lower(trim(u.usu_correo)) = lower(trim($1))`,
    [correo],
  );
  return rows[0] ?? null;
}
