
import { DataPagination } from "@/components/ui/data-pagination";
import UsersCardGrid from "./UsersCardGrid";
import UserTable from "./UserTable";
import { Database } from "@/integrations/supabase/types";
import { SortDirection } from "@/hooks/useSorting";

type Usuario = Database['public']['Tables']['usuario']['Row'];
type Rol = Database['public']['Tables']['rol']['Row'];

interface UserWithRoles extends Usuario {
  user_roles: Array<{ rol_id: number }>;
}

interface UsuariosContentProps {
  viewMode: 'cards' | 'table';
  roles: Rol[];
  usuarios: UserWithRoles[];
  paginatedUsuarios: UserWithRoles[];
  selectedRoles: number[];
  sortKey?: keyof Usuario | string | null;
  sortDirection?: SortDirection;
  currentPage: number;
  totalPages: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  startIndex: number;
  endIndex: number;
  totalItems: number;
  statusFilter: 'active' | 'inactive' | 'all';
  onRoleSelect: (roleId: number) => void;
  onView: (user: UserWithRoles) => void;
  onEdit: (user: UserWithRoles) => void;
  onDelete: (userId: number) => void;
  onReactivate: (userId: number) => void;
  onPermanentDelete: (userId: number) => void;
  onSort?: (key: keyof Usuario | string) => void;
  onPageChange: (page: number) => void;
}

const UsuariosContent = ({
  viewMode,
  roles,
  usuarios,
  paginatedUsuarios,
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
  statusFilter,
  onRoleSelect,
  onView,
  onEdit,
  onDelete,
  onReactivate,
  onPermanentDelete,
  onSort,
  onPageChange
}: UsuariosContentProps) => {
  if (viewMode === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <UsersCardGrid
          roles={roles}
          users={usuarios}
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
          users={paginatedUsuarios} 
          roles={roles} 
          onView={onView} 
          onEdit={onEdit} 
          onDelete={onDelete}
          onReactivate={onReactivate}
          onPermanentDelete={onPermanentDelete}
          sortKey={sortKey} 
          sortDirection={sortDirection} 
          onSort={onSort}
          selectedRoles={selectedRoles}
          statusFilter={statusFilter}
          onRoleFilterChange={() => {}} // Not used in this mode
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
