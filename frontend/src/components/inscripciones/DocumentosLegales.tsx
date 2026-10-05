import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileDown, History, Save, Send, Trash2 } from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import {
  useBorrarBorrador,
  useDocumentoLegal,
  useDocumentosLegales,
  useGuardarBorrador,
  usePublicarDocumento,
} from '@/hooks/useInscripciones';
import {
  inscripcionesApi,
  NOMBRE_DOCUMENTO,
  TIPOS_DOCUMENTO,
  type Documentos,
  type TipoDocumento,
} from '@/api/inscripciones';
import { ApiError } from '@/lib/api';
import DocumentoVista from './DocumentoVista';
import { REGLAS, problemasDePlantilla, type DatosDocumento } from './documento';
import { fechaCorta } from './formato';

/**
 * Los seis documentos de la inscripción (decisión del cliente, 2026-10-05):
 * los cuatro "00" (política, autorización de datos, salud, imagen) se leen y
 * se aceptan; la ficha ("01") se llena; el contrato ("02") se llena solo.
 *
 * **Una plantilla por documento para todos los colegios**: lo que cambia de
 * un colegio a otro entra con marcadores ({{sede}}, {{tarifa}}…) desde
 * Colegios y precios.
 *
 * Cada tipo tiene una versión **vigente** y como mucho un **borrador**. Al
 * publicar queda congelada para siempre —la base lo impide— y es lo que
 * acepta quien se inscriba desde ese momento. Un tipo sin texto arranca con
 * el de su Word.
 */
