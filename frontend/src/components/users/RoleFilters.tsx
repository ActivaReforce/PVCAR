import { Button } from '@/components/ui/button';
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

/**
 * El contador va dentro del boton y tiene que leerse en los dos estados y en
 * los dos temas: sobre el boton activo hereda el color del primario, sobre el
 * inactivo el del muted. Con el Badge secondary de antes, el numero del boton
 * seleccionado desaparecia en modo oscuro.
 */
const Contador = ({ n, activo }: { n: number; activo: boolean }) => (
  <span
    className={`rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${
      activo ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
    }`}
  >
    {n}
  </span>
);

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
  const cuenta = (roleId: number) => conteosPorRol[String(roleId)] ?? 0;
  const viendoTodos = selectedRoles.length === 0 && !sinRolSeleccionado;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={viendoTodos ? 'default' : 'outline'}
        size="sm"
        onClick={onViewAll}
        className="flex items-center gap-2"
      >
        Ver Todos
        <Contador n={totalUsuarios} activo={viendoTodos} />
      </Button>

      {roles.map((role) => {
        const activo = selectedRoles.includes(role.rol_id);
        return (
          <Button
            key={role.rol_id}
            variant={activo ? 'default' : 'outline'}
            size="sm"
            onClick={() => onRoleToggle(role.rol_id)}
            className="flex items-center gap-2 min-w-0"
          >
            <span className="truncate">{role.rol_nombre}</span>
            <Contador n={cuenta(role.rol_id)} activo={activo} />
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
          <Contador n={sinRol} activo={sinRolSeleccionado} />
        </Button>
      )}
    </div>
  );
};

export default RoleFilters;
