import { Loader2, Save, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  sinMarcar: number;
  cambios: number;
  incompletas: number;
  guardando: boolean;
  onDeshacer: () => void;
  /**
   * `marcarRestantes` dice si antes de guardar hay que poner Presente a los
   * que no tienen estado. El padre tiene las marcas en su cierre al momento
   * del clic; el barra solo elige la variante.
   */
  onGuardar: (marcarRestantes: boolean) => void;
  /**
   * Barra arriba o abajo. Las dos acciones son las mismas: el entrenador que
   * acaba de marcar al último no sube a buscar el botón, y el coordinador que
   * abre la pantalla ve de un vistazo lo que queda sin cerrar.
   */
  posicion?: 'arriba' | 'abajo';
}

/**
 * La barra de acción.
 *
 * Dice **por qué** no se puede guardar en vez de dejar el botón apagado sin
 * explicación, que es el peor estado de una interfaz.
 *
 * El botón cambia de nombre según lo que falte:
 * - "Guardar N" cuando ya hay cambios manuales.
 * - "Presentes a los N y guardar" cuando no se ha marcado nada todavía: un
 *   solo gesto para el caso normal (todos han venido).
 */
const BarraGuardar = ({
  sinMarcar,
  cambios,
  incompletas,
  guardando,
  onDeshacer,
  onGuardar,
  posicion = 'abajo',
}: Props) => {
  const soloPresenteATodos = cambios === 0 && sinMarcar > 0 && incompletas === 0;
  const bloqueado = incompletas > 0 || (cambios === 0 && sinMarcar === 0) || guardando;

  const base = posicion === 'arriba' ? 'top-0 border-b' : 'bottom-0 border-t mt-2';

  return (
    <div
      className={`sticky z-10 -mx-4 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:-mx-6 lg:px-6 ${base}`}
    >
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
              Deshacer
            </Button>
          )}

          <Button
            type="button"
            variant="brand"
            className="h-11 flex-1 sm:h-10 sm:flex-none"
            onClick={() => onGuardar(soloPresenteATodos)}
            disabled={bloqueado}
          >
            {guardando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : soloPresenteATodos ? (
              <UserCheck className="mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {soloPresenteATodos
              ? `Presentes a los ${sinMarcar} y guardar`
              : `Guardar${cambios > 0 ? ` ${cambios}` : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BarraGuardar;
