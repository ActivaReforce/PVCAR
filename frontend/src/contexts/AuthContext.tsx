import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

const SESSION_STORAGE_KEY = 'activa_reforce_session';

type Usuario = Database['public']['Tables']['usuario']['Row'];
type Rol = Database['public']['Tables']['rol']['Row'];

interface UserWithRoles extends Usuario {
  roles: Rol[];
}

type PermissionRow = {
  modulo: string;
  accion: string;
};

type PermissionMap = {
  [modulo: string]: {
    ver?: boolean;
    crear?: boolean;
    editar?: boolean;
    eliminar?: boolean;
  };
};

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
  resetPassword: (email: string, newPassword: string) => Promise<boolean>;
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
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionMap, setPermissionMap] = useState<PermissionMap>({});

  // Save session to localStorage
  const saveSession = (userData: UserWithRoles, perms: string[], permMap: PermissionMap) => {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        user: userData,
        permissions: perms,
        permissionMap: permMap,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  // Clear session from localStorage
  const clearSession = () => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  };

  // Load session from localStorage
  const loadStoredSession = () => {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  };

  const loadPermissionsForRoles = async (roleIds: number[]) => {
    if (!roleIds || roleIds.length === 0) {
      setPermissions([]);
      setPermissionMap({});
      return;
    }

    const { data, error } = await supabase
      .from('rol_permiso')
      .select('modulo, accion')
      .in('rol_id', roleIds);

    if (error) {
      setPermissions([]);
      setPermissionMap({});
      return;
    }

    const permissionRows = data as PermissionRow[];
    
    // Build permission map for granular access
    const newPermissionMap: PermissionMap = {};
    permissionRows.forEach(({ modulo, accion }) => {
      if (!newPermissionMap[modulo]) {
        newPermissionMap[modulo] = {};
      }
      newPermissionMap[modulo][accion as keyof PermissionMap[string]] = true;
    });

    // Keep legacy permissions array for backward compatibility (only 'ver' actions)
    const legacyPermissions = Array.from(
      new Set(
        permissionRows
          .filter(p => p.accion === 'ver')
          .map(p => p.modulo)
      )
    );

    setPermissions(legacyPermissions);
    setPermissionMap(newPermissionMap);
  };

  const loadUserWithRoles = async (email: string): Promise<UserWithRoles | null> => {
    try {
      // Get user by email
      const { data: userData, error: userError } = await supabase
        .from('usuario')
        .select('*')
        .eq('usu_correo', email)
        .maybeSingle();

      if (userError || !userData) {
        return null;
      }

      // Get user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('usuario_rol')
        .select(`
          rol:rol_id (
            rol_id,
            rol_nombre,
            rol_titulo,
            rol_descripcion
          )
        `)
        .eq('usu_id', userData.usu_id);

      if (rolesError) {
        return null;
      }

      // Extract roles from the nested structure
      const roles = (userRoles || [])
        .map((ur: any) => ur.rol)
        .filter(Boolean) as Rol[];

      return {
        ...userData,
        roles
      };
    } catch (error) {
      return null;
    }
  };

  const reloadPermissions = async (): Promise<void> => {
    const roleIds = user?.roles?.map((r) => r.rol_id) ?? [];
    await loadPermissionsForRoles(roleIds);
  };

  const login = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      setLoading(true);

      // First verify credentials exist in our usuario table
      const { data: userData, error: userError } = await supabase
        .from('usuario')
        .select('usu_id, usu_correo, usu_contrasena, est_id')
        .eq('usu_correo', email)
        .eq('usu_contrasena', password)
        .maybeSingle();

      if (userError) {
        return { error: new Error('Error al conectar con el servidor') };
      }

      if (!userData) {
        return { error: new Error('Correo o contraseña incorrectos') };
      }

      // Validate that user is active (est_id === 1)
      if (userData.est_id !== 1) {
        return { error: new Error('Usuario inactivo o no autorizado') };
      }

      // If credentials are valid and user is active, load user with roles
      const userWithRoles = await loadUserWithRoles(email);
      if (!userWithRoles) {
        return { error: new Error('Error al cargar la información del usuario') };
      }

      setUser(userWithRoles);
      // Load permissions from rol_permiso
      await loadPermissionsForRoles(userWithRoles.roles.map((r) => r.rol_id));

      // Persist session to localStorage
      const roleIds = userWithRoles.roles.map((r) => r.rol_id);
      const { data: permData } = await supabase
        .from('rol_permiso')
        .select('modulo, accion')
        .in('rol_id', roleIds);

      if (permData) {
        const permissionRows = permData as PermissionRow[];
        const newPermissionMap: PermissionMap = {};
        permissionRows.forEach(({ modulo, accion }) => {
          if (!newPermissionMap[modulo]) {
            newPermissionMap[modulo] = {};
          }
          newPermissionMap[modulo][accion as keyof PermissionMap[string]] = true;
        });
        const legacyPermissions = Array.from(
          new Set(
            permissionRows
              .filter(p => p.accion === 'ver')
              .map(p => p.modulo)
          )
        );
        saveSession(userWithRoles, legacyPermissions, newPermissionMap);
      }

      return { error: null };
    } catch (error) {
      return { error: new Error('Error durante el inicio de sesión') };
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setUser(null);
    setPermissions([]);
    setPermissionMap({});
    clearSession();
  };

  const checkSession = async (): Promise<boolean> => {
    // Check in-memory state first
    if (user !== null) return true;

    // Try to restore from localStorage
    const stored = loadStoredSession();
    if (!stored) return false;

    // Helper function to validate with retry logic
    const validateUser = async (retryCount = 0): Promise<{ valid: boolean; definitive: boolean }> => {
      try {
        const { data: userData, error } = await supabase
          .from('usuario')
          .select('usu_id, est_id')
          .eq('usu_id', stored.user.usu_id)
          .maybeSingle();

        // If we got data, check if user is active
        if (userData) {
          return { valid: userData.est_id === 1, definitive: true };
        }

        // If no data and no error, user doesn't exist (definitive)
        if (!error) {
          return { valid: false, definitive: true };
        }

        // If there's an error, it might be transient
        // Retry once on network/temporary errors
        if (retryCount < 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
          return validateUser(retryCount + 1);
        }

        // After retry, assume transient error - keep session but return false
        return { valid: false, definitive: false };
      } catch (error) {
        // Network or unexpected error - retry once
        if (retryCount < 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
          return validateUser(retryCount + 1);
        }
        // After retry, assume transient - keep session
        return { valid: false, definitive: false };
      }
    };

    const { valid, definitive } = await validateUser();

    // Only clear session if we definitively know the user is invalid
    if (!valid && definitive) {
      clearSession();
      return false;
    }

    // If validation passed, restore session to state
    if (valid) {
      setUser(stored.user);
      setPermissions(stored.permissions || []);
      setPermissionMap(stored.permissionMap || {});
      return true;
    }

    // If transient error, keep session in localStorage but return false
    // This prevents logout but allows retry on next navigation
    return false;
  };

  const resetPassword = async (email: string, newPassword: string): Promise<boolean> => {
    try {
      // Verify user exists
      const { data: userData, error: userError } = await supabase
        .from('usuario')
        .select('usu_id')
        .eq('usu_correo', email)
        .maybeSingle();

      if (userError || !userData) {
        return false;
      }

      // Update password
      const { error: updateError } = await supabase
        .from('usuario')
        .update({ 
          usu_contrasena: newPassword,
          usu_fecha_modificacion: new Date().toISOString()
        })
        .eq('usu_correo', email);

      if (updateError) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      const stored = loadStoredSession();
      if (stored) {
        // Validate user is still active with retry logic
        const validateWithRetry = async (retryCount = 0): Promise<boolean> => {
          try {
            const { data: userData, error } = await supabase
              .from('usuario')
              .select('usu_id, est_id')
              .eq('usu_id', stored.user.usu_id)
              .maybeSingle();

            // Successfully retrieved data
            if (userData) {
              return userData.est_id === 1;
            }

            // No data and no error means user doesn't exist
            if (!error) {
              return false;
            }

            // Error occurred - retry once if this is first attempt
            if (retryCount < 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
              return validateWithRetry(retryCount + 1);
            }

            // After retry, assume transient error - restore session anyway
            return true;
          } catch (error) {
            // Network error - retry once
            if (retryCount < 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
              return validateWithRetry(retryCount + 1);
            }
            // After retry, restore session to prevent unnecessary logout
            return true;
          }
        };

        const isValid = await validateWithRetry();
        
        if (isValid) {
          setUser(stored.user);
          setPermissions(stored.permissions || []);
          setPermissionMap(stored.permissionMap || {});
        } else {
          // Only clear if definitively invalid
          clearSession();
        }
      }
      setLoading(false);
    };

    restoreSession();
  }, []);

  // Enhanced hasPermission function with optional action parameter
  const hasPermission = (modulo: string, accion: string = 'ver') => {
    return permissionMap[modulo]?.[accion as keyof PermissionMap[string]] === true;
  };

  const value: AuthContextType = {
    user,
    loading,
    permissions,
    permissionMap,
    hasPermission,
    reloadPermissions,
    login,
    logout,
    checkSession,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
