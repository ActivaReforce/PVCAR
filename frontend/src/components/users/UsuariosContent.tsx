import { DataPagination } from '@/components/ui/data-pagination';
import UsersCardGrid from './UsersCardGrid';
import UserTable from './UserTable';
import type { Rol, UsuarioListado } from '@/api/usuarios';
import { SortDirection } from '@/hooks/useSorting';

interface UsuariosContentProps {
  viewMode: 'cards' | 'table';
  roles: Rol[];
  usuarios: UsuarioListado[];
  conteosPorRol: Record<string, number>;
  selectedRoles: number[];
  sortKey?: string | null;
  sortDirection?: SortDirection;
  currentPage: number;
  totalPages: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  startIndex: number;
  endIndex: number;
  totalItems: number;
  onRoleSelect: (roleId: number) => void;
  onView: (user: UsuarioListado) => void;
  onEdit: (user: UsuarioListado) => void;
  onDelete: (userId: number) => void;
  onReactivate: (userId: number) => void;
  onPermanentDelete: (userId: number) => void;
  onSort?: (key: string) => void;
  onPageChange: (page: number) => void;
}

/**
 * La paginacion la manda el servidor: currentPage, totalPages y totalItems
 * vienen de la respuesta del API, no de cortar un array en el navegador.
 */
const UsuariosContent = ({
  viewMode,
  roles,
  usuarios,
  conteosPorRol,
  selectedRoles,
  sortKey,
  sortDirection,
  currentPage,
  totalPages,
  canGoNext,
  canGoPrevious,
  startIndex,
  endIndex,
  totalItems,
  onRoleSelect,
  onView,
  onEdit,
  onDelete,
  onReactivate,
  onPermanentDelete,
  onSort,
  onPageChange,
}: UsuariosContentProps) => {
  if (viewMode === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <UsersCardGrid
          roles={roles}
          conteosPorRol={conteosPorRol}
          selectedRoles={selectedRoles}
          onRoleSelect={onRoleSelect}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <UserTable
          users={usuarios}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onReactivate={onReactivate}
          onPermanentDelete={onPermanentDelete}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={onSort}
        />
      </div>

      <DataPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        canGoNext={canGoNext}
        canGoPrevious={canGoPrevious}
        startIndex={startIndex}
        endIndex={endIndex}
        totalItems={totalItems}
        itemName="usuarios"
      />
    </div>
  );
};

export default UsuariosContent;
