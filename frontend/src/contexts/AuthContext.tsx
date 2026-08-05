import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { api, ApiError } from '@/lib/api';

/**
 * Autenticacion contra Supabase Auth + backend PVCAR.
 *
 * Lo que cambio respecto al sistema viejo:
 *   - La contrasena ya no se compara en el navegador contra usu_contrasena en
 *     texto plano. La valida Supabase Auth (bcrypt) via POST /auth/login.
 *   - Ya no hay blob de sesion en localStorage con el usuario y sus permisos
 *     dentro. Quien guarda la sesion es supabase-js (y solo los tokens); el
 *     usuario y los permisos se piden a GET /me en cada arranque. Antes se
 *     podian editar a mano en el navegador y el frontend los creia.
 *   - Los datos ya no salen de supabase.from(...): salen del API.
 *
 * El contrato del contexto se mantiene (user, permissions, permissionMap,
 * hasPermission, ...) para no tocar los 39 archivos que lo consumen.
 */

export interface Rol {
  rol_id: number;
  rol_nombre: string;
  rol_titulo: string;
  rol_descripcion: string | null;
}

export interface Permiso {
  modulo: string;
  accion: string;
}

/** Usuario de dominio tal como lo devuelve GET /me. Sin contrasena. */
export interface UserWithRoles {
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

type PermissionMap = {
  [modulo: string]: {
    ver?: boolean;
    crear?: boolean;
    editar?: boolean;
    eliminar?: boolean;
  };
};

interface LoginResponse {
  session: { access_token: string; refresh_token: string };
  usuario: UserWithRoles;
}

interface AuthContextType {
  user: UserWithRoles | null;
  loading: boolean;
  permissions: string[];
  permissionMap: PermissionMap;
  hasPermission: (modulo: string, accion?: string) => boolean;
  reloadPermissions: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
  /** Manda el correo con el enlace de recuperacion. No revela si existe. */
  requestPasswordReset: (email: string) => Promise<boolean>;
  /** Fija la contrasena con la sesion de recuperacion activa (pantalla del enlace). */
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  /** Cambia la contrasena desde el perfil, exigiendo la actual. */
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<UserWithRoles | null>(null);
  const [loading, setLoading] = useState(true);

  // Espejo de user para que los callbacks no dependan del estado y conserven
  // su identidad entre renders: ProtectedRoute tiene checkSession en las deps
  // de un useEffect, y una identidad nueva por render lo haria girar en vacio.
  const userRef = useRef<UserWithRoles | null>(null);
  userRef.current = user;

  // Promesa del arranque. checkSession la espera para no concluir "no hay
  // sesion" mientras el primer GET /me todavia esta en vuelo.
  const bootstrapRef = useRef<Promise<void> | null>(null);

  /**
   * Trae usuario + roles + permisos del backend.
   * Distingue fallo definitivo de fallo pasajero, y eso importa: cerrarle la
   * sesion a alguien porque se le cayo el wifi un segundo es justo el bug que
   * el sistema viejo trataba de evitar con reintentos a mano.
   *   401 — apiFetch ya cerro la sesion. Se limpia el usuario.
   *   403 — inactivo o sin enlazar en Auth. Se cierra sesion explicitamente.
   *   red — un reintento; si vuelve a fallar se deja el usuario como estaba.
   */
  const loadMe = useCallback(async (reintento = false): Promise<UserWithRoles | null> => {
    try {
      const me = await api.get<UserWithRoles>('/me');
      setUser(me);
      return me;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          await supabase.auth.signOut();
        }
        setUser(null);
        return null;
      }
      if (!reintento) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return loadMe(true);
      }
      // Fallo de red persistente: no se toca la sesion.
      console.error('No se pudo cargar /me:', err);
      return userRef.current;
    }
  }, []);

  useEffect(() => {
    const bootstrap = (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        await loadMe();
      }
      setLoading(false);
    })();

    bootstrapRef.current = bootstrap;

    // Sin await dentro del callback: supabase-js lo llama con su lock tomado
    // y esperar ahi puede trabar al cliente.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadMe]);

  const permissionMap = useMemo<PermissionMap>(() => {
    const map: PermissionMap = {};
    for (const { modulo, accion } of user?.permisos ?? []) {
      map[modulo] ??= {};
      map[modulo][accion as keyof PermissionMap[string]] = true;
    }
    return map;
  }, [user]);

  // Array legado: solo los modulos con accion 'ver'.
  const permissions = useMemo<string[]>(
    () =>
      Array.from(
        new Set((user?.permisos ?? []).filter((p) => p.accion === 'ver').map((p) => p.modulo)),
      ),
    [user],
  );

  const hasPermission = useCallback(
    (modulo: string, accion: string = 'ver') =>
      permissionMap[modulo]?.[accion as keyof PermissionMap[string]] === true,
    [permissionMap],
  );

  const reloadPermissions = useCallback(async (): Promise<void> => {
    await loadMe();
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string): Promise<{ error: Error | null }> => {
      try {
        // signOutOn401: false — aqui un 401 es "credenciales malas", no
        // "sesion expirada", y no debe borrar la sesion de nadie.
        const { session, usuario } = await api.post<LoginResponse>(
          '/auth/login',
          { email, password },
          { signOutOn401: false },
        );

        // La sesion se instala en supabase-js para que el refresh del token
        // corra por su cuenta. El backend no reimplementa eso.
        const { error } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        if (error) {
          return { error: new Error('No se pudo guardar la sesion en este navegador') };
        }

        setUser(usuario);
        return { error: null };
      } catch (err) {
        if (err instanceof ApiError) {
          return { error: new Error(err.message) };
        }
        return { error: new Error('No se pudo conectar con el servidor') };
      }
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      // Revoca los refresh tokens en el servidor. Si falla, la sesion local
      // se cierra igual: nunca se deja al usuario dentro por un error de red.
      await api.post('/auth/logout');
    } catch (err) {
      console.error('No se pudo revocar la sesion en el servidor:', err);
    }
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const checkSession = useCallback(async (): Promise<boolean> => {
    if (bootstrapRef.current) {
      await bootstrapRef.current;
    }
    if (userRef.current) {
      return true;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return false;
    }
    return (await loadMe()) !== null;
  }, [loadMe]);

  const requestPasswordReset = useCallback(async (email: string): Promise<boolean> => {
    try {
      await api.post('/auth/forgot-password', { email });
      return true;
    } catch (err) {
      console.error('Fallo la solicitud de recuperacion:', err);
      return false;
    }
  }, []);

  const updatePassword = useCallback(
    async (newPassword: string): Promise<{ error: Error | null }> => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return { error: error ? new Error(error.message) : null };
    },
    [],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<{ error: Error | null }> => {
      try {
        await api.post('/auth/change-password', { currentPassword, newPassword });
        return { error: null };
      } catch (err) {
        if (err instanceof ApiError) {
          return { error: new Error(err.message) };
        }
        return { error: new Error('No se pudo conectar con el servidor') };
      }
    },
    [],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      permissions,
      permissionMap,
      hasPermission,
      reloadPermissions,
      login,
      logout,
      checkSession,
      requestPasswordReset,
      updatePassword,
      changePassword,
    }),
    [
      user,
      loading,
      permissions,
      permissionMap,
      hasPermission,
      reloadPermissions,
      login,
      logout,
      checkSession,
      requestPasswordReset,
      updatePassword,
      changePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
