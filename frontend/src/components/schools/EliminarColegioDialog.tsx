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
import { useEliminarColegio, useImpactoColegio } from '@/hooks/useColegios';
import type { ColegioListado } from '@/api/colegios';

interface Props {
  colegio: ColegioListado | null;
  onClose: () => void;
  onEliminado: () => void;
}

/**
 * Borrado permanente de un colegio.
 *
 * Un colegio no tiene baja logica —la tabla no tiene estado— asi que o esta
 * vacio y se va, o tiene historial y no se borra.
 *
 * El sistema viejo intentaba el DELETE y traducia el error de clave foranea a
 * "No puede eliminar el colegio si existen disciplinas en este colegio": no
 * decia cuantas, ni mencionaba a los alumnos ni las asistencias, que tambien
 * lo impiden. Aqui el recuento llega antes de confirmar.
 */
const ETIQUETAS: Record<string, string> = {
  coordinadores: 'asignaciones de coordinador',
  disciplinas: 'disciplinas',
  estudiantes: 'alumnos matriculados',
  asistencias_entrenador: 'asistencias de entrenadores',
  asistencias_auxiliar: 'asistencias de auxiliares',
};

const etiqueta = (clave: string) => ETIQUETAS[clave] ?? clave.replace(/_/g, ' ');

const EliminarColegioDialog = ({ colegio, onClose, onEliminado }: Props) => {
  const [confirmacion, setConfirmacion] = useState('');
  const impacto = useImpactoColegio(colegio?.col_id ?? null);
  const eliminar = useEliminarColegio();

  const nombreCoincide =
    confirmacion.trim().toLowerCase() === (colegio?.col_nombre ?? '').trim().toLowerCase();

  const bloqueos = Object.entries(impacto.data?.bloqueos ?? {});
  const aEliminar = Object.entries(impacto.data?.eliminables ?? {}).filter(([, n]) => n > 0);
  const puedeEliminar = impacto.data?.puedeEliminar ?? false;

  const cerrar = () => {
    setConfirmacion('');
    onClose();
  };

  const confirmar = async () => {
    if (!colegio) return;
    try {
      await eliminar.mutateAsync({ id: colegio.col_id, confirmacion });
      setConfirmacion('');
      onEliminado();
    } catch {
      // El hook ya muestra el motivo; el modal se queda abierto.
    }
  };

  return (
    <Dialog open={Boolean(colegio)} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Eliminar colegio
          </DialogTitle>
          <DialogDescription className="break-words">
            Vas a eliminar <strong>{colegio?.col_nombre}</strong>.
            <strong> Esta acción no se puede deshacer.</strong>
          </DialogDescription>
        </DialogHeader>

        {impacto.isLoading && <p className="text-sm text-muted-foreground">Calculando…</p>}

        {impacto.data && !puedeEliminar && (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-medium">No se puede eliminar: el colegio tiene datos.</p>
            <ul className="list-disc pl-5 text-sm">
              {bloqueos.map(([clave, n]) => (
                <li key={clave}>
                  {n} {etiqueta(clave)}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Hay que quitarlos primero: las disciplinas desde su módulo y los alumnos desde
              Estudiantes. Las asistencias son historial y no se borran.
            </p>
          </div>
        )}

        {impacto.data && puedeEliminar && (
          <div className="space-y-3">
            {aEliminar.length > 0 ? (
              <div className="rounded-md border p-3">
                <p className="mb-1 text-sm font-medium">Se eliminarán también:</p>
                <ul className="list-disc pl-5 text-sm">
                  {aEliminar.map(([clave, n]) => (
                    <li key={clave}>
                      {n} {etiqueta(clave)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                El colegio está vacío: no hay nada colgando de él.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirmacion-colegio">
                Escribe <strong>{colegio?.col_nombre}</strong> para confirmar
              </Label>
              <Input
                id="confirmacion-colegio"
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
            disabled={!puedeEliminar || !nombreCoincide || eliminar.isPending}
          >
            {eliminar.isPending ? 'Eliminando…' : 'Eliminar para siempre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EliminarColegioDialog;
