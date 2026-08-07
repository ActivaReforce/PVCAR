import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import UserForm from '@/components/users/UserForm';
import UserDetail from '@/components/users/UserDetail';
import UsuariosHeader from '@/components/users/UsuariosHeader';
import UsuariosFilters from '@/components/users/UsuariosFilters';
import UserTable from '@/components/users/UserTable';
import UserStatusFilters from '@/components/users/UserStatusFilters';
import { UserDeactivationDialog } from '@/components/users/UserDeactivationDialog';
import EliminarUsuarioDialog from '@/components/users/EliminarUsuarioDialog';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import { DataPagination } from '@/components/ui/data-pagination';
import {
  useDarDeBaja,
  useReactivarUsuario,
  useRoles,
  useUsuario,
  useUsuarios,
} from '@/hooks/useUsuarios';
import type { FiltrosUsuarios, UsuarioListado } from '@/api/usuarios';

const POR_PAGINA = 10;

type FiltroEstado = 'active' | 'inactive' | 'all';

const EST_ID: Record<FiltroEstado, number | undefined> = {
  active: 1,
  inactive: 2,
  all: undefined,
};

const CONTEOS_VACIOS = {
  total: 0,
  activos: 0,
  inactivos: 0,
  porRol: {} as Record<string, number>,
  totalDelEstado: 0,
  sinRol: 0,
};

/**
 * Usuarios.
 *
 * Abre directamente en la lista, con Activos y todos los roles. La pantalla de
 * tarjetas por rol que habia antes obligaba a un clic extra para llegar a lo
 * que se hace siempre, y sus numeros vivian aparte de los de la tabla.
 *
 * Todo el trabajo pesado esta en el servidor: filtro, busqueda, orden,
 * paginacion y conteos. Antes esta pantalla se traia la tabla `usuario`
 * entera con sus roles anidados y filtraba, ordenaba, contaba y paginaba en
 * el navegador — y lo hacia con la anon key, asi que el filtro por alcance
 * era decorativo.
 */
