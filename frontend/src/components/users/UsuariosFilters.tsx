import RoleFilters from "./RoleFilters";
import MobileRoleSelector from "./MobileRoleSelector";
import { Database } from "@/integrations/supabase/types";
import { useIsMobile } from "@/hooks/use-mobile";

type Rol = Database['public']['Tables']['rol']['Row'];

interface UserWithRoles {
  user_roles: Array<{
    rol_id: number;
  }>;
}

interface UsuariosFiltersProps {
  viewMode: 'cards' | 'table';
  roles: Rol[];
  users: UserWithRoles[];
  selectedRoles: number[];
  filteredUsuarios: UserWithRoles[];
  onRoleToggle: (roleId: number) => void;
  onViewAll: () => void;
  getSelectedRoleNames: () => string;
}

const UsuariosFilters = ({
  viewMode,
  roles,
  users,
  selectedRoles,
  filteredUsuarios,
  onRoleToggle,
  onViewAll,
  getSelectedRoleNames
}: UsuariosFiltersProps) => {
  const isMobile = useIsMobile();
  
  if (viewMode !== 'table') return null;
  
  if (isMobile) {
    return (
      <div className="space-y-4 min-w-0 max-w-full">
        <MobileRoleSelector 
          roles={roles}
          users={users}
          selectedRoles={selectedRoles}
          onRoleToggle={onRoleToggle}
          onViewAll={onViewAll}
        />
        <div className="text-sm text-muted-foreground text-center px-2">
          <span className="truncate block">Mostrando: {getSelectedRoleNames()} ({filteredUsuarios.length} usuarios)</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 bg-gray-100 p-4">
      <RoleFilters roles={roles} users={users} selectedRoles={selectedRoles} onRoleToggle={onRoleToggle} onViewAll={onViewAll} />
      <div className="text-sm text-muted-foreground">
        Mostrando: {getSelectedRoleNames()} ({filteredUsuarios.length} usuarios)
      </div>
    </div>
  );
};
export default UsuariosFilters;