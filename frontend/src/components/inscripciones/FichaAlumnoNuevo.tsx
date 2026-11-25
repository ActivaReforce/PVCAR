import { Mail, MessageCircle, Phone, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFichaDeNuevo } from '@/hooks/useInscripciones';
import Fila from './Fila';
import { enlaceWhatsApp, fechaCorta, fechaHora, fechaNacimiento, resumenConstancia, siNo } from './formato';

/**
 * Ficha de un alumno nuevo para el coordinador (cliente, 2026-11-18): lo que
 * le sirve para recibirlo —datos, contactos, salud, uso de imagen y lo que
 * aceptó— sin comprobante, montos, factura ni PDF. Solo lectura.
 */
const FichaAlumnoNuevo = ({ id, onClose }: { id: number | null; onClose: () => void }) => {
  const ficha = useFichaDeNuevo(id);
  const f = ficha.data;
  const d = f?.alumno.datos;
  const whatsapp = f ? enlaceWhatsApp(f.representante.telefono) : null;

  return (
    <Dialog open={id !== null} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="break-words pr-6 text-lg sm:text-xl">{d?.nombre ?? 'Alumno'}</DialogTitle>
          <DialogDescription>
            {f
              ? [f.alumno.curso, f.alumno.colegio].filter(Boolean).join(' · ') +
                (f.ins_fecha_aprobacion ? ` · entró el ${fechaCorta(f.ins_fecha_aprobacion)}` : '')
              : 'Cargando…'}
          </DialogDescription>
        </DialogHeader>

        {ficha.isError && (
          <p className="text-destructive">No se pudo cargar: {(ficha.error as Error).message}</p>
        )}

        {f && d && (
          <div className="space-y-6">
            {d.observacion_extra && (
              <div className="rounded-md border-2 border-amber-500 bg-amber-500/5 p-3 dark:border-amber-400">
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  <StickyNote className="h-4 w-4 flex-shrink-0" /> Observaciones extra
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{d.observacion_extra}</p>
              </div>
            )}

            <section className="space-y-3">
              <h3 className="font-semibold">Alumno</h3>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Fila etiqueta="Nacimiento">{fechaNacimiento(d.fecha_nacimiento)}</Fila>
                <Fila etiqueta="Parentesco">{d.parentesco}</Fila>
                <Fila etiqueta="Curso">{f.alumno.curso ?? '—'}</Fila>
                <Fila etiqueta="Colegio">{f.alumno.colegio ?? '—'}</Fila>
                <Fila etiqueta="Salida">
                  {d.modalidad_salida === 'escolar' ? 'Transporte escolar' : 'Transporte privado'}
                </Fila>
                {d.detalle_retiro && <Fila etiqueta="Detalle del retiro">{d.detalle_retiro}</Fila>}
              </dl>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Fila etiqueta="Salud">
                  {d.salud.tiene
                    ? d.salud.autoriza
                      ? d.salud.detalle
                      : 'Indicó que sí, pero no autorizó guardarla'
                    : 'Sin condiciones'}
                </Fila>
                <Fila etiqueta="Uso de imagen">
                  Familias {siNo(d.imagen.familias)} · Redes {siNo(d.imagen.redes)} · Promocional{' '}
                  {siNo(d.imagen.promocional)}
                </Fila>
                <Fila etiqueta="Contacto de emergencia">
                  {d.emergencia.nombre} ({d.emergencia.relacion}) · {d.emergencia.telefono}
                </Fila>
                <Fila etiqueta="Autorizado para retirarlo">
                  {d.retiro
                    ? `${d.retiro.nombre} (${d.retiro.relacion}) · C.C. ${d.retiro.cedula} · ${d.retiro.telefono}`
                    : 'No indicó a nadie'}
                </Fila>
              </dl>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Disciplinas</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {f.alumno.disciplinas.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">Representante</h3>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Fila etiqueta="Nombre">{f.representante.nombre}</Fila>
                <Fila etiqueta="Cédula">{f.representante.cedula}</Fila>
                <Fila etiqueta="Correo">{f.representante.correo}</Fila>
                <Fila etiqueta="Teléfono">{f.representante.telefono}</Fila>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild className="h-10 sm:h-9">
                  <a href={`tel:${f.representante.telefono.replace(/[^\d+]/g, '')}`}>
                    <Phone className="mr-2 h-4 w-4" /> Llamar
                  </a>
                </Button>
                {whatsapp && (
                  <Button variant="outline" size="sm" asChild className="h-10 sm:h-9">
                    <a href={whatsapp} target="_blank" rel="noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild className="h-10 sm:h-9">
                  <a href={`mailto:${f.representante.correo}`}>
                    <Mail className="mr-2 h-4 w-4" /> Correo
                  </a>
                </Button>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Lo que aceptó</h3>
              <ul className="space-y-1.5 text-sm">
                {f.alumno.constancias.map((c) => (
                  <li key={c.tipo} className="min-w-0">
                    <span className="font-medium">{c.nombre}</span>
                    <span className="text-muted-foreground"> · {resumenConstancia(c)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Enviada el {fechaHora(f.ins_fecha)}.</p>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FichaAlumnoNuevo;
