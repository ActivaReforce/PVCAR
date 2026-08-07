import RoleFilters from './RoleFilters';
import MobileRoleSelector from './MobileRoleSelector';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Rol } from '@/api/usuarios';

interface UsuariosFiltersProps {
  roles: Rol[];
  conteosPorRol: Record<string, number>;
  totalUsuarios: number;
  /** Cuantos entran en el filtro actual, segun el servidor. */
  totalFiltrado: number;
  sinRol: number;
  selectedRoles: number[];
  sinRolSeleccionado: boolean;
  onRoleToggle: (roleId: number) => void;
  onSinRolToggle: () => void;
  onViewAll: () => void;
  getSelectedRoleNames: () => string;
}

const UsuariosFilters = ({
  roles,
  conteosPorRol,
  totalUsuarios,
  totalFiltrado,
  sinRol,
  selectedRoles,
  sinRolSeleccionado,
  onRoleToggle,
  onSinRolToggle,
  onViewAll,
  getSelectedRoleNames,
}: UsuariosFiltersProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-4 min-w-0 max-w-full">
        <MobileRoleSelector
          roles={roles}
          conteosPorRol={conteosPorRol}
          totalUsuarios={totalUsuarios}
          sinRol={sinRol}
          selectedRoles={selectedRoles}
          sinRolSeleccionado={sinRolSeleccionado}
          onRoleToggle={onRoleToggle}
          onSinRolToggle={onSinRolToggle}
          onViewAll={onViewAll}
        />
        <div className="text-sm text-muted-foreground text-center px-2">
          <span className="truncate block">
            Mostrando: {getSelectedRoleNames()} ({totalFiltrado} usuarios)
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-muted/50 p-4 rounded-lg">
      <RoleFilters
        roles={roles}
        conteosPorRol={conteosPorRol}
        totalUsuarios={totalUsuarios}
        sinRol={sinRol}
        selectedRoles={selectedRoles}
        sinRolSeleccionado={sinRolSeleccionado}
        onRoleToggle={onRoleToggle}
        onSinRolToggle={onSinRolToggle}
        onViewAll={onViewAll}
      />
      <div className="text-sm text-muted-foreground">
        Mostrando: {getSelectedRoleNames()} ({totalFiltrado} usuarios)
      </div>
    </div>
  );
};

export default UsuariosFilters;
