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
import { useEliminarEstudiante, useImpactoEstudiante } from '@/hooks/useEstudiantes';
import type { Estudiante } from '@/api/estudiantes';

interface Props {
  estudiante: Estudiante | null;
  onClose: () => void;
  onEliminado: () => void;
}

const ETIQUETAS: Record<string, string> = {
  inscripciones: 'inscripciones (activas e históricas)',
  asistencias: 'asistencias registradas',
  evaluaciones: 'evaluaciones asignadas',
  intentos: 'intentos de evaluación',
  representantes: 'vínculos con representantes',
};

const etiqueta = (clave: string) => ETIQUETAS[clave] ?? clave.replace(/_/g, ' ');

/**
 * Borrado permanente de un estudiante.
 *
 * Aquí **nada lo bloquea**: las tres claves foráneas que apuntan a `nino` son
 * ON DELETE CASCADE y desde las inscripciones la cascada sigue hasta las
 * evaluaciones y sus intentos. Se lleva el historial entero.
 *
 * Es lo que el cliente pidió, y exactamente por eso el recuento va delante con
 * números concretos: en el sistema viejo el borrado ocurría en silencio,
 * porque el código solo preveía un error de clave foránea que con estas reglas
 * nunca llega a producirse.
 */
const EliminarEstudianteDialog = ({ estudiante, onClose, onEliminado }: Props) => {
  const [confirmacion, setConfirmacion] = useState('');
  const impacto = useImpactoEstudiante(estudiante?.nino_id ?? null);
  const eliminar = useEliminarEstudiante();

  const coincide =
    confirmacion.trim().toLowerCase() === (estudiante?.nino_nombre ?? '').trim().toLowerCase();

  const aDestruir = Object.entries(impacto.data?.eliminables ?? {}).filter(([, n]) => n > 0);

  const cerrar = () => {
    setConfirmacion('');
    onClose();
  };

  const confirmar = async () => {
    if (!estudiante) return;
    try {
      await eliminar.mutateAsync({ id: estudiante.nino_id, confirmacion });
      setConfirmacion('');
      onEliminado();
    } catch {
      // El hook ya muestra el motivo.
    }
  };

  return (
    <Dialog open={Boolean(estudiante)} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Eliminar estudiante
          </DialogTitle>
          <DialogDescription className="break-words">
            Vas a eliminar a <strong>{estudiante?.nino_nombre}</strong> y{' '}
            <strong>todo su historial</strong>. Esta acción no se puede deshacer.
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
                      <strong>{n}</strong> {etiqueta(clave)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No tiene historial: no se pierde nada más.
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                Si solo quieres que deje de asistir, <strong>dalo de baja</strong>: el historial se
                conserva y se puede reactivar.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmacion-estudiante">
                Escribe <strong>{estudiante?.nino_nombre}</strong> para confirmar
              </Label>
              <Input
                id="confirmacion-estudiante"
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
            disabled={!coincide || eliminar.isPending}
          >
            {eliminar.isPending ? 'Eliminando…' : 'Eliminar para siempre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EliminarEstudianteDialog;