const DocumentosLegales = () => {
  const documentos = useDocumentosLegales();
  const { toast } = useToast();
  const [bajando, setBajando] = useState(false);

  if (documentos.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (documentos.isError || !documentos.data) {
    return (
      <p className="text-sm text-destructive">
        No se pudieron cargar los documentos: {(documentos.error as Error | null)?.message}
      </p>
    );
  }

  const sinPublicar = TIPOS_DOCUMENTO.filter((t) => !documentos.data.vigentes.some((v) => v.doc_tipo === t));

  const verEjemplo = async () => {
    setBajando(true);
    try {
      await inscripcionesApi.ejemploPaquete();
    } catch (err) {
      toast({
        title: 'No se pudo generar el ejemplo',
        description: err instanceof ApiError ? err.message : 'Error inesperado',
        variant: 'destructive',
      });
    } finally {
      setBajando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-sm">
          {sinPublicar.length > 0 ? (
            <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                El formulario no se abre hasta que estén publicados los seis. Faltan:{' '}
                {sinPublicar.map((t) => NOMBRE_DOCUMENTO[t]).join(', ')}.
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground">Los seis están publicados.</p>
          )}
        </div>
        <Button variant="outline" className="h-11 sm:h-10" onClick={verEjemplo} disabled={bajando}>
          <FileDown className="mr-2 h-4 w-4" />
          {bajando ? 'Generando…' : 'PDF de ejemplo'}
        </Button>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        El PDF de ejemplo es el de un alumno ficticio con lo guardado de cada documento (el borrador si lo
        hay). Es el mismo generador que el de verdad.
      </p>

      {TIPOS_DOCUMENTO.map((tipo) => (
        <PanelDocumento key={tipo} tipo={tipo} datos={documentos.data} />
      ))}
    </div>
  );
};

/** El alumno ficticio de la vista previa. Los mismos datos que el PDF de ejemplo. */
const EJEMPLO: DatosDocumento = {
  valores: {
    fecha: new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(new Date()),
    representante_nombre: 'María José Pérez Andrade',
    representante_cedula: '1712345678',
    alumno_nombre: 'Martín Pérez Andrade',
    sede: 'Colegio CRISFE Carcelén',
    sede_corta: 'Carcelén',
    institucion: 'CRISFE',
    minimo_alumnos: '14',
    tarifa: 'USD 32,10',
    descuento_hermano: '20 %',
    iva: '15 %',
  },
  representante: {
    nombre: 'María José Pérez Andrade',
    cedula: '1712345678',
    telefono: '0991234567',
    factura: {
      nombre: 'María José Pérez Andrade',
      identificacion: '1712345678001',
      correo: 'facturas.perez@ejemplo.com',
      direccion: 'Av. de los Shyris N35-17, Quito',
    },
    aplicaDescuento: 'No',
  },
  alumno: {
    nombre: 'Martín Pérez Andrade',
    fecha_nacimiento: '14 de mayo de 2016',
    curso: '4to de Básica',
    actividades: 'Fútbol',
    horarios: 'Fútbol: Martes 16:00 a 17:00; Fútbol: Jueves 16:00 a 17:00',
    emergencia: { nombre: 'Jorge Andrade Salas', relacion: 'Abuelo', telefono: '0987654321' },
    retiro: { nombre: 'Lucía Pérez Andrade', cedula: '1723456789', relacion: 'Tía', telefono: '0998877665' },
    modalidad_salida: 'privado',
    detalle_retiro: 'Lo retira su tía en la puerta principal.',
    salud: { tiene: true, detalle: 'Alergia leve al maní.', autoriza: true },
    imagen: { familias: true, redes: false, promocional: false },
  },
  fechaFirma: 'fecha y hora del envío',
  aprobacion: 'Aprobado por (quien aprueba) el (fecha)',
};

/** Las piezas que lleva cada documento, explicadas para quien edita. */
function ayudaDePiezas(tipo: TipoDocumento): string[] {
  const r = REGLAS[tipo];
  const ayuda: string[] = [];
  for (const c of r.casillas) ayuda.push(`[casilla ${c}] y el texto de la casilla`);
  if (r.salud) ayuda.push('[salud] y la pregunta: debajo salen No / Sí. Especifique');
  for (const s of r.datos) ayuda.push(`[datos ${s}]: la tabla de la sección`);
  for (const f of r.firmas) {
    ayuda.push(
      f === 'activa'
        ? '[firma activa] y debajo, en líneas, el nombre y cargo'
        : '[firma representante]: "Aceptado electrónicamente" con su nombre, C.C. y fecha',
    );
  }
  if (r.politica) ayuda.push('[politica] y el texto del enlace a la política');
  return ayuda;
}

const PanelDocumento = ({ tipo, datos }: { tipo: TipoDocumento; datos: Documentos }) => {
  const { hasPermission } = usePermissions();
  const puedeEditar = hasPermission('inscripciones', 'editar');

  const vigente = datos.vigentes.find((d) => d.doc_tipo === tipo);
  const borrador = datos.borradores.find((d) => d.doc_tipo === tipo);
  const anteriores = datos.historial.filter((h) => h.doc_tipo === tipo && h.doc_id !== vigente?.doc_id);
  const aceptaciones = datos.historial.find((h) => h.doc_id === vigente?.doc_id)?.aceptaciones ?? 0;
  const base = borrador ?? vigente;
  const inicial = datos.iniciales[tipo];

  const [titulo, setTitulo] = useState(base?.doc_titulo ?? inicial.titulo);
  const [contenido, setContenido] = useState(base?.doc_contenido ?? inicial.contenido);
  const [confirmarPublicar, setConfirmarPublicar] = useState(false);
  const [viendo, setViendo] = useState<number | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  // Cuando cambia lo guardado (se guardó, publicó o descartó), el editor parte de ahí.
  const claveBase = `${base?.doc_id ?? 0}-${base?.doc_fecha ?? ''}`;
  useEffect(() => {
    setTitulo(base?.doc_titulo ?? inicial.titulo);
    setContenido(base?.doc_contenido ?? inicial.contenido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveBase]);

  const guardar = useGuardarBorrador();
  const publicar = usePublicarDocumento();
  const descartar = useBorrarBorrador();

  const sinCambios = base !== undefined && base.doc_titulo === titulo.trim() && base.doc_contenido === contenido;
  const valido = titulo.trim().length >= 3 && contenido.trim().length >= 20;
  const problemas = problemasDePlantilla(tipo, contenido, datos.marcadores);

  const insertar = (clave: string) => {
    const marca = `{{${clave}}}`;
    const el = area.current;
    if (!el) {
      setContenido((c) => c + marca);
      return;
    }
    const inicio = el.selectionStart ?? contenido.length;
    const fin = el.selectionEnd ?? contenido.length;
    setContenido(contenido.slice(0, inicio) + marca + contenido.slice(fin));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(inicio + marca.length, inicio + marca.length);
    });
  };

  const publicarAhora = async () => {
    if (!borrador) return;
    try {
      await publicar.mutateAsync(borrador.doc_id);
    } catch {
      // El hook ya muestra el motivo.
    }
  };

  return (
    <section className="space-y-4 rounded-lg border p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{NOMBRE_DOCUMENTO[tipo]}</h2>
          <p className="text-sm text-muted-foreground">
            {vigente
              ? `Vigente: versión ${vigente.doc_version}, publicada el ${fechaCorta(vigente.doc_publicado ?? vigente.doc_fecha)} · ${aceptaciones} inscripciones la aceptaron`
              : base
                ? 'Sin publicar todavía.'
                : 'Sin guardar: el texto de abajo es el del Word del cliente.'}
          </p>
        </div>
        {borrador && <Badge variant="secondary">Borrador · versión {borrador.doc_version}</Badge>}
      </div>

      {puedeEditar ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`titulo-${tipo}`}>Título</Label>
              <Input id={`titulo-${tipo}`} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Datos para insertar</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(datos.marcadores).map(([clave, descripcion]) => (
                  <button
                    key={clave}
                    type="button"
                    title={descripcion}
                    onClick={() => insertar(clave)}
                    className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {descripcion}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`texto-${tipo}`}>Texto</Label>
              <Textarea
                id={`texto-${tipo}`}
                ref={area}
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                className="min-h-[360px] font-mono text-sm"
              />
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Línea en blanco entre párrafos. <code className="rounded bg-muted px-1"># </code> subtítulo,{' '}
                  <code className="rounded bg-muted px-1">## </code> línea centrada.
                </p>
                {ayudaDePiezas(tipo).length > 0 && (
                  <p>Piezas que arma el sistema (cada una al principio de su párrafo): {ayudaDePiezas(tipo).join(' · ')}.</p>
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-1.5">
            <p className="text-sm font-medium">Así lo verá el representante (alumno de ejemplo)</p>
            <div className="max-h-[640px] overflow-y-auto rounded-md border bg-background p-4">
              <DocumentoVista tipo={tipo} titulo={titulo} contenido={contenido} datos={EJEMPLO} resaltar />
            </div>
          </div>
        </div>
      ) : (
        vigente && (
          <div className="max-h-96 overflow-y-auto rounded-md border bg-background p-4">
            <DocumentoVista tipo={tipo} titulo={vigente.doc_titulo} contenido={vigente.doc_contenido} datos={EJEMPLO} />
          </div>
        )
      )}

      {puedeEditar && problemas.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
          <p className="mb-1 font-medium text-destructive">No se puede publicar así</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <ConditionalAction module="inscripciones" action="editar">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            className="h-11 sm:h-10"
            variant="outline"
            disabled={!valido || sinCambios || guardar.isPending}
            onClick={() => guardar.mutate({ tipo, titulo: titulo.trim(), contenido })}
          >
            <Save className="mr-2 h-4 w-4" />
            {guardar.isPending ? 'Guardando…' : 'Guardar borrador'}
          </Button>
          {borrador && (
            <>
              <Button
                className="h-11 sm:h-10"
                disabled={!sinCambios || problemas.length > 0 || publicar.isPending}
                title={sinCambios ? undefined : 'Guarda el borrador antes de publicarlo'}
                onClick={() => setConfirmarPublicar(true)}
              >
                <Send className="mr-2 h-4 w-4" /> Publicar versión {borrador.doc_version}
              </Button>
              <Button
                className="h-11 text-destructive sm:h-10"
                variant="ghost"
                disabled={descartar.isPending}
                onClick={() => descartar.mutate(borrador.doc_id)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Descartar borrador
              </Button>
            </>
          )}
        </div>
        {!sinCambios && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {base ? 'Hay cambios sin guardar.' : 'Todavía no está guardado.'}
          </p>
        )}
      </ConditionalAction>

      {anteriores.length > 0 && (
        <details className="rounded-md border p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" /> Versiones anteriores
          </summary>
          <ul className="mt-2 divide-y text-sm">
            {anteriores.map((h) => (
              <li key={h.doc_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  Versión {h.doc_version} · {fechaCorta(h.doc_publicado ?? h.doc_fecha)} · {h.aceptaciones} inscripciones
                </span>
                <Button variant="ghost" size="sm" onClick={() => setViendo(h.doc_id)}>
                  Ver
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <AlertDialog open={confirmarPublicar} onOpenChange={setConfirmarPublicar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Publicar la versión {borrador?.doc_version}?</AlertDialogTitle>
            <AlertDialogDescription>
              Desde ahora la aceptarán quienes se inscriban, y ya no se podrá editar: para cambiarla habrá que
              publicar otra. Las inscripciones ya enviadas conservan la versión que aceptaron.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={publicarAhora}>Publicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VisorDocumento id={viendo} onClose={() => setViendo(null)} />
    </section>
  );
};

const VisorDocumento = ({ id, onClose }: { id: number | null; onClose: () => void }) => {
  const doc = useDocumentoLegal(id);
  return (
    <Dialog open={id !== null} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{doc.data?.doc_titulo ?? 'Documento'}</DialogTitle>
          <DialogDescription>
            {doc.data && `${NOMBRE_DOCUMENTO[doc.data.doc_tipo]} · versión ${doc.data.doc_version}`}
          </DialogDescription>
        </DialogHeader>
        {doc.data && (
          <DocumentoVista tipo={doc.data.doc_tipo} titulo={doc.data.doc_titulo} contenido={doc.data.doc_contenido} datos={EJEMPLO} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentosLegales;
