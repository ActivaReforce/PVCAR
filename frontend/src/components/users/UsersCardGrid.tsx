import RoleCard from './RoleCard';
import type { Rol } from '@/api/usuarios';

interface UsersCardGridProps {
  roles: Rol[];
  /** Usuarios por rol, tal como los cuenta el API: { "3": 49 }. */
  conteosPorRol: Record<string, number>;
  selectedRoles: number[];
  onRoleSelect: (roleId: number) => void;
}

const UsersCardGrid = ({
  roles,
  conteosPorRol,
  selectedRoles,
  onRoleSelect,
}: UsersCardGridProps) => (
  <>
    {roles.map((role) => (
      <RoleCard
        key={role.rol_id}
        role={role}
        userCount={conteosPorRol[String(role.rol_id)] ?? 0}
        isSelected={selectedRoles.includes(role.rol_id)}
        onClick={() => onRoleSelect(role.rol_id)}
      />
    ))}
  </>
);

export default UsersCardGrid;
