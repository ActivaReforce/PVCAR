
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database } from '@/integrations/supabase/types';

type Rol = Database['public']['Tables']['rol']['Row'];

interface UserWithRoles {
  user_roles: Array<{ rol_id: number }>;
}

interface RoleFiltersProps {
  roles: Rol[];
  users: UserWithRoles[];
  selectedRoles: number[];
  onRoleToggle: (roleId: number) => void;
  onViewAll: () => void;
}

const RoleFilters = ({ 
  roles, 
  users, 
  selectedRoles, 
  onRoleToggle, 
  onViewAll 
}: RoleFiltersProps) => {
  const getUserCountForRole = (roleId: number) => {
    return users.filter(user => 
      user.user_roles?.some(ur => ur.rol_id === roleId)
    ).length;
  };

  const isViewingAll = selectedRoles.length === 0;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={isViewingAll ? "default" : "outline"}
        size="sm"
        onClick={onViewAll}
        className="flex items-center gap-2"
      >
        Ver Todos
        <Badge variant="secondary" className="ml-1">
          {users.length}
        </Badge>
      </Button>
      
      {roles.map((role) => {
        const userCount = getUserCountForRole(role.rol_id);
        const isSelected = selectedRoles.includes(role.rol_id);
        
        return (
          <Button
            key={role.rol_id}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onRoleToggle(role.rol_id)}
            className="flex items-center gap-2"
          >
            {role.rol_nombre}
            <Badge variant="secondary" className="ml-1">
              {userCount}
            </Badge>
          </Button>
        );
      })}
    </div>
  );
};

export default RoleFilters;
