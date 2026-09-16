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
import { useDarDeBajaDisciplina, usePrevioBaja } from '@/hooks/useDisciplinas';
import type { Disciplina } from '@/api/disciplinas';

interface Props {
  disciplina: Disciplina | null;
  onClose: () => void;
  onHecho: () => void;
}

/**
 * Baja de una disciplina.
 *
 * Es la operación de todos los días: una disciplina usada no se puede borrar
 * —las cuatro tablas que cuelgan de ella no tienen cascada— así que dejar de
 * impartirla es darla de baja.
 *
 * Arrastra cosas, y por eso el recuento va delante: cierra las inscripciones
 * activas y las asignaciones de entrenador abiertas. Sin eso, el alumno
 * seguiría inscrito en algo que ya no existe y el entrenador la seguiría
 * viendo en su alcance.
 */
const BajaDisciplinaDialog = ({ disciplina, onClose, onHecho }: Props) => {
  const previo = usePrevioBaja(disciplina?.colacthor_id ?? null);
  const baja = useDarDeBajaDisciplina();

  const confirmar = async () => {
    if (!disciplina) return;
    try {
      await baja.mutateAsync(disciplina.colacthor_id);
      onHecho();
    } catch {
      // El hook ya muestra el motivo.
    }
  };

  return (
    <Dialog open={Boolean(disciplina)} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Dar de baja la disciplina
          </DialogTitle>
          <DialogDescription className="break-words">
            <strong>{disciplina?.act_nombre}</strong> en {disciplina?.col_nombre},{' '}
            {disciplina?.dia_nombre.toLowerCase()} a las{' '}
            {disciplina?.colacthor_hora_inicio?.slice(0, 5)}. Dejará de aparecer en el calendario y
            en las pantallas de asistencia.
          </DialogDescription>
        </DialogHeader>

        {previo.isLoading && <p className="text-sm text-muted-foreground">Calculando…</p>}

        {previo.data && (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p className="font-medium">Al darla de baja:</p>
            <ul className="list-disc pl-5">
              <li>
                Se cerrarán <strong>{previo.data.inscripciones}</strong> inscripciones de alumnos
              </li>
              <li>
                Se cerrarán <strong>{previo.data.asignaciones}</strong> asignaciones de entrenador
              </li>
            </ul>
            <p className="text-muted-foreground">
              El historial —asistencias y evaluaciones— se conserva. Si la reactivas, las
              inscripciones <strong>no</strong> se reabren: hay que volver a inscribir.
            </p>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={baja.isPending}>
            {baja.isPending ? 'Dando de baja…' : 'Dar de baja'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BajaDisciplinaDialog;
