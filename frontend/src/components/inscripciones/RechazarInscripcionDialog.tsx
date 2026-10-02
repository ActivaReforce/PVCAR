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
import { useRechazarInscripcion } from '@/hooks/useInscripciones';
import type { InscripcionDetalle } from '@/api/inscripciones';

interface Props {
  inscripcion: InscripcionDetalle | null;
  onClose: () => void;
  onRechazada: () => void;
}

const sinTildes = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Rechazar = borrar, como si nunca se hubiera inscrito (decisión del
 * cliente). Como todos los borrados permanentes del sistema, se escribe el
 * nombre para confirmar.
 *
 * Al estar pendiente no se creó nada fuera de la inscripción: lo que se
 * pierde es lo que el representante envió (datos, contratos y comprobante).
 */
const RechazarInscripcionDialog = ({ inscripcion, onClose, onRechazada }: Props) => {
  const [confirmacion, setConfirmacion] = useState('');
  const rechazar = useRechazarInscripcion();

  const nombre = inscripcion?.ins_representante.nombre ?? '';
  const coincide = sinTildes(confirmacion) === sinTildes(nombre) && nombre.length > 0;
  const ninos = inscripcion?.ninos.length ?? 0;

  const cerrar = () => {
    setConfirmacion('');
    onClose();
  };

  const confirmar = async () => {
    if (!inscripcion) return;
    try {
      await rechazar.mutateAsync({ id: inscripcion.ins_id, confirmacion });
      setConfirmacion('');
      onRechazada();
    } catch {
      // El hook ya muestra el motivo.
    }
  };

  return (
    <Dialog open={inscripcion !== null} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Rechazar inscripción
          </DialogTitle>
          <DialogDescription className="break-words">
            Se borra todo lo que envió <strong>{nombre}</strong>, como si nunca se hubiera inscrito.
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="mb-1 font-medium">Se eliminan:</p>
            <ul className="list-disc pl-5">
              <li>
                Los datos de <strong>{ninos}</strong> {ninos === 1 ? 'alumno' : 'alumnos'} y del
                representante
              </li>
              <li>
                {ninos === 1 ? 'El contrato firmado' : `Los ${ninos} contratos firmados`}
              </li>
              <li>El comprobante de pago</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Si solo falta corregir algo, déjala pendiente y contacta al representante.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmacion-inscripcion">
              Escribe <strong>{nombre}</strong> para confirmar
            </Label>
            <Input
              id="confirmacion-inscripcion"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={confirmar}
            disabled={!coincide || rechazar.isPending}
          >
            {rechazar.isPending ? 'Rechazando…' : 'Rechazar y borrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RechazarInscripcionDialog;