const Usuarios = () => {
  const [page, setPage] = useState(1);
  // El input ya trae su propio debounce de 300 ms; no hace falta otro encima.
  const [busqueda, setBusqueda] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [sinRolSeleccionado, setSinRolSeleccionado] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FiltroEstado>('active');
  const [orden, setOrden] = useState<FiltrosUsuarios['orden']>('nombre');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [viendoId, setViendoId] = useState<number | null>(null);
  const [aDarDeBaja, setADarDeBaja] = useState<UsuarioListado | null>(null);
  const [aEliminar, setAEliminar] = useState<UsuarioListado | null>(null);

  const filtros: FiltrosUsuarios = {
    page,
    limit: POR_PAGINA,
    buscar: busqueda || undefined,
    rol: selectedRoles.length > 0 ? selectedRoles : undefined,
    sinRol: sinRolSeleccionado || undefined,
    estado: EST_ID[statusFilter],
    orden,
    dir,
  };

  const lista = useUsuarios(filtros);
  const rolesQuery = useRoles();
  const fichaEdicion = useUsuario(editandoId);
  const fichaDetalle = useUsuario(viendoId);

  const darDeBaja = useDarDeBaja();
  const reactivar = useReactivarUsuario();

  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const usuarios = lista.data?.items ?? [];
  const conteos = lista.data?.conteos ?? CONTEOS_VACIOS;
  const totalPages = lista.data?.totalPages ?? 0;
  const totalItems = lista.data?.total ?? 0;

  /** Cualquier cambio de filtro vuelve a la primera pagina. */
  const cambiarFiltro = (accion: () => void) => {
    accion();
    setPage(1);
  };

  /** Roles y "sin rol" son excluyentes: no existe quien cumpla las dos cosas. */
  const alternarRol = (rolId: number) =>
    cambiarFiltro(() => {
      setSinRolSeleccionado(false);
      setSelectedRoles((prev) =>
        prev.includes(rolId) ? prev.filter((id) => id !== rolId) : [...prev, rolId],
      );
    });

  const alternarSinRol = () =>
    cambiarFiltro(() => {
      setSelectedRoles([]);
      setSinRolSeleccionado((prev) => !prev);
    });

  const verTodos = () =>
    cambiarFiltro(() => {
      setSelectedRoles([]);
      setSinRolSeleccionado(false);
    });

  /**
   * La cabecera manda el nombre logico de la columna ('nombre', 'estado',
   * 'creacion'); el backend lo traduce a SQL contra una lista blanca. Pulsar
   * la columna que ya ordena invierte el sentido.
   */
  const handleSort = (key: string) => {
    const columna = key as FiltrosUsuarios['orden'];
    cambiarFiltro(() => {
      if (columna === orden) {
        setDir(dir === 'asc' ? 'desc' : 'asc');
      } else {
        setOrden(columna);
        setDir('asc');
      }
    });
  };

  const nombresDeRolesSeleccionados = useMemo(() => {
    if (sinRolSeleccionado) return 'Usuarios sin rol';
    if (selectedRoles.length === 0) return 'Todos los usuarios';
    return roles
      .filter((r) => selectedRoles.includes(r.rol_id))
      .map((r) => r.rol_nombre)
      .join(', ');
  }, [roles, selectedRoles, sinRolSeleccionado]);

  const confirmarBaja = async () => {
    if (!aDarDeBaja) return;
    try {
      await darDeBaja.mutateAsync(aDarDeBaja.usu_id);
    } finally {
      setADarDeBaja(null);
    }
  };

  if (lista.isLoading && !lista.data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Cargando usuarios...</div>
      </div>
    );
  }

  if (lista.isError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">
          No se pudieron cargar los usuarios: {(lista.error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6 min-w-0 max-w-full overflow-hidden">
      <UsuariosHeader onCreateUser={() => setCreando(true)} />

      <UserStatusFilters
        statusFilter={statusFilter}
        onStatusChange={(estado) => cambiarFiltro(() => setStatusFilter(estado))}
        userCounts={{
          active: conteos.activos,
          inactive: conteos.inactivos,
          total: conteos.total,
        }}
      />

      <UsuariosFilters
        roles={roles}
        conteosPorRol={conteos.porRol}
        totalUsuarios={conteos.totalDelEstado}
        totalFiltrado={totalItems}
        sinRol={conteos.sinRol}
        selectedRoles={selectedRoles}
        sinRolSeleccionado={sinRolSeleccionado}
        onRoleToggle={alternarRol}
        onSinRolToggle={alternarSinRol}
        onViewAll={verTodos}
        getSelectedRoleNames={() => nombresDeRolesSeleccionados}
      />

      <DebouncedSearchInput
        placeholder="Buscar por nombre o correo..."
        value={busqueda}
        onChange={(texto) => cambiarFiltro(() => setBusqueda(texto))}
        className="w-full sm:max-w-sm"
      />

      <div className="space-y-4">
        <div className="overflow-x-auto">
          <UserTable
            users={usuarios}
            sortKey={orden}
            sortDirection={dir}
            onView={(user) => setViendoId(user.usu_id)}
            onEdit={(user) => setEditandoId(user.usu_id)}
            onDelete={(userId) => setADarDeBaja(usuarios.find((u) => u.usu_id === userId) ?? null)}
            onReactivate={(userId) => reactivar.mutate(userId)}
            onPermanentDelete={(userId) =>
              setAEliminar(usuarios.find((u) => u.usu_id === userId) ?? null)
            }
            onSort={handleSort}
          />
        </div>

        {/* La paginacion la manda el servidor: estos numeros vienen de la
            respuesta, no de cortar un array en el navegador. */}
        <DataPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          canGoNext={page < totalPages}
          canGoPrevious={page > 1}
          startIndex={(page - 1) * POR_PAGINA}
          endIndex={Math.min(page * POR_PAGINA, totalItems)}
          totalItems={totalItems}
          itemName="usuarios"
        />
      </div>

      {/* Alta y edicion comparten formulario; en edicion se espera a la ficha. */}
      <Dialog
        open={creando || editandoId !== null}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setCreando(false);
            setEditandoId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editandoId !== null ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
            </DialogTitle>
          </DialogHeader>

          {editandoId !== null && fichaEdicion.isLoading ? (
            <p className="py-6 text-center text-muted-foreground">Cargando ficha…</p>
          ) : (
            <UserForm
              user={editandoId !== null ? fichaEdicion.data : null}
              roles={roles}
              onSuccess={() => {
                setCreando(false);
                setEditandoId(null);
              }}
              onCancel={() => {
                setCreando(false);
                setEditandoId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={viendoId !== null} onOpenChange={(abierto) => !abierto && setViendoId(null)}>
        <DialogContent className="sm:max-w-md md:max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Detalles del Usuario</DialogTitle>
          </DialogHeader>

          {fichaDetalle.data ? (
            <UserDetail user={fichaDetalle.data} onClose={() => setViendoId(null)} />
          ) : (
            <p className="py-6 text-center text-muted-foreground">Cargando…</p>
          )}
        </DialogContent>
      </Dialog>

      <UserDeactivationDialog
        isOpen={aDarDeBaja !== null}
        onClose={() => setADarDeBaja(null)}
        onConfirm={confirmarBaja}
        userName={aDarDeBaja?.usu_nombre ?? ''}
      />

      <EliminarUsuarioDialog
        usuario={aEliminar}
        onClose={() => setAEliminar(null)}
        onEliminado={() => setAEliminar(null)}
      />
    </div>
  );
};

export default Usuarios;
