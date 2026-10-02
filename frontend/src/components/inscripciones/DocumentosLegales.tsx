import { useEffect, useRef, useState } from 'react';
import { FileDown, History, Save, Send, Trash2 } from 'lucide-react';
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
  type Documentos,
  type TipoDocumento,
} from '@/api/inscripciones';
import { ApiError } from '@/lib/api';
import TextoLegal from './TextoLegal';
import { fechaCorta } from './formato';

/**
 * Documentos que acepta el representante.
 *
 * Cada uno tiene una versión **vigente** (la publicada, la que se firma) y
 * como mucho un **borrador** (la siguiente). El borrador se edita y se guarda
 * cuantas veces haga falta; al publicarlo queda congelado para siempre —la
 * base lo impide— y es lo que acepta quien se inscriba desde ese momento.
 * Las inscripciones anteriores conservan la versión que aceptaron.
 *
 * El contrato lleva además **datos del representante**: el texto se escribe
 * con marcadores ({{alumno_nombre}}…) que se rellenan al inscribirse.
 */
const DocumentosLegales = ({ tipos }: { tipos: TipoDocumento[] }) => {
  const documentos = useDocumentosLegales();

  if (documentos.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (documentos.isError || !documentos.data) {
    return (
      <p className="text-sm text-destructive">
        No se pudieron cargar los documentos: {(documentos.error as Error | null)?.message}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {tipos.map((tipo) => (
        <PanelDocumento key={tipo} tipo={tipo} datos={documentos.data} />
      ))}
    </div>
  );
};

/** Datos ficticios para enseñar cómo queda el contrato. Los mismos que el PDF de ejemplo. */
const EJEMPLO: Record<string, string> = {
  representante_nombre: 'María José Pérez Andrade',
  representante_cedula: '1712345678',
  representante_correo: 'maria.perez@ejemplo.com',
  representante_telefono: '0991234567',
  representante_sector: 'Cumbayá',
  parentesco: 'Madre',
  alumno_nombre: 'Martín Pérez Andrade',
  alumno_fecha_nacimiento: '14 de mayo de 2016',
  alumno_cedula: '1755555555',
  colegio: 'Colegio de ejemplo',
  grado: '4to de Básica',
  disciplinas: 'Fútbol — Martes 16:00 a 17:00; Natación — Jueves 15:00 a 16:00',
  precio_disciplina: '$45,00',
  descuento: 'Sin descuento',
  valor_alumno: '$90,00',
  fecha: new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(new Date()),
};

const PanelDocumento = ({ tipo, datos }: { tipo: TipoDocumento; datos: Documentos }) => {
  const { hasPermission } = usePermissions();
  const puedeEditar = hasPermission('inscripciones', 'editar');
  const { toast } = useToast();

  const vigente = datos.vigentes.find((d) => d.doc_tipo === tipo);
  const borrador = datos.borradores.find((d) => d.doc_tipo === tipo);
  const anteriores = datos.historial.filter(
    (h) => h.doc_tipo === tipo && h.doc_id !== vigente?.doc_id,
  );
  const aceptaciones = datos.historial.find((h) => h.doc_id === vigente?.doc_id)?.aceptaciones ?? 0;
  const base = borrador ?? vigente;
  const conMarcadores = tipo === 'contrato';

  const [titulo, setTitulo] = useState(base?.doc_titulo ?? NOMBRE_DOCUMENTO[tipo]);
  const [contenido, setContenido] = useState(base?.doc_contenido ?? '');
  const [confirmarPublicar, setConfirmarPublicar] = useState(false);
  const [viendo, setViendo] = useState<number | null>(null);
  const [bajando, setBajando] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  // Cuando cambia lo guardado (se guardó, publicó o descartó), el editor parte de ahí.
  const claveBase = `${base?.doc_id ?? 0}-${base?.doc_fecha ?? ''}`;
  useEffect(() => {
    setTitulo(base?.doc_titulo ?? NOMBRE_DOCUMENTO[tipo]);
    setContenido(base?.doc_contenido ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveBase]);

  const guardar = useGuardarBorrador();
  const publicar = usePublicarDocumento();
  const descartar = useBorrarBorrador();

  const sinCambios = base !== undefined && base.doc_titulo === titulo.trim() && base.doc_contenido === contenido;
  const valido = titulo.trim().length >= 3 && contenido.trim().length >= 20;

  const insertar = (clave: string) => {
    const marca = `{{${clave}}}`;
    const el = area.current;
    if (!el) {
      setContenido((c) => c + marca);
      return;
    }
    const inicio = el.selectionStart ?? contenido.length;
    const fin = el.selectionEnd ?? contenido.length;
    const nuevo = contenido.slice(0, inicio) + marca + contenido.slice(fin);
    setContenido(nuevo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(inicio + marca.length, inicio + marca.length);
    });
  };

  const verEjemplo = async () => {
    const id = borrador?.doc_id ?? vigente?.doc_id;
    if (!id) return;
    setBajando(true);
    try {
      await inscripcionesApi.ejemploContrato(id);
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
    <section className="space-y-4 rounded-lg border p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{NOMBRE_DOCUMENTO[tipo]}</h2>
          <p className="text-sm text-muted-foreground">
            {vigente
              ? `Vigente: versión ${vigente.doc_version}, publicada el ${fechaCorta(vigente.doc_publicado ?? vigente.doc_fecha)} · ${aceptaciones} aceptaciones`
              : 'Sin publicar: el formulario no se abre hasta que lo esté.'}
          </p>
        </div>
        {borrador && (
          <Badge variant="secondary">Borrador · versión {borrador.doc_version}</Badge>
        )}
      </div>

      {puedeEditar ? (
        <div className={conMarcadores ? 'grid grid-cols-1 gap-4 lg:grid-cols-2' : 'space-y-4'}>
          <div className="min-w-0 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`titulo-${tipo}`}>Título</Label>
              <Input
                id={`titulo-${tipo}`}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            {conMarcadores && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Datos del representante para insertar</p>
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
                <p className="text-xs text-muted-foreground">
                  Toca uno para insertarlo donde está el cursor. Al final de cada contrato se añaden
                  siempre los datos de la inscripción, los valores y la constancia de aceptación.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor={`texto-${tipo}`}>Texto</Label>
              <Textarea
                id={`texto-${tipo}`}
                ref={area}
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                className="min-h-[360px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Línea en blanco entre párrafos. Una línea que empieza con{' '}
                <code className="rounded bg-muted px-1"># </code> es un subtítulo.
              </p>
            </div>
          </div>

          {conMarcadores && (
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm font-medium">Así lo leerá el representante (datos de ejemplo)</p>
              <div className="max-h-[560px] overflow-y-auto rounded-md border bg-muted/30 p-4">
                <h3 className="mb-3 text-center font-semibold">{titulo}</h3>
                <TextoConMarcadores texto={contenido} />
              </div>
            </div>
          )}
        </div>
      ) : (
        vigente && (
          <div className="max-h-96 overflow-y-auto rounded-md border bg-muted/30 p-4">
            <TextoLegal texto={vigente.doc_contenido} />
          </div>
        )
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
          {conMarcadores && (borrador || vigente) && (
            <Button
              className="h-11 sm:h-10"
              variant="outline"
              onClick={verEjemplo}
              disabled={bajando}
              title="Lo guardado, no lo que está sin guardar"
            >
              <FileDown className="mr-2 h-4 w-4" />
              {bajando ? 'Generando…' : 'PDF de ejemplo'}
            </Button>
          )}
          {borrador && (
            <>
              <Button
                className="h-11 sm:h-10"
                disabled={!sinCambios || publicar.isPending}
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
        {!sinCambios && base && (
          <p className="text-xs text-amber-700 dark:text-amber-400">Hay cambios sin guardar.</p>
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
                  Versión {h.doc_version} · {fechaCorta(h.doc_publicado ?? h.doc_fecha)} ·{' '}
                  {h.aceptaciones} aceptaciones
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
              Desde ahora la aceptarán quienes se inscriban, y ya no se podrá editar: para cambiarla
              habrá que publicar otra. Las inscripciones ya enviadas conservan la versión que
              aceptaron.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => borrador && publicar.mutate(borrador.doc_id)}
            >
              Publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VisorDocumento id={viendo} onClose={() => setViendo(null)} />
    </section>
  );
};

/**
 * El contrato con los datos de ejemplo puestos, y resaltados para que se vea
 * qué parte escribe el representante. Un marcador mal escrito sale en rojo.
 */
const TextoConMarcadores = ({ texto }: { texto: string }) => {
  const bloques = texto
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (bloques.length === 0) {
    return <p className="text-sm text-muted-foreground">Escribe el texto del contrato.</p>;
  }

  const pintar = (bloque: string) =>
    bloque.split(/(\{\{\s*[a-z_]+\s*\}\})/g).map((trozo, i) => {
      const clave = /^\{\{\s*([a-z_]+)\s*\}\}$/.exec(trozo)?.[1];
      if (!clave) return <span key={i}>{trozo}</span>;
      const valor = EJEMPLO[clave];
      return valor ? (
        <mark key={i} className="rounded bg-sky-200/70 px-0.5 text-foreground dark:bg-sky-500/30">
          {valor}
        </mark>
      ) : (
        <mark
          key={i}
          className="rounded bg-destructive/20 px-0.5 text-destructive"
          title="Este dato no existe"
        >
          {trozo}
        </mark>
      );
    });

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {bloques.map((bloque, i) =>
        bloque.startsWith('# ') ? (
          <h4 key={i} className="pt-1 font-semibold">
            {pintar(bloque.slice(2))}
          </h4>
        ) : (
          <p key={i} className="whitespace-pre-line text-justify">
            {pintar(bloque)}
          </p>
        ),
      )}
    </div>
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
            {doc.data &&
              `${NOMBRE_DOCUMENTO[doc.data.doc_tipo]} · versión ${doc.data.doc_version}`}
          </DialogDescription>
        </DialogHeader>
        {doc.data && <TextoLegal texto={doc.data.doc_contenido} />}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentosLegales;
