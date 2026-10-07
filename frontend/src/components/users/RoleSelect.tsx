import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Rol } from '@/api/usuarios';

interface RoleSelectProps {
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

/**
 * Filtro de rol de Usuarios: un select en la fila del buscador, en todos los
 * tamaños (decisión del cliente, 2026-10-05: fuera la fila de botones).
 */
const RoleSelect = ({
  roles,
  conteosPorRol,
  totalUsuarios,
  sinRol,
  selectedRoles,
  sinRolSeleccionado,
  onRoleToggle,
  onSinRolToggle,
  onViewAll,
}: RoleSelectProps) => {
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
   * Un rol a la vez. "Ver Todos" limpia.
   */
  const valorActual = sinRolSeleccionado
    ? 'sin-rol'
    : selectedRoles.length === 1
      ? String(selectedRoles[0])
      : 'all';

  return (
    <Select value={valorActual} onValueChange={alElegir}>
      <SelectTrigger className="h-11 w-full max-w-full min-w-0 sm:h-10" aria-label="Filtrar por rol">
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

export default RoleSelect;
