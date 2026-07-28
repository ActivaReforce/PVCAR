import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database } from '@/integrations/supabase/types';

type Rol = Database['public']['Tables']['rol']['Row'];

interface UserWithRoles {
  user_roles: Array<{ rol_id: number }>;
}

interface MobileRoleSelectorProps {
  roles: Rol[];
  users: UserWithRoles[];
  selectedRoles: number[];
  onRoleToggle: (roleId: number) => void;
  onViewAll: () => void;
}

const MobileRoleSelector = ({ 
  roles, 
  users, 
  selectedRoles, 
  onRoleToggle, 
  onViewAll 
}: MobileRoleSelectorProps) => {
  const getUserCountForRole = (roleId: number) => {
    return users.filter(user => 
      user.user_roles?.some(ur => ur.rol_id === roleId)
    ).length;
  };

  const getDisplayValue = () => {
    if (selectedRoles.length === 0) {
      return `Ver Todos (${users.length})`;
    }
    if (selectedRoles.length === 1) {
      const role = roles.find(r => r.rol_id === selectedRoles[0]);
      const count = getUserCountForRole(selectedRoles[0]);
      return `${role?.rol_nombre} (${count})`;
    }
    return `${selectedRoles.length} roles seleccionados`;
  };

  const handleValueChange = (value: string) => {
    if (value === 'all') {
      onViewAll();
    } else {
      const roleId = parseInt(value);
      onRoleToggle(roleId);
    }
  };

  return (
    <Select onValueChange={handleValueChange}>
      <SelectTrigger className="w-full max-w-full min-w-0">
        <SelectValue placeholder={getDisplayValue()} />
      </SelectTrigger>
      <SelectContent className="max-w-[calc(100vw-2rem)]">
        <SelectItem value="all">
          Ver Todos ({users.length})
        </SelectItem>
        {roles.map((role) => {
          const userCount = getUserCountForRole(role.rol_id);
          return (
            <SelectItem key={role.rol_id} value={role.rol_id.toString()}>
              <span className="truncate">{role.rol_nombre} ({userCount})</span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};

export default MobileRoleSelector;