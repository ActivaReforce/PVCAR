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
import { useEliminarActividad, useImpactoActividad } from '@/hooks/useActividades';
import type { Actividad } from '@/api/actividades';

interface Props {
  actividad: Actividad | null;
  onClose: () => void;
  onEliminado: () => void;
}

const ETIQUETAS: Record<string, string> = {
  disciplinas_activas: 'disciplinas activas que la usan',
  disciplinas_de_baja: 'disciplinas dadas de baja que la usan',
};

const etiqueta = (clave: string) => ETIQUETAS[clave] ?? clave.replace(/_/g, ' ');

/**
 * Borrado de una actividad.
 *
 * Una actividad no tiene baja lógica: la que deja de impartirse simplemente se
 * queda sin disciplinas. Y si alguna disciplina la usa —aunque esté de baja—
 * no se borra: la clave foránea no lleva cascada y ese historial tiene que
 * seguir diciendo de qué actividad era.
 */
const EliminarActividadDialog = ({ actividad, onClose, onEliminado }: Props) => {
  const [confirmacion, setConfirmacion] = useState('');
  const impacto = useImpactoActividad(actividad?.act_id ?? null);
  const eliminar = useEliminarActividad();

  const coincide =
    confirmacion.trim().toLowerCase() === (actividad?.act_nombre ?? '').trim().toLowerCase();

  const bloqueos = Object.entries(impacto.data?.bloqueos ?? {});
  const puedeEliminar = impacto.data?.puedeEliminar ?? false;

  const cerrar = () => {
    setConfirmacion('');
    onClose();
  };

  const confirmar = async () => {
    if (!actividad) return;
    try {
      await eliminar.mutateAsync({ id: actividad.act_id, confirmacion });
      setConfirmacion('');
      onEliminado();
    } catch {
      // El hook ya muestra el motivo.
    }
  };

  return (
    <Dialog open={Boolean(actividad)} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Eliminar actividad
          </DialogTitle>
          <DialogDescription className="break-words">
            Vas a eliminar <strong>{actividad?.act_nombre}</strong> del catálogo.
            <strong> Esta acción no se puede deshacer.</strong>
          </DialogDescription>
        </DialogHeader>

        {impacto.isLoading && <p className="text-sm text-muted-foreground">Calculando…</p>}

        {impacto.data && !puedeEliminar && (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-medium">No se puede eliminar: hay disciplinas que la usan.</p>
            <ul className="list-disc pl-5 text-sm">
              {bloqueos.map(([clave, n]) => (
                <li key={clave}>
                  {n} {etiqueta(clave)}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Quita esas disciplinas desde su módulo. Si la actividad ya no se imparte pero su
              historial importa, déjala: no estorba y mantiene el nombre en los reportes.
            </p>
          </div>
        )}

        {impacto.data && puedeEliminar && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ninguna disciplina usa esta actividad, así que no se pierde ningún historial.
            </p>
            <div className="space-y-2">
              <Label htmlFor="confirmacion-actividad">
                Escribe <strong>{actividad?.act_nombre}</strong> para confirmar
              </Label>
              <Input
                id="confirmacion-actividad"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={confirmar}
            disabled={!puedeEliminar || !coincide || eliminar.isPending}
          >
            {eliminar.isPending ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EliminarActividadDialog;
