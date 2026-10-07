import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle, Users, XCircle } from 'lucide-react';

export type FiltroEstado = 'active' | 'inactive' | 'all';

interface UserCounts {
  active: number;
  inactive: number;
  total: number;
}

interface Props {
  statusFilter: FiltroEstado;
  onStatusChange: (status: FiltroEstado) => void;
  userCounts: UserCounts;
}

/**
 * Filtro de estado.
 *
 * Dos presentaciones del mismo estado y los mismos numeros: botones cuando hay
 * sitio, un select en el telefono. Los tres botones en 360 px quedaban tan
 * estrechos que no se leia ninguno (probado el 2026-09-17), y ocupaban una
 * fila entera para tres palabras.
 *
 * Las dos salen de `OPCIONES` y de `cuenta()`: no hay forma de que una ensene
 * un numero y la otra otro, que es lo que pasaba cuando eran dos markups
 * copiados.
 */
const OPCIONES = [
  { valor: 'active', etiqueta: 'Activos', Icono: CheckCircle },
  { valor: 'inactive', etiqueta: 'Inactivos', Icono: XCircle },
  { valor: 'all', etiqueta: 'Todos', Icono: Users },
] as const;

function contar(userCounts: UserCounts, valor: FiltroEstado): number {
  if (valor === 'active') return userCounts.active;
  if (valor === 'inactive') return userCounts.inactive;
  return userCounts.total;
}

/**
 * La version de telefono. Se exporta para poder colocarla junto al selector de
 * rol, en la misma fila: son los dos filtros que se usan a la vez.
 */
export const EstadoSelect = ({ statusFilter, onStatusChange, userCounts }: Props) => (
  <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as FiltroEstado)}>
    <SelectTrigger className="h-11 w-full min-w-0">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {OPCIONES.map(({ valor, etiqueta }) => (
        <SelectItem key={valor} value={valor}>
          {etiqueta} ({contar(userCounts, valor)})
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

/** La version de escritorio: botones con su contador. */
const UserStatusFilters = ({ statusFilter, onStatusChange, userCounts }: Props) => (
  <div className="hidden min-w-0 flex-wrap gap-2 rounded-lg bg-muted/50 p-3 sm:flex sm:gap-3 sm:p-4">
    {OPCIONES.map(({ valor, etiqueta, Icono }) => {
      const activo = statusFilter === valor;
      return (
        <Button
          key={valor}
          variant={activo ? 'default' : 'outline'}
          size="sm"
          onClick={() => onStatusChange(valor)}
          className="flex min-w-0 items-center justify-center gap-2"
        >
          <Icono className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{etiqueta}</span>
          {/* Contador legible sobre los dos fondos, en claro y en oscuro. */}
          <span
            className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              activo
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {contar(userCounts, valor)}
          </span>
        </Button>
      );
    })}
  </div>
);

export default UserStatusFilters;
