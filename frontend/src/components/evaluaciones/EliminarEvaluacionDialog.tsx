import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEliminarEvaluacion, useImpactoEvaluacion } from '@/hooks/useEvaluaciones';
import type { Evaluacion } from '@/api/evaluaciones';

interface Props {
  evaluacion: Evaluacion | null;
  onClose: () => void;
}

/**
 * Borrado permanente de una evaluación.
 *
 * Las cuatro tablas que cuelgan de `evaluacion` son ON DELETE CASCADE, así que
 * nada lo bloquea: se lleva parámetros, vínculos, las pendientes de todos los
 * alumnos y **los intentos ya puntuados**. Por eso el recuento va delante y hay
 * que escribir el título.
 *
 * El sistema viejo borraba primero los parámetros y luego la evaluación, en dos
 * peticiones sueltas desde el navegador: si fallaba la segunda, la evaluación
 * se quedaba sin parámetros y con sus alumnos pendientes de algo que ya no se
 * podía puntuar.
 */
const EliminarEvaluacionDialog = ({ evaluacion, onClose }: Props) => {
  const [confirmacion, setConfirmacion] = useState('');
  const impacto = useImpactoEvaluacion(evaluacion?.eva_id ?? null);
  const eliminar = useEliminarEvaluacion();

  const coincide =
    confirmacion.trim().toLowerCase() === (evaluacion?.eva_titulo ?? '').trim().toLowerCase();

  const aDestruir = Object.entries(impacto.data?.eliminables ?? {}).filter(([, n]) => n > 0);

  const cerrar = () => {
    setConfirmacion('');
    onClose();
  };

  const confirmar = async () => {
    if (!evaluacion) return;
    try {
      await eliminar.mutateAsync({ id: evaluacion.eva_id, confirmacion });
      cerrar();
    } catch {
      // El hook ya enseña el motivo.
    }
  };

  return (
    <Dialog open={Boolean(evaluacion)} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Eliminar evaluación
          </DialogTitle>
          <DialogDescription className="break-words">
            Vas a eliminar <strong>{evaluacion?.eva_titulo}</strong> y todo lo que cuelga de ella.
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        {impacto.isLoading && <p className="text-sm text-muted-foreground">Calculando…</p>}

        {impacto.data && (
          <div className="space-y-3">
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="mb-1 text-sm font-medium">Se eliminarán también:</p>
              {aDestruir.length > 0 ? (
                <ul className="list-disc pl-5 text-sm">
                  {aDestruir.map(([clave, n]) => (
                    <li key={clave}>
                      <strong>{n}</strong> {clave}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No tiene nada colgando: no se pierde nada más.
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                Si solo quieres que deje de usarse, <strong>dala de baja</strong>: se conserva todo
                y se puede reactivar.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmacion-evaluacion">
                Escribe <strong>{evaluacion?.eva_titulo}</strong> para confirmar
              </Label>
              <Input
                id="confirmacion-evaluacion"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                autoComplete="off"
                className="h-11 sm:h-10"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" className="h-11 sm:h-10" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="h-11 sm:h-10"
            onClick={confirmar}
            disabled={!coincide || eliminar.isPending}
          >
            {eliminar.isPending ? 'Eliminando…' : 'Eliminar para siempre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EliminarEvaluacionDialog;
