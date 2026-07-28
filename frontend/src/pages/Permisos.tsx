
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MODULES, MODULE_LABELS } from '@/constants/modules';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type Rol = {
  rol_id: number;
  rol_titulo: string;
};

type PermRow = {
  modulo: string;
  accion: string;
};

type ModulePermissions = {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
};

const ACTIONS = ['ver', 'crear', 'editar', 'eliminar'] as const;
const ACTION_LABELS = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar'
};

// Define which actions are applicable per module
const MODULE_ACTIONS: Record<string, string[]> = {
  dashboard: ['ver'],
  usuarios: ['ver', 'crear', 'editar', 'eliminar'],
  colegios: ['ver', 'crear', 'editar', 'eliminar'],
  actividades: ['ver', 'crear', 'editar', 'eliminar'],
  disciplinas: ['ver', 'crear', 'editar', 'eliminar'],
  entrenadores: ['ver', 'editar'],
  estudiantes: ['ver', 'crear', 'editar', 'eliminar'],
  evaluaciones: ['ver', 'crear', 'editar', 'eliminar'],
  asistencias_estudiantes: ['ver'],
  asistencias_entrenadores: ['ver'],
  encuestas: ['ver'],
  reportes: ['ver', 'crear'],
  perfil: ['ver'],
  permisos: ['ver']
};

const Permisos: React.FC = () => {
  const { toast } = useToast();
  const { reloadPermissions, user } = useAuth();
  const [selectedRole, setSelectedRole] = React.useState<string>('');
  const [modulePermissions, setModulePermissions] = React.useState<Record<string, ModulePermissions>>({});
  const [isSaving, setIsSaving] = React.useState(false);

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rol')
        .select('rol_id, rol_titulo')
        .order('rol_id', { ascending: true });
      if (error) throw error;
      return data as Rol[];
    },
  });

  const permissionsQuery = useQuery({
    queryKey: ['rol_permiso', selectedRole],
    queryFn: async () => {
      if (!selectedRole) return [] as PermRow[];
      const { data, error } = await supabase
        .from('rol_permiso')
        .select('modulo, accion')
        .eq('rol_id', Number(selectedRole));
      if (error) throw error;
      return data as PermRow[];
    },
    enabled: !!selectedRole,
  });

  React.useEffect(() => {
    if (permissionsQuery.data) {
      const newModulePermissions: Record<string, ModulePermissions> = {};
      
      // Initialize all modules with false permissions
      MODULES.forEach(module => {
        newModulePermissions[module] = {
          ver: false,
          crear: false,
          editar: false,
          eliminar: false
        };
      });

      // Set actual permissions from database
      permissionsQuery.data.forEach(p => {
        if (newModulePermissions[p.modulo]) {
          newModulePermissions[p.modulo][p.accion as keyof ModulePermissions] = true;
        }
      });

      setModulePermissions(newModulePermissions);
    }
  }, [permissionsQuery.data]);

  const togglePermission = (module: string, action: string) => {
    // Don't allow toggling "ver" for role_id = 1 on "permisos" module
    if (selectedRole === '1' && module === 'permisos' && action === 'ver') {
      return;
    }

    setModulePermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module]?.[action as keyof ModulePermissions]
      }
    }));
  };

  const handleSave = async () => {
    if (!selectedRole) {
      toast({ title: 'Selecciona un rol', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const actorId = user?.usu_id;
      if (!actorId) {
        throw new Error('Usuario no autenticado');
      }

      // Build arrays for each action type
      const enableModules: Record<string, string[]> = {
        ver: [],
        crear: [],
        editar: [],
        eliminar: []
      };

      const disableModules: Record<string, string[]> = {
        ver: [],
        crear: [],
        editar: [],
        eliminar: []
      };

      MODULES.forEach(module => {
        const availableActions = MODULE_ACTIONS[module] || ['ver'];
        
        availableActions.forEach(action => {
          const hasPermission = modulePermissions[module]?.[action as keyof ModulePermissions];
          
          if (hasPermission) {
            enableModules[action].push(module);
          } else {
            disableModules[action].push(module);
          }
        });
      });

      // Update permissions for each action type
      for (const action of ACTIONS) {
        if (enableModules[action].length > 0 || disableModules[action].length > 0) {
          const { error } = await (supabase as any).rpc('set_role_permissions', {
            p_actor_usu_id: actorId,
            p_target_rol_id: Number(selectedRole),
            p_enable_modules: enableModules[action],
            p_disable_modules: disableModules[action],
            p_action: action,
          });

          if (error) throw error;
        }
      }

      await permissionsQuery.refetch();

      // If the current user has the edited role, reload their permissions
      const currentRoleIds = user?.roles?.map(r => r.rol_id) ?? [];
      if (currentRoleIds.includes(Number(selectedRole))) {
        await reloadPermissions();
      }

      toast({ title: 'Permisos actualizados' });
    } catch (e: any) {
      console.error('No se pudieron guardar los permisos:', e);
      toast({
        title: 'No se pudieron guardar los cambios',
        description: e?.message || 'Error al guardar los permisos',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to check if a permission should be disabled
  const isPermissionDisabled = (module: string, action: string) => {
    return selectedRole === '1' && module === 'permisos' && action === 'ver';
  };

  // Helper function to ensure certain permissions are always on for role_id = 1
  const getPermissionValue = (module: string, action: string) => {
    if (selectedRole === '1' && module === 'permisos' && action === 'ver') {
      return true;
    }
    return !!modulePermissions[module]?.[action as keyof ModulePermissions];
  };

  return (
    <div className="container mx-auto p-4 lg:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
            Permisos
          </h1>
          <p className="text-muted-foreground">
            Gestiona qué acciones puede realizar cada rol en cada módulo del sistema.
          </p>
        </div>
      </div>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Label className="text-sm">Rol</Label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Selecciona un rol" />
            </SelectTrigger>
            <SelectContent>
              {rolesQuery.data?.map((r) => (
                <SelectItem key={r.rol_id} value={String(r.rol_id)}>
                  {r.rol_id} — {r.rol_titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRole && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 px-2">Módulo</th>
                  {ACTIONS.map(action => (
                    <th key={action} className="py-2 px-2 w-20 text-center">
                      {ACTION_LABELS[action]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((module) => {
                  const availableActions = MODULE_ACTIONS[module] || ['ver'];
                  
                  return (
                    <tr key={module} className="border-t">
                      <td className="py-2 px-2">{MODULE_LABELS[module]}</td>
                      {ACTIONS.map(action => (
                        <td key={action} className="py-2 px-2 text-center">
                          {availableActions.includes(action) ? (
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={getPermissionValue(module, action)}
                                onCheckedChange={() => togglePermission(module, action)}
                                id={`${module}-${action}`}
                                disabled={isPermissionDisabled(module, action)}
                                className={isPermissionDisabled(module, action) ? 'opacity-50' : ''}
                              />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Permisos;
