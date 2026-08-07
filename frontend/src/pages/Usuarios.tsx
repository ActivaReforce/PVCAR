import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import UserForm from '@/components/users/UserForm';
import UserDetail from '@/components/users/UserDetail';
import UsuariosHeader from '@/components/users/UsuariosHeader';
import UsuariosSearch from '@/components/users/UsuariosSearch';
import UsuariosFilters from '@/components/users/UsuariosFilters';
import UsuariosContent from '@/components/users/UsuariosContent';
import UserStatusFilters from '@/components/users/UserStatusFilters';
import { UserDeactivationDialog } from '@/components/users/UserDeactivationDialog';
import EliminarUsuarioDialog from '@/components/users/EliminarUsuarioDialog';
import { useDebounce } from '@/hooks/useDebounce';
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

/**
 * Usuarios.
 *
 * Todo el trabajo pesado esta en el servidor: filtro, busqueda, orden,
 * paginacion y conteos. Antes esta pantalla se traia la tabla `usuario`
 * entera con sus roles anidados y filtraba, ordenaba, contaba y paginaba en
 * el navegador — y lo hacia con la anon key, asi que el filtro por alcance
 * era decorativo.
 */
const Usuarios = () => {
  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const buscarDebounced = useDebounce(busqueda, 300);
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<FiltroEstado>('active');
  const [orden, setOrden] = useState<FiltrosUsuarios['orden']>('creacion');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [viendoId, setViendoId] = useState<number | null>(null);
  const [aDarDeBaja, setADarDeBaja] = useState<UsuarioListado | null>(null);
  const [aEliminar, setAEliminar] = useState<UsuarioListado | null>(null);

  const filtros: FiltrosUsuarios = {
    page,
    limit: POR_PAGINA,
    buscar: buscarDebounced || undefined,
    rol: selectedRoles.length > 0 ? selectedRoles : undefined,
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
  const conteos = lista.data?.conteos ?? { total: 0, activos: 0, inactivos: 0, porRol: {} };
  const totalPages = lista.data?.totalPages ?? 0;
  const totalItems = lista.data?.total ?? 0;

  /** Cualquier cambio de filtro vuelve a la primera pagina. */
  const cambiarFiltro = (accion: () => void) => {
    accion();
    setPage(1);
  };

  const handleSort = (key: string) => {
    const columnas: Record<string, FiltrosUsuarios['orden']> = {
      usu_nombre: 'nombre',
      usu_correo: 'correo',
      usu_fecha_creacion: 'creacion',
      est_id: 'estado',
    };
    const columna = columnas[key] ?? (key as FiltrosUsuarios['orden']);
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
    if (selectedRoles.length === 0) return 'Todos los usuarios';
    return roles
      .filter((r) => selectedRoles.includes(r.rol_id))
      .map((r) => r.rol_nombre)
      .join(', ');
  }, [roles, selectedRoles]);

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
      <UsuariosHeader
        viewMode={viewMode}
        onCreateUser={() => setCreando(true)}
        onBackToCards={() => {
          setViewMode('cards');
          cambiarFiltro(() => setSelectedRoles([]));
        }}
      />

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
        viewMode={viewMode}
        roles={roles}
        conteosPorRol={conteos.porRol}
        totalUsuarios={conteos.total}
        totalFiltrado={totalItems}
        selectedRoles={selectedRoles}
        onRoleToggle={(rolId) =>
          cambiarFiltro(() =>
            setSelectedRoles((prev) =>
              prev.includes(rolId) ? prev.filter((id) => id !== rolId) : [...prev, rolId],
            ),
          )
        }
        onViewAll={() => cambiarFiltro(() => setSelectedRoles([]))}
        getSelectedRoleNames={() => nombresDeRolesSeleccionados}
      />

      {viewMode === 'table' && (
        <UsuariosSearch
          searchTerm={busqueda}
          onSearchChange={(texto) => cambiarFiltro(() => setBusqueda(texto))}
        />
      )}

      <UsuariosContent
        viewMode={viewMode}
        roles={roles}
        usuarios={usuarios}
        conteosPorRol={conteos.porRol}
        selectedRoles={selectedRoles}
        sortKey={orden}
        sortDirection={dir}
        currentPage={page}
        totalPages={totalPages}
        canGoNext={page < totalPages}
        canGoPrevious={page > 1}
        startIndex={(page - 1) * POR_PAGINA}
        endIndex={Math.min(page * POR_PAGINA, totalItems)}
        totalItems={totalItems}
        onRoleSelect={(rolId) => {
          setViewMode('table');
          cambiarFiltro(() => setSelectedRoles([rolId]));
        }}
        onView={(user) => setViendoId(user.usu_id)}
        onEdit={(user) => setEditandoId(user.usu_id)}
        onDelete={(userId) =>
          setADarDeBaja(usuarios.find((u) => u.usu_id === userId) ?? null)
        }
        onReactivate={(userId) => reactivar.mutate(userId)}
        onPermanentDelete={(userId) =>
          setAEliminar(usuarios.find((u) => u.usu_id === userId) ?? null)
        }
        onSort={handleSort}
        onPageChange={setPage}
      />

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
