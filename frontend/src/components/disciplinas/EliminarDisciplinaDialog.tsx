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
import { useEliminarDisciplina, useImpactoDisciplina } from '@/hooks/useDisciplinas';
import type { Disciplina } from '@/api/disciplinas';

interface Props {
  disciplina: Disciplina | null;
  onClose: () => void;
  onEliminado: () => void;
}

const ETIQUETAS: Record<string, string> = {
  inscripciones: 'inscripciones de alumnos (incluidas las cerradas)',
  asignaciones: 'asignaciones de entrenador (incluidas las cerradas)',
  evaluaciones: 'evaluaciones asignadas',
  asistencias: 'asistencias registradas',
};

const etiqueta = (clave: string) => ETIQUETAS[clave] ?? clave.replace(/_/g, ' ');

/**
 * Borrado permanente de una disciplina.
 *
 * Solo sirve para las creadas por error: en cuanto alguien se inscribe, se le
 * asigna un entrenador o se registra una asistencia, la disciplina queda atada
 * para siempre y lo que corresponde es la baja. El recuento lo dice con
 * números en vez de dejar que reviente una clave foránea, que es lo que hacía
 * el sistema viejo ("revise que no tenga nada atado").
 */
const EliminarDisciplinaDialog = ({ disciplina, onClose, onEliminado }: Props) => {
  const [confirmacion, setConfirmacion] = useState('');
  const impacto = useImpactoDisciplina(disciplina?.colacthor_id ?? null);
  const eliminar = useEliminarDisciplina();

  const coincide =
    confirmacion.trim().toLowerCase() === (disciplina?.act_nombre ?? '').trim().toLowerCase();

  const bloqueos = Object.entries(impacto.data?.bloqueos ?? {});
  const puedeEliminar = impacto.data?.puedeEliminar ?? false;

  const cerrar = () => {
    setConfirmacion('');
    onClose();
  };

  const confirmar = async () => {
    if (!disciplina) return;
    try {
      await eliminar.mutateAsync({ id: disciplina.colacthor_id, confirmacion });
      setConfirmacion('');
      onEliminado();
    } catch {
      // El hook ya muestra el motivo.
    }
  };

  return (
    <Dialog open={Boolean(disciplina)} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Eliminar disciplina
          </DialogTitle>
          <DialogDescription className="break-words">
            <strong>{disciplina?.act_nombre}</strong> en {disciplina?.col_nombre},{' '}
            {disciplina?.dia_nombre.toLowerCase()}.
            <strong> Esta acción no se puede deshacer.</strong>
          </DialogDescription>
        </DialogHeader>

        {impacto.isLoading && <p className="text-sm text-muted-foreground">Calculando…</p>}

        {impacto.data && !puedeEliminar && (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-medium">No se puede eliminar: tiene historial.</p>
            <ul className="list-disc pl-5 text-sm">
              {bloqueos.map(([clave, n]) => (
                <li key={clave}>
                  {n} {etiqueta(clave)}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Déjala de baja: deja de impartirse y el historial se conserva.
            </p>
          </div>
        )}

        {impacto.data && puedeEliminar && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nadie se inscribió ni se registró nada en ella: no se pierde historial.
            </p>
            <div className="space-y-2">
              <Label htmlFor="confirmacion-disciplina">
                Escribe <strong>{disciplina?.act_nombre}</strong> para confirmar
              </Label>
              <Input
                id="confirmacion-disciplina"
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
            {eliminar.isPending ? 'Eliminando…' : 'Eliminar para siempre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EliminarDisciplinaDialog;
