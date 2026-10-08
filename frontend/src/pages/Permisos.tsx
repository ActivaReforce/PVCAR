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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CircleAlert } from 'lucide-react';

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

type Accion = 'ver' | 'crear' | 'editar' | 'eliminar';

/**
 * Qué hace cada casilla, módulo por módulo. Es la fuente de las dos cosas: qué
 * casillas se pintan (las que no están salen como raya) y lo que explica el
 * icono junto al nombre. La tabla larga está en docs/permisos.md.
 */
const AYUDA: Record<string, { acciones: Partial<Record<Accion, string>>; nota?: string }> = {
  dashboard: { acciones: { ver: 'abrir el inicio.' } },
  usuarios: {
    acciones: {
      ver: 'lista y fichas.',
      crear: 'dar de alta.',
      editar: 'datos, roles, baja y reactivar.',
      eliminar: 'borrar del todo.',
    },
  },
  colegios: {
    acciones: {
      ver: 'lista y fichas.',
      crear: 'nuevo colegio.',
      editar: 'datos, foto y coordinadores.',
      eliminar: 'borrarlo.',
    },
  },
  actividades: {
    acciones: { ver: 'el catálogo.', crear: 'nueva.', editar: 'modificarla.', eliminar: 'borrarla.' },
  },
  disciplinas: {
    acciones: {
      ver: 'lista y horarios.',
      crear: 'nueva.',
      editar: 'horario, baja y reactivar.',
      eliminar: 'borrarla.',
    },
  },
  entrenadores: {
    acciones: { ver: 'lista y fichas.', editar: 'asignar disciplinas y auxiliares.' },
    nota: 'Se crean en Usuarios.',
  },
  estudiantes: {
    acciones: {
      ver: 'lista y fichas.',
      crear: 'nuevo alumno.',
      editar: 'datos, disciplinas, representantes y baja.',
      eliminar: 'borrarlo.',
    },
  },
  evaluaciones: {
    acciones: {
      ver: 'las plantillas.',
      crear: 'nueva plantilla.',
      editar: 'parámetros, disciplinas y baja.',
      eliminar: 'borrarla.',
    },
    nota: 'Una plantilla que usan otros colegios solo la cambian Propietario y Admin.',
  },
  calificaciones: {
    acciones: { ver: 'notas y pendientes.', editar: 'calificar o quitar la pendiente.' },
    nota: 'Necesita Ver en Evaluaciones.',
  },
  asistencias_estudiantes: {
    acciones: { ver: 'consultar listas e historial.', editar: 'pasar lista.' },
  },
  asistencias_entrenadores: {
    acciones: { ver: 'consultar listas.', editar: 'pasar lista.' },
  },
  encuestas: {
    acciones: {
      ver: 'lista y resultados de sus familias.',
      crear: 'nueva.',
      editar: 'preguntas, publicar y cerrar.',
      eliminar: 'borrarla.',
    },
  },
  inscripciones: {
    acciones: {
      ver: 'la lista (el representante, solo las suyas).',
      editar: 'aprobar, documentos y precios.',
      eliminar: 'rechazar.',
    },
    nota: 'Editar y Eliminar solo valen para Propietario y Admin.',
  },
  reportes: {
    acciones: { ver: 'reportes, gráficas y Data anterior.', crear: 'exportar a Excel.' },
  },
  perfil: { acciones: { ver: 'ver y editar el propio perfil.' } },
  permisos: {
    acciones: { ver: 'la matriz.', editar: 'guardarla.' },
    nota: 'Guardar exige además ser Propietario o Admin.',
  },
};

const disponiblesDe = (modulo: string): string[] =>
  Object.keys(AYUDA[modulo]?.acciones ?? { ver: '' });

/**
 * Reglas para que no se guarde algo sin sentido (las repite el backend):
 * crear, editar o eliminar arrastran el Ver del módulo, y quitar el Ver se
 * lleva el resto; calificar necesita ver las evaluaciones.
 */
const DEPENDE_DE: Record<string, string> = { calificaciones: 'evaluaciones' };

/** El "!" junto al nombre: se abre al pasar el ratón y, en el móvil, al tocar. */
const AyudaModulo = ({ modulo, nombre }: { modulo: string; nombre: string }) => {
  const [abierta, setAbierta] = React.useState(false);
  const ayuda = AYUDA[modulo];
  if (!ayuda) return null;
  return (
    <Popover open={abierta} onOpenChange={setAbierta}>
      <PopoverTrigger
        asChild
        // Solo el ratón: en el móvil el toque también "entra", y abriría y
        // cerraría a la vez. Allí lo abre el toque, como un botón.
        onPointerEnter={(e) => e.pointerType === 'mouse' && setAbierta(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setAbierta(false)}
      >
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Qué permite cada casilla en ${nombre}`}
        >
          <CircleAlert className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-72 space-y-1 p-3 text-xs">
        {(Object.entries(ayuda.acciones) as Array<[Accion, string]>).map(([accion, texto]) => (
          <p key={accion}>
            <span className="font-semibold">{ACTION_LABELS[accion]}:</span> {texto}
          </p>
        ))}
        {ayuda.nota && <p className="pt-1 text-muted-foreground">{ayuda.nota}</p>}
      </PopoverContent>
    </Popover>
  );
};

const ROL_PROPIETARIO = 1;

const clave = (modulo: string, accion: string) => `${modulo}:${accion}`;

const Permisos: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { reloadPermissions, user, hasPermission } = useAuth();
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

  const bloqueado = (modulo: string, _accion: string) =>
    selectedRole === String(ROL_PROPIETARIO) && modulo === 'permisos';

  const activo = (modulo: string, accion: string) =>
    bloqueado(modulo, accion) || marcados.has(clave(modulo, accion));

  const alternar = (modulo: string, accion: string) => {
    if (bloqueado(modulo, accion)) return;
    setMarcados((prev) => {
      const siguiente = new Set(prev);
      const quitar = (m: string) => disponiblesDe(m).forEach((a) => siguiente.delete(clave(m, a)));
      if (siguiente.has(clave(modulo, accion))) {
        siguiente.delete(clave(modulo, accion));
        if (accion === 'ver') {
          quitar(modulo);
          // Sin ver la base, lo que depende de ella tampoco sirve.
          Object.entries(DEPENDE_DE)
            .filter(([, base]) => base === modulo)
            .forEach(([dependiente]) => quitar(dependiente));
        }
      } else {
        siguiente.add(clave(modulo, accion));
        siguiente.add(clave(modulo, 'ver'));
        const base = DEPENDE_DE[modulo];
        if (base) siguiente.add(clave(base, 'ver'));
      }
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
                  {r.rol_titulo}
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
                  const disponibles = disponiblesDe(modulo);
                  const nombre = MODULE_LABELS[modulo as Module] ?? modulo;
                  return (
                    <tr key={modulo} className="border-t">
                      <td className="py-2 px-2">
                        <span className="inline-flex items-center gap-1">
                          {nombre}
                          <AyudaModulo modulo={modulo} nombre={nombre} />
                        </span>
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
              <Button
                onClick={() => guardar.mutate()}
                disabled={guardar.isPending || !hasPermission('permisos', 'editar')}
              >
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
