import RoleFilters from './RoleFilters';
import MobileRoleSelector from './MobileRoleSelector';
import { EstadoSelect, type FiltroEstado } from './UserStatusFilters';
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
  /** El filtro de estado viaja hasta aqui para que en movil compartan fila. */
  statusFilter: FiltroEstado;
  onStatusChange: (estado: FiltroEstado) => void;
  userCounts: { active: number; inactive: number; total: number };
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
  statusFilter,
  onStatusChange,
  userCounts,
}: UsuariosFiltersProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-4 min-w-0 max-w-full">
        {/* Estado y rol comparten fila: son los dos filtros que se usan a la
            vez, y cada uno ocupando una fila entera dejaba la lista bajo el
            pliegue. */}
        <div className="grid grid-cols-2 gap-2">
          <EstadoSelect
            statusFilter={statusFilter}
            onStatusChange={onStatusChange}
            userCounts={userCounts}
          />
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
        </div>
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
