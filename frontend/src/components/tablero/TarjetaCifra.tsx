import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  titulo: string;
  valor: number | string;
  detalle?: string;
  icono: LucideIcon;
  /** Si se pasa, la tarjeta lleva a la pantalla del módulo. */
  a?: string;
  /** Pinta la cifra en ámbar: algo pendiente que mirar. */
  avisa?: boolean;
}

/**
 * Una cifra del tablero.
 *
 * Todas las de esta pantalla salen de una consulta. En el sistema viejo había
 * un tablero de reserva, para los roles sin tablero propio, con los números
 * **escritos a mano en el código**: "12 colegios", "328 usuarios", "46
 * actividades". Ese camino ya no existe.
 */
const TarjetaCifra = ({ titulo, valor, detalle, icono: Icono, a, avisa }: Props) => {
  const cuerpo = (
    <Card className={a ? 'transition-colors hover:border-primary/50' : undefined}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-muted p-2">
          <Icono className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div
            className={`text-2xl font-semibold ${
              avisa ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'
            }`}
          >
            {valor}
          </div>
          <div className="truncate text-sm text-muted-foreground">{titulo}</div>
          {detalle && <div className="truncate text-xs text-muted-foreground">{detalle}</div>}
        </div>
      </CardContent>
    </Card>
  );

  return a ? (
    <Link to={a} className="block">
      {cuerpo}
    </Link>
  ) : (
    cuerpo
  );
};

export default TarjetaCifra;
