import { Loader2, Save, Undo2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  sinMarcar: number;
  cambios: number;
  incompletas: number;
  guardando: boolean;
  onPresenteATodos: () => void;
  onDeshacer: () => void;
  onGuardar: () => void;
}

/**
 * La barra de acción, fija abajo.
 *
 * Fija y no al final de la lista porque con 42 alumnos el botón de guardar
 * quedaba a un scroll de distancia del último que marcaste: el sistema viejo
 * guardaba fila a fila justamente para no tener que llegar hasta él.
 *
 * Dice **por qué** no se puede guardar en vez de dejar el botón apagado sin
 * explicación, que es el peor estado de una interfaz.
 */
const BarraGuardar = ({
  sinMarcar,
  cambios,
  incompletas,
  guardando,
  onPresenteATodos,
  onDeshacer,
  onGuardar,
}: Props) => {
  const bloqueado = incompletas > 0 || cambios === 0 || guardando;

  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:-mx-6 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm text-muted-foreground">
          {incompletas > 0 ? (
            <span className="text-amber-700 dark:text-amber-400">
              {incompletas} fila(s) sin completar: falta la hora o el motivo.
            </span>
          ) : cambios > 0 ? (
            <span>
              <strong className="text-foreground">{cambios}</strong> sin guardar
              {sinMarcar > 0 && ` · ${sinMarcar} sin marcar`}
            </span>
          ) : sinMarcar > 0 ? (
            <span>{sinMarcar} sin marcar</span>
          ) : (
            <span>Todo guardado.</span>
          )}
        </div>

        <div className="flex gap-2">
          {sinMarcar > 0 && (
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 sm:h-10 sm:flex-none"
              onClick={onPresenteATodos}
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Presente a los {sinMarcar}
            </Button>
          )}

          {cambios > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 sm:h-10"
              onClick={onDeshacer}
              disabled={guardando}
              title="Descartar los cambios sin guardar"
              aria-label="Descartar los cambios sin guardar"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}

          <Button
            type="button"
            variant="brand"
            className="h-11 flex-1 sm:h-10 sm:flex-none"
            onClick={onGuardar}
            disabled={bloqueado}
          >
            {guardando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar {cambios > 0 ? cambios : ''}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BarraGuardar;
