import { Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dinero } from '@/api/inscripciones';
import { nombreDeMes, type PagoListado } from '@/api/mensualidades';
import { enlaceWhatsApp, fechaHora } from '@/components/inscripciones/formato';

/**
 * Con quién hablar antes de rechazar o anular un pago (cliente, 2026-11-16):
 * el representante con teléfono, correo y WhatsApp, y lo que pagaba, hijo
 * por hijo y mes por mes, con el total y la fecha de envío.
 */
const ContactoPago = ({ pago }: { pago: PagoListado }) => {
  const whatsapp = pago.representante_telefono ? enlaceWhatsApp(pago.representante_telefono) : null;
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border p-3 text-sm">
        <p className="text-base font-semibold">{pago.representante_nombre ?? 'Cuenta borrada'}</p>
        {pago.representante_telefono && <p>Teléfono: {pago.representante_telefono}</p>}
        {pago.representante_correo && <p className="break-words">Correo: {pago.representante_correo}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {whatsapp && (
            <Button variant="outline" size="sm" asChild className="h-10 sm:h-9">
              <a href={whatsapp} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          )}
          {pago.representante_correo && (
            <Button variant="outline" size="sm" asChild className="h-10 sm:h-9">
              <a href={`mailto:${pago.representante_correo}`}>
                <Mail className="mr-2 h-4 w-4" /> Correo
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <ul className="divide-y">
          {pago.detalle.map((c) => (
            <li key={`${c.nino_id}-${c.mes}`} className="flex items-start justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{c.nombre}</p>
                <p className="text-muted-foreground">
                  Mensualidad {nombreDeMes(c.mes).toLowerCase()} · {c.col_nombre}
                </p>
              </div>
              <span className="whitespace-nowrap font-medium">{dinero(c.total)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t bg-muted/40 p-3">
          <span className="font-semibold">Total · enviado el {fechaHora(pago.fecha)}</span>
          <span className="text-lg font-bold">{dinero(pago.total)}</span>
        </div>
      </div>
    </div>
  );
};

export default ContactoPago;
