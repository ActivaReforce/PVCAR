import { DataPagination } from '@/components/ui/data-pagination';
import UserTable from './UserTable';
import type { UsuarioListado } from '@/api/usuarios';
import { SortDirection } from '@/hooks/useSorting';

interface UsuariosContentProps {
  usuarios: UsuarioListado[];
  sortKey?: string | null;
  sortDirection?: SortDirection;
  currentPage: number;
  totalPages: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  startIndex: number;
  endIndex: number;
  totalItems: number;
  onView: (user: UsuarioListado) => void;
  onEdit: (user: UsuarioListado) => void;
  onDelete: (userId: number) => void;
  onReactivate: (userId: number) => void;
  onPermanentDelete: (userId: number) => void;
  onSort?: (key: string) => void;
  onPageChange: (page: number) => void;
}

/**
 * Tabla y paginacion. La paginacion la manda el servidor: currentPage,
 * totalPages y totalItems vienen de la respuesta del API, no de cortar un
 * array en el navegador.
 */
const UsuariosContent = ({
  usuarios,
  sortKey,
  sortDirection,
  currentPage,
  totalPages,
  canGoNext,
  canGoPrevious,
  startIndex,
  endIndex,
  totalItems,
  onView,
  onEdit,
  onDelete,
  onReactivate,
  onPermanentDelete,
  onSort,
  onPageChange,
}: UsuariosContentProps) => (
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

export default UsuariosContent;
