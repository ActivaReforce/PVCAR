import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  UserCheck,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import { useToast } from '@/hooks/use-toast';
import { useAprobarInscripcion, useFichaInscripcion } from '@/hooks/useInscripciones';
import {
  dinero,
  type ConstanciaDetalle,
  type InscripcionDetalle,
  type NinoDetalle,
} from '@/api/inscripciones';
import RechazarInscripcionDialog from './RechazarInscripcionDialog';
import { fechaCorta, fechaHora, fechaNacimiento, enlaceWhatsApp } from './formato';

interface Props {
  id: number | null;
  onClose: () => void;
}

/**
 * Ficha de una inscripción: todo lo que el Propietario necesita para decidir.
 *
 * Si algo está mal, la inscripción **se queda pendiente**: aquí están el
 * teléfono, el WhatsApp y el correo para hablar con el representante, y se
 * aprueba o se rechaza después (decisión del cliente, 2026-10-02).
 *
 * Los bloqueos los calcula el backend con las mismas reglas que usa al
 * aprobar, así que lo que se ve aquí es lo que pasaría al pulsar.
 */
const FichaInscripcion = ({ id, onClose }: Props) => {
  const ficha = useFichaInscripcion(id);
  const aprobar = useAprobarInscripcion();
  const { toast } = useToast();
  const [confirmarAprobacion, setConfirmarAprobacion] = useState(false);
  const [rechazando, setRechazando] = useState(false);

  const datos = ficha.data;

  const aprobarAhora = async () => {
    if (!datos) return;
    setConfirmarAprobacion(false);
    try {
      const r = await aprobar.mutateAsync(datos.ins_id);
      toast({
        title: 'Inscripción aprobada',
        description: r.correo_enviado
          ? `Se envió el correo de acceso a ${datos.ins_representante.correo}.`
          : `El correo NO salió. Avísale a ${datos.ins_representante.nombre} por teléfono: entra con su correo y ${r.cuenta_nueva ? 'su cédula como contraseña' : 'la contraseña que ya tenía'}.`,
        variant: r.correo_enviado ? 'default' : 'destructive',
      });
      onClose();
    } catch {
      // El hook ya muestra el motivo; la ficha queda abierta.
    }
  };

  return (
    <>
      <Dialog open={id !== null} onOpenChange={(abierto) => !abierto && onClose()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              Inscripción
              {datos && (
                <Badge variant={datos.ins_estado === 'pendiente' ? 'secondary' : 'default'}>
                  {datos.ins_estado === 'pendiente' ? 'Pendiente' : 'Aprobada'}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {datos ? `Recibida el ${fechaHora(datos.ins_fecha)}` : 'Cargando…'}
            </DialogDescription>
          </DialogHeader>

          {ficha.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {ficha.isError && (
            <p className="text-sm text-destructive">
              No se pudo cargar: {(ficha.error as Error).message}
            </p>
          )}

          {datos && <Contenido datos={datos} />}

          {datos && (
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
              <Button variant="outline" onClick={onClose} className="h-11 sm:h-10">
                Cerrar
              </Button>
              {datos.ins_estado === 'pendiente' && (
                <>
                  <ConditionalAction module="inscripciones" action="eliminar">
                    <Button
                      variant="outline"
                      className="h-11 border-destructive/50 text-destructive hover:bg-destructive/10 sm:h-10"
                      onClick={() => setRechazando(true)}
                    >
                      Rechazar
                    </Button>
                  </ConditionalAction>
                  <ConditionalAction module="inscripciones" action="editar">
                    <Button
                      className="h-11 sm:h-10"
                      disabled={datos.bloqueos.length > 0 || aprobar.isPending}
                      onClick={() => setConfirmarAprobacion(true)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {aprobar.isPending ? 'Aprobando…' : 'Aprobar'}
                    </Button>
                  </ConditionalAction>
                </>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarAprobacion} onOpenChange={setConfirmarAprobacion}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar la inscripción?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {datos && <ResumenAprobacion datos={datos} />}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aprobarAhora}>Aprobar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RechazarInscripcionDialog
        inscripcion={rechazando ? (datos ?? null) : null}
        onClose={() => setRechazando(false)}
        onRechazada={() => {
          setRechazando(false);
          onClose();
        }}
      />
    </>
  );
};

const ResumenAprobacion = ({ datos }: { datos: InscripcionDetalle }) => {
  const existente = datos.coincidencias.find((c) => c.por_correo);
  const n = datos.ninos.length;
  return (
    <>
      <p>
        {existente ? (
          <>
            <strong>{existente.usu_nombre}</strong> ya tiene cuenta: los alumnos se le añaden y entra
            con su contraseña de siempre.
          </>
        ) : (
          <>
            Se crea la cuenta de <strong>{datos.ins_representante.nombre}</strong>. Entra con{' '}
            <strong>{datos.ins_representante.correo}</strong> y su cédula como contraseña.
          </>
        )}
      </p>
      <p>
        Se {n === 1 ? 'crea 1 alumno' : `crean ${n} alumnos`} inscritos en sus disciplinas, y se le
        manda un correo avisándole.
      </p>
    </>
  );
};

const Fila = ({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</dt>
    <dd className="mt-0.5 break-words text-sm">{children}</dd>
  </div>
);

const Contenido = ({ datos }: { datos: InscripcionDetalle }) => {
  const rep = datos.ins_representante;
  const whatsapp = enlaceWhatsApp(rep.telefono);

  return (
    <div className="space-y-6">
      {datos.bloqueos.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
          <p className="mb-1 flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" /> No se puede aprobar todavía
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {datos.bloqueos.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {datos.ins_estado === 'pendiente' &&
        datos.coincidencias.length > 0 &&
        datos.bloqueos.length === 0 && (
          <div className="rounded-md border border-sky-600/40 bg-sky-600/5 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <UserCheck className="h-4 w-4" /> Representante que ya existe
            </p>
            <p className="mt-1 text-muted-foreground">
              {datos.coincidencias.map((c) => `${c.usu_nombre} (${c.usu_correo})`).join(', ')}. No se
              crea otra cuenta: los alumnos se le añaden. Como el formulario no pide iniciar sesión,
              confirma con esa persona que la inscripción es suya.
            </p>
          </div>
        )}

      <section className="space-y-3">
        <h3 className="font-semibold">Representante</h3>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Fila etiqueta="Nombre">{rep.nombre}</Fila>
          <Fila etiqueta="Cédula o pasaporte">{rep.cedula}</Fila>
          <Fila etiqueta="Correo">{rep.correo}</Fila>
          <Fila etiqueta="Teléfono">{rep.telefono}</Fila>
        </dl>
        <dl className="grid grid-cols-1 gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-2">
          <Fila etiqueta="Factura a nombre de">{rep.factura.nombre}</Fila>
          <Fila etiqueta="Cédula o RUC">{rep.factura.identificacion}</Fila>
          <Fila etiqueta="Correo para factura">{rep.factura.correo}</Fila>
          <Fila etiqueta="Dirección para factura">{rep.factura.direccion}</Fila>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild className="h-10 sm:h-9">
            <a href={`tel:${rep.telefono.replace(/[^\d+]/g, '')}`}>
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
            <a href={`mailto:${rep.correo}`}>
              <Mail className="mr-2 h-4 w-4" /> Correo
            </a>
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">
          Comprobante de pago
          {datos.ins_total !== null && (
            <span className="ml-2 font-normal text-muted-foreground">
              · debe cubrir {dinero(datos.ins_total)} al mes con IVA
            </span>
          )}
        </h3>
        {datos.comprobante_url ? (
          <a
            href={datos.comprobante_url}
            target="_blank"
            rel="noreferrer"
            className="block w-full max-w-sm overflow-hidden rounded-md border"
            title="Abrir en grande"
          >
            <img
              src={datos.comprobante_url}
              alt="Comprobante de pago"
              className="max-h-80 w-full bg-muted object-contain"
            />
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">No se pudo cargar la imagen.</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">
          {datos.ninos.length === 1 ? 'Alumno' : `Alumnos (${datos.ninos.length})`}
        </h3>
        {datos.ninos.map((n) => (
          <FichaNino key={n.insnino_id} n={n} pendiente={datos.ins_estado === 'pendiente'} />
        ))}
      </section>

      <section className="space-y-1 text-xs text-muted-foreground">
        <h3 className="text-sm font-semibold text-foreground">Aceptación</h3>
        <p>
          Aceptó los seis documentos de cada alumno el {fechaHora(datos.ins_fecha)}
          {datos.ins_ip && ` desde ${datos.ins_ip}`}. El detalle está en cada alumno y en la última hoja
          de su PDF.
        </p>
        {datos.ins_estado === 'aprobada' && datos.ins_fecha_aprobacion && (
          <p>
            Aprobada el {fechaCorta(datos.ins_fecha_aprobacion)}
            {datos.aprobada_por_nombre && ` por ${datos.aprobada_por_nombre}`}.
          </p>
        )}
      </section>
    </div>
  );
};

const siNo = (v: unknown) => (v ? 'Sí' : 'No');

/** Lo que marcó en cada documento, en corto. */
function resumenConstancia(c: ConstanciaDetalle): string {
  const o = c.opciones;
  if (c.tipo === 'datos_medicos') return `Condición: ${siNo(o.tiene)} · Autoriza: ${siNo(o.autoriza)}`;
  if (c.tipo === 'imagen') {
    return `Familias: ${siNo(o.familias)} · Redes: ${siNo(o.redes)} · Promocional: ${siNo(o.promocional)}`;
  }
  return 'Aceptado';
}

const FichaNino = ({ n, pendiente }: { n: NinoDetalle; pendiente: boolean }) => {
  const d = n.datos;
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{d.nombre}</p>
        {n.paquete_url && (
          <Button variant="outline" size="sm" asChild className="h-10 sm:h-9">
            <a href={n.paquete_url} target="_blank" rel="noreferrer">
              <FileText className="mr-2 h-4 w-4" /> Documentos (PDF)
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Fila etiqueta="Nacimiento">{fechaNacimiento(d.fecha_nacimiento)}</Fila>
        <Fila etiqueta="Parentesco">{d.parentesco}</Fila>
        <Fila etiqueta="Curso">{n.grado ?? d.documento.curso ?? '—'}</Fila>
        <Fila etiqueta="Colegio">{n.colegio ?? d.documento.colegio.sede}</Fila>
        <Fila etiqueta="Salida">
          {d.modalidad_salida === 'escolar' ? 'Transporte escolar' : 'Transporte privado'}
        </Fila>
        {d.detalle_retiro && <Fila etiqueta="Detalle del retiro">{d.detalle_retiro}</Fila>}
      </dl>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Fila etiqueta="Contacto de emergencia">
          {d.emergencia.nombre} ({d.emergencia.relacion}) · {d.emergencia.telefono}
        </Fila>
        <Fila etiqueta="Autorizado para retirarlo">
          {d.retiro
            ? `${d.retiro.nombre} (${d.retiro.relacion}) · C.C. ${d.retiro.cedula} · ${d.retiro.telefono}`
            : 'No indicó a nadie'}
        </Fila>
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
      </dl>
      {n.cobro && (
        <p className="text-sm">
          {n.cobro.disciplinas} × {dinero(n.cobro.precio_disciplina)} = {dinero(n.cobro.subtotal)}
          {n.cobro.descuento > 0 &&
            ` − ${n.cobro.descuento_pct} % hermano en ${n.cobro.disciplinas_con_descuento} (${dinero(n.cobro.descuento)})`}{' '}
          + IVA {n.cobro.iva_pct} % ({dinero(n.cobro.iva)}) → <strong>{dinero(n.cobro.total_con_iva)}</strong>
        </p>
      )}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Disciplinas</p>
        <ul className="mt-1 space-y-1 text-sm">
          {n.disciplinas.map((x) => (
            <li key={x.colacthor_id} className={x.disponible ? '' : 'text-destructive'}>
              {x.descripcion}
              {!x.disponible && pendiente && ' — ya no disponible'}
            </li>
          ))}
        </ul>
      </div>
      <details className="rounded-md bg-muted/40 p-2 text-xs">
        <summary className="cursor-pointer font-medium">Constancia de los seis documentos</summary>
        <ul className="mt-2 space-y-1.5">
          {n.constancias.map((c) => (
            <li key={c.tipo} className="min-w-0">
              <span className="font-medium">
                {c.nombre} v{c.version}
              </span>{' '}
              · {resumenConstancia(c)}
              <span className="block break-all font-mono text-[11px] text-muted-foreground">{c.sha256}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
};

export default FichaInscripcion;
