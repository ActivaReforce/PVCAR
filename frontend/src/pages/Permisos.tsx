import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MODULE_LABELS, type Module } from '@/constants/modules';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { permisosApi, type Permiso } from '@/api/permisos';

/**
 * Matriz de permisos.
 *
 * Antes esto llamaba a la RPC set_role_permissions una vez por accion (cuatro
 * llamadas por guardado) desde el navegador, con el id del actor viajando como
 * parametro — o sea, el propio cliente decia quien era. Ahora es un PUT por
 * rol; quien manda sale del token y el backend comprueba que sea Propietario o
 * Admin.
 *
 * Los modulos y las acciones tambien vienen del servidor: son el mismo
 * catalogo que valida la escritura, asi que no pueden separarse.
 */

const ACTION_LABELS: Record<string, string> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
};

/** Que acciones tienen sentido en cada modulo. Lo demas se pinta como raya. */
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
  reporte_estudiante: ['ver'],
  perfil: ['ver'],
  permisos: ['ver'],
};

const ROL_PROPIETARIO = 1;

const clave = (modulo: string, accion: string) => `${modulo}:${accion}`;

const Permisos: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { reloadPermissions, user } = useAuth();
  const [selectedRole, setSelectedRole] = React.useState<string>('');
  const [marcados, setMarcados] = React.useState<Set<string>>(new Set());

  const matriz = useQuery({
    queryKey: ['permisos', 'matriz'],
    queryFn: () => permisosApi.matriz(),
  });

  const rolSeleccionado = matriz.data?.roles.find((r) => String(r.rol_id) === selectedRole);

  // Al cambiar de rol se parte de lo que tiene guardado, no de lo que quedara
  // marcado del rol anterior.
  React.useEffect(() => {
    if (!rolSeleccionado) {
      setMarcados(new Set());
      return;
    }
    setMarcados(new Set(rolSeleccionado.permisos.map((p) => clave(p.modulo, p.accion))));
  }, [rolSeleccionado]);

  const guardar = useMutation({
    mutationFn: async () => {
      const permisos: Permiso[] = [...marcados].map((k) => {
        const [modulo, accion] = k.split(':');
        return { modulo: modulo as string, accion: accion as string };
      });
      return permisosApi.guardar(Number(selectedRole), permisos);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['permisos'] });
      // Si el rol tocado es uno de los mios, mis permisos cambian ahora mismo.
      if (user?.roles?.some((r) => r.rol_id === Number(selectedRole))) {
        await reloadPermissions();
      }
      toast({ title: 'Permisos actualizados' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'No se pudieron guardar los cambios',
        description: error instanceof Error ? error.message : 'Error al guardar los permisos',
        variant: 'destructive',
      });
    },
  });

  const bloqueado = (modulo: string, accion: string) =>
    selectedRole === String(ROL_PROPIETARIO) && modulo === 'permisos' && accion === 'ver';

  const activo = (modulo: string, accion: string) =>
    bloqueado(modulo, accion) || marcados.has(clave(modulo, accion));

  const alternar = (modulo: string, accion: string) => {
    if (bloqueado(modulo, accion)) return;
    setMarcados((prev) => {
      const siguiente = new Set(prev);
      const k = clave(modulo, accion);
      if (siguiente.has(k)) siguiente.delete(k);
      else siguiente.add(k);
      return siguiente;
    });
  };

  const modulos = matriz.data?.modulos ?? [];
  const acciones = matriz.data?.acciones ?? ['ver', 'crear', 'editar', 'eliminar'];

  return (
    <div className="container mx-auto p-4 lg:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Permisos</h1>
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
              {matriz.data?.roles.map((r) => (
                <SelectItem key={r.rol_id} value={String(r.rol_id)}>
                  {r.rol_id} — {r.rol_titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {matriz.isError && (
          <p className="text-sm text-destructive">
            No se pudo cargar la matriz: {(matriz.error as Error).message}
          </p>
        )}

        {selectedRole && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 px-2">Módulo</th>
                  {acciones.map((accion) => (
                    <th key={accion} className="py-2 px-2 w-20 text-center">
                      {ACTION_LABELS[accion] ?? accion}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modulos.map((modulo) => {
                  const disponibles = MODULE_ACTIONS[modulo] ?? ['ver'];
                  return (
                    <tr key={modulo} className="border-t">
                      <td className="py-2 px-2">
                        {MODULE_LABELS[modulo as Module] ?? modulo}
                      </td>
                      {acciones.map((accion) => (
                        <td key={accion} className="py-2 px-2 text-center">
                          {disponibles.includes(accion) ? (
                            <div className="flex items-center justify-center">
                              <Checkbox
                                id={`${modulo}-${accion}`}
                                checked={activo(modulo, accion)}
                                onCheckedChange={() => alternar(modulo, accion)}
                                disabled={bloqueado(modulo, accion)}
                                className={bloqueado(modulo, accion) ? 'opacity-50' : ''}
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
              <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
                {guardar.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Permisos;
