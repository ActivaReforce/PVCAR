import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Rol } from '@/api/usuarios';

interface MobileRoleSelectorProps {
  roles: Rol[];
  conteosPorRol: Record<string, number>;
  totalUsuarios: number;
  sinRol: number;
  selectedRoles: number[];
  sinRolSeleccionado: boolean;
  onRoleToggle: (roleId: number) => void;
  onSinRolToggle: () => void;
  onViewAll: () => void;
}

const MobileRoleSelector = ({
  roles,
  conteosPorRol,
  totalUsuarios,
  sinRol,
  selectedRoles,
  sinRolSeleccionado,
  onRoleToggle,
  onSinRolToggle,
  onViewAll,
}: MobileRoleSelectorProps) => {
  const cuenta = (roleId: number) => conteosPorRol[String(roleId)] ?? 0;

  const etiqueta = () => {
    if (sinRolSeleccionado) return `Sin rol (${sinRol})`;
    if (selectedRoles.length === 0) return `Ver Todos (${totalUsuarios})`;
    if (selectedRoles.length === 1) {
      const rol = roles.find((r) => r.rol_id === selectedRoles[0]);
      return `${rol?.rol_nombre} (${cuenta(selectedRoles[0] as number)})`;
    }
    return `${selectedRoles.length} roles seleccionados`;
  };

  const alElegir = (valor: string) => {
    if (valor === 'all') {
      onViewAll();
      return;
    }
    if (valor === 'sin-rol') {
      onSinRolToggle();
      return;
    }
    onRoleToggle(Number(valor));
  };

  /**
   * Controlado. Sin `value`, Radix no vuelve a emitir onValueChange al elegir
   * la opcion que ya estaba: el rol quedaba pegado y no habia forma de
   * quitarlo salvo pasando por "Ver Todos". Con el valor explicito el control
   * dice siempre lo que hay puesto.
   *
   * En el telefono el filtro es de un rol a la vez; para combinar varios esta
   * la fila de botones del escritorio. "Ver Todos" limpia.
   */
  const valorActual = sinRolSeleccionado
    ? 'sin-rol'
    : selectedRoles.length === 1
      ? String(selectedRoles[0])
      : 'all';

  return (
    <Select value={valorActual} onValueChange={alElegir}>
      <SelectTrigger className="h-11 w-full max-w-full min-w-0">
        <SelectValue placeholder={etiqueta()} />
      </SelectTrigger>
      <SelectContent className="max-w-[calc(100vw-2rem)]">
        <SelectItem value="all">Ver Todos ({totalUsuarios})</SelectItem>
        {roles.map((role) => (
          <SelectItem key={role.rol_id} value={String(role.rol_id)}>
            <span className="truncate">
              {role.rol_nombre} ({cuenta(role.rol_id)})
            </span>
          </SelectItem>
        ))}
        {sinRol > 0 && <SelectItem value="sin-rol">Sin rol ({sinRol})</SelectItem>}
      </SelectContent>
    </Select>
  );
};

export default MobileRoleSelector;
