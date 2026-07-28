
import React from 'react';
import RoleCard from './RoleCard';
import { Database } from '@/integrations/supabase/types';

type Rol = Database['public']['Tables']['rol']['Row'];

interface UserWithRoles {
  user_roles: Array<{ rol_id: number }>;
}

interface UsersCardGridProps {
  roles: Rol[];
  users: UserWithRoles[];
  selectedRoles: number[];
  onRoleSelect: (roleId: number) => void;
  className?: string;
}

const UsersCardGrid = ({ 
  roles, 
  users, 
  selectedRoles, 
  onRoleSelect,
  className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
}: UsersCardGridProps) => {
  return (
    <>
      {roles.map((role) => (
        <RoleCard
          key={role.rol_id}
          role={role}
          users={users}
          isSelected={selectedRoles.includes(role.rol_id)}
          onClick={() => onRoleSelect(role.rol_id)}
        />
      ))}
    </>
  );
};

export default UsersCardGrid;
