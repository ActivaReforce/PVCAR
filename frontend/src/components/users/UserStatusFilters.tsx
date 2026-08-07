import { Button } from '@/components/ui/button';
import { CheckCircle, Users, XCircle } from 'lucide-react';

interface UserCounts {
  active: number;
  inactive: number;
  total: number;
}

interface UserStatusFiltersProps {
  statusFilter: 'active' | 'inactive' | 'all';
  onStatusChange: (status: 'active' | 'inactive' | 'all') => void;
  userCounts: UserCounts;
}

/**
 * Filtro de estado.
 *
 * Dos arreglos respecto a la version anterior:
 *  - Los colores salen de los tokens del tema (bg-muted, primary-foreground).
 *    Antes eran bg-gray-50 con un dark:bg-gray-800 a mano, y el contador
 *    dentro del boton activo se pintaba con el gris claro de siempre: en modo
 *    oscuro quedaba texto claro sobre fondo claro, ilegible.
 *  - Un solo bloque para movil y escritorio. Antes habia dos copias del mismo
 *    markup y la de movil se habia quedado sin los numeros.
 */
const OPCIONES = [
  { valor: 'active', etiqueta: 'Activos', Icono: CheckCircle },
  { valor: 'inactive', etiqueta: 'Inactivos', Icono: XCircle },
  { valor: 'all', etiqueta: 'Todos', Icono: Users },
] as const;

const UserStatusFilters = ({
  statusFilter,
  onStatusChange,
  userCounts,
}: UserStatusFiltersProps) => {
  const cuenta = (valor: (typeof OPCIONES)[number]['valor']) =>
    valor === 'active' ? userCounts.active : valor === 'inactive' ? userCounts.inactive : userCounts.total;

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 p-3 sm:p-4 bg-muted/50 rounded-lg min-w-0">
      {OPCIONES.map(({ valor, etiqueta, Icono }) => {
        const activo = statusFilter === valor;
        return (
          <Button
            key={valor}
            variant={activo ? 'default' : 'outline'}
            size="sm"
            onClick={() => onStatusChange(valor)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 min-w-0"
          >
            <Icono className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{etiqueta}</span>
            {/* Contador legible sobre los dos fondos, en claro y en oscuro. */}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${
                activo ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {cuenta(valor)}
            </span>
          </Button>
        );
      })}
    </div>
  );
};

export default UserStatusFilters;
