import { useState } from 'react';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';
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
import { useAnularPago } from '@/hooks/useMensualidades';
import { dinero } from '@/api/inscripciones';
import { mesesCortos, nombreDeMes, type PagoListado } from '@/api/mensualidades';
import { fechaDia } from '@/lib/fecha';
import ContactoPago from './ContactoPago';

interface Props {
  pago: PagoListado | null;
  onClose: () => void;
  onAnulado: () => void;
}

const sinTildes = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Anular un pago de mensualidad ya aprobado (cliente, 2026-11-16), con la
 * misma forma que Anular inscripción: qué se borra, qué más pasa y el nombre
 * del representante escrito a mano. El efecto es el de rechazar: el pago se
 * borra con su comprobante como si nunca se hubiera subido, sus meses vuelven
 * a deberse y no queda registro. Solo el Propietario.
 */
const AnularPagoDialog = ({ pago, onClose, onAnulado }: Props) => {
  const [confirmacion, setConfirmacion] = useState('');
  const anular = useAnularPago();

  const nombre = pago?.representante_nombre ?? '';
  const coincide = nombre.length > 0 && sinTildes(confirmacion) === sinTildes(nombre);

  const cerrar = () => {
    setConfirmacion('');
    onClose();
  };

  const confirmar = async () => {
    if (!pago) return;
    try {
      await anular.mutateAsync({ id: pago.menpag_id, confirmacion });
      setConfirmacion('');
      onAnulado();
    } catch {
      // El hook ya muestra el motivo.
    }
  };

  const porHijo = pago
    ? [...new Set(pago.detalle.map((c) => c.nombre))].map((n) => ({
        nombre: n,
        meses: pago.detalle.filter((c) => c.nombre === n).map((c) => c.mes),
      }))
    : [];
  // El mes del pago en hora de Ecuador: el 30 a las 21:00 en UTC ya es el mes siguiente.
  const [, mesEc, anoEc] = pago ? fechaDia(pago.fecha).split('/') : [];
  const mesDelPago = mesEc && anoEc ? nombreDeMes(`${anoEc}-${mesEc}-01`).toLowerCase() : '';

  return (
    <Dialog open={pago !== null} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Anular pago de mensualidad
          </DialogTitle>
          <DialogDescription className="break-words">
            Es para que <strong>{nombre || 'el representante'}</strong> vuelva a pagar estos meses. El pago se borra como
            si nunca se hubiera subido. No se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        {pago && (
          <div className="space-y-3 text-sm">
            <ContactoPago pago={pago} />

            <section className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="mb-1 flex items-center gap-1.5 font-medium">
                <Trash2 className="h-4 w-4 text-destructive" /> Se borra para siempre
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  El pago de <strong>{dinero(pago.total)}</strong> y la foto del comprobante.
                </li>
                {porHijo.map((h) => (
                  <li key={h.nombre}>
                    De <strong>{h.nombre}</strong>: {h.meses.length === 1 ? 'la mensualidad de' : 'las mensualidades de'}{' '}
                    {mesesCortos(h.meses)}, que vuelven a quedar por pagar.
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-md border p-3 text-muted-foreground">
              <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <Info className="h-4 w-4" /> Además
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Sus <strong>{dinero(pago.total)}</strong> dejan de contar en el Recaudado de {mesDelPago} y en el
                  reporte de Mensualidades.
                </li>
                <li>
                  Si alguno de esos meses ya pasó su día límite, el alumno queda <strong>ausente</strong> en
                  Asistencias hasta que vuelva a pagar. Las asistencias ya guardadas no cambian.
                </li>
                <li>No queda registro de la anulación.</li>
                <li>
                  <strong>No se le avisa</strong> al representante: avísale tú (y devuélvele el pago si corresponde).
                </li>
              </ul>
            </section>

            <div className="space-y-2">
              <Label htmlFor="confirmacion-anular-pago">
                Escribe <strong>{nombre}</strong> para confirmar
              </Label>
              <Input
                id="confirmacion-anular-pago"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" onClick={cerrar} className="h-11 sm:h-10">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="h-11 sm:h-10"
            onClick={confirmar}
            disabled={!pago || !coincide || anular.isPending}
          >
            {anular.isPending ? 'Anulando…' : 'Anular pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AnularPagoDialog;
