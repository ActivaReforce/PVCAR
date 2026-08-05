import { frontendBaseUrl } from '../../config/env.js';
import { getSupabaseAdmin, getSupabaseAnon } from '../../config/supabase.js';
import { ApiError } from '../../middleware/error.js';
import { findUsuarioByAuthUserId, findUsuarioByCorreo, type UsuarioConRoles } from './auth.repository.js';

/** Lo que el navegador necesita para instalar la sesion con supabase-js. */
export interface SessionPayload {
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
  expires_in: number | null;
  token_type: string;
}

export interface LoginResult {
  session: SessionPayload;
  usuario: UsuarioConRoles;
}

/**
 * Revoca una sesion de Supabase Auth. Best-effort: si falla no se le cuenta
 * al usuario, pero hay que intentarlo siempre que se cree una sesion que no
 * se va a entregar (login rechazado, verificacion de contrasena actual).
 * Sin esto cada rechazo deja un refresh token vivo.
 */
async function revocarSesion(accessToken: string, scope: 'global' | 'local' = 'local'): Promise<void> {
  try {
    await getSupabaseAdmin().auth.admin.signOut(accessToken, scope);
  } catch (err) {
    console.error('No se pudo revocar la sesion de Supabase Auth:', err);
  }
}

/**
 * Login contra Supabase Auth con el gate de dominio incluido.
 *
 * Por que el login pasa por el backend y no directo por supabase-js:
 *   1. Un usuario inactivo nunca recibe token. Si el navegador hiciera el
 *      signIn el token ya existiria y solo despues /me diria 403.
 *   2. Una sola ida y vuelta devuelve sesion + usuario + permisos. Desde
 *      Ecuador cada viaje cuesta ~82 ms; dos llamadas secuenciales se notan.
 * El refresh SI lo maneja supabase-js en el navegador: se le pasa la sesion
 * con setSession() y el cliente renueva solo. El backend no mejoraria eso.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const { data, error } = await getSupabaseAnon().auth.signInWithPassword({ email, password });

  // Mismo mensaje para "no existe" y "contrasena mala": no se enumera.
  if (error || !data.session || !data.user) {
    throw new ApiError(401, 'Correo o contrasena incorrectos');
  }

  const usuario = await findUsuarioByAuthUserId(data.user.id);

  if (!usuario) {
    await revocarSesion(data.session.access_token);
    throw new ApiError(403, 'La cuenta no esta enlazada a ningun usuario del sistema');
  }
  if (usuario.est_id !== 1) {
    await revocarSesion(data.session.access_token);
    throw new ApiError(403, 'Usuario inactivo o no autorizado');
  }

  return {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at ?? null,
      expires_in: data.session.expires_in ?? null,
      token_type: data.session.token_type,
    },
    usuario,
  };
}

/**
 * Cierra la sesion del token que llega. Scope 'global': mata todos los
 * refresh tokens del usuario, no solo este. Es lo que se quiere en un logout
 * explicito — si alguien deja la sesion abierta en un equipo compartido, el
 * boton de salir debe servir de algo.
 */
export async function logout(accessToken: string): Promise<void> {
  await revocarSesion(accessToken, 'global');
}

/**
 * Dispara el correo de recuperacion de contrasena.
 *
 * No dice nunca si el correo existe: responde igual para un correo real, uno
 * inventado y uno de usuario inactivo. Es el endpoint mas expuesto del sistema
 * (publico, sin token) y filtrar la lista de correos del colegio seria regalar
 * material para phishing.
 *
 * Los inactivos no reciben nada: no tienen cuenta en Auth (ver Anexo A).
 */
export async function forgotPassword(email: string): Promise<void> {
  const usuario = await findUsuarioByCorreo(email);

  if (!usuario || usuario.est_id !== 1 || !usuario.auth_user_id) {
    return;
  }

  const { error } = await getSupabaseAnon().auth.resetPasswordForEmail(email, {
    redirectTo: `${frontendBaseUrl}/reset-password`,
  });

  // Se registra pero no se propaga: el que pide el reset no debe distinguir
  // "no te mande nada porque no existes" de "fallo el envio".
  if (error) {
    console.error('Fallo el envio del correo de recuperacion:', error.message);
  }
}

/**
 * Cambia la contrasena de un usuario ya autenticado, exigiendo la actual.
 *
 * supabase-js podria hacerlo solo con updateUser({ password }) desde el
 * navegador, pero eso NO pide la contrasena actual: con la sesion abierta en
 * un equipo ajeno cualquiera se apropiaria de la cuenta. Aqui se reautentica
 * primero, y la sesion que nace de esa verificacion se revoca en el acto.
 */
export async function changePassword(
  authUserId: string,
  correo: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const { data, error } = await getSupabaseAnon().auth.signInWithPassword({
    email: correo,
    password: currentPassword,
  });

  if (error || !data.session) {
    throw new ApiError(400, 'La contrasena actual no es correcta');
  }

  await revocarSesion(data.session.access_token);

  const { error: updateError } = await getSupabaseAdmin().auth.admin.updateUserById(authUserId, {
    password: newPassword,
  });

  if (updateError) {
    throw new ApiError(400, updateError.message);
  }
}
