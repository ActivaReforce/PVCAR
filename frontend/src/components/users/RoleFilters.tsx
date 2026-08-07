
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Rol } from '@/api/usuarios';

interface RoleFiltersProps {
  roles: Rol[];
  /** Conteos del servidor: { "3": 49 }. Antes se contaba el array cargado. */
  conteosPorRol: Record<string, number>;
  totalUsuarios: number;
  sinRol: number;
  selectedRoles: number[];
  sinRolSeleccionado: boolean;
  onRoleToggle: (roleId: number) => void;
  onSinRolToggle: () => void;
  onViewAll: () => void;
}

const RoleFilters = ({
  roles,
  conteosPorRol,
  totalUsuarios,
  sinRol,
  selectedRoles,
  sinRolSeleccionado,
  onRoleToggle,
  onSinRolToggle,
  onViewAll,
}: RoleFiltersProps) => {
  const getUserCountForRole = (roleId: number) => conteosPorRol[String(roleId)] ?? 0;

  const isViewingAll = selectedRoles.length === 0 && !sinRolSeleccionado;

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
          {totalUsuarios}
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

      {/* Excluyente con los roles: o unos, o los que no tienen ninguno. */}
      {sinRol > 0 && (
        <Button
          variant={sinRolSeleccionado ? 'default' : 'outline'}
          size="sm"
          onClick={onSinRolToggle}
          className="flex items-center gap-2"
        >
          Sin rol
          <Badge variant="secondary" className="ml-1">
            {sinRol}
          </Badge>
        </Button>
      )}
    </div>
  );
};

export default RoleFilters;
