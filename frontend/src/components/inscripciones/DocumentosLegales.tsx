import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  FileDown,
  History,
  Pencil,
  Save,
  Send,
  Trash2,
  X,
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import {
  useBorrarBorrador,
  useDocumentoLegal,
  useDocumentosLegales,
  useGuardarBorrador,
  usePrecios,
  usePublicarDocumento,
} from '@/hooks/useInscripciones';
import {
  inscripcionesApi,
  NOMBRE_DOCUMENTO,
  TIPOS_DOCUMENTO,
  type Documentos,
  type PrecioColegio,
  type TipoDocumento,
} from '@/api/inscripciones';
import { ApiError } from '@/lib/api';
import DocumentoVista from './DocumentoVista';
import DatosColegio from './DatosColegio';
import Membrete from './Membrete';
import CuentaBancaria from './CuentaBancaria';
import MaxDisciplinas from './MaxDisciplinas';
import { EstadoDelColegio } from './EstadoInscripciones';
import { REGLAS, porcentaje, problemasDePlantilla, tarifa, type DatosDocumento } from './documento';
import { fechaCorta } from './formato';

/** Iguales para cualquier colegio: se leen y se aceptan. */
const GENERALES: TipoDocumento[] = ['autorizacion_datos', 'datos_medicos', 'imagen', 'politica'];
/** Un texto común, llenado con los datos de cada colegio. */
const POR_COLEGIO: TipoDocumento[] = ['ficha_matricula', 'contrato'];

/**
 * Los datos que se pueden poner en un texto, en dos grupos. Cada uno se
 * escribe {{clave}} y al inscribirse se cambia por el valor real. Las
 * etiquetas las da el backend (MARCADORES); aquí solo se ordenan.
 */
const GRUPOS_DE_DATOS: Array<{ titulo: string; ayuda: string; claves: string[] }> = [
  {
    titulo: 'De la inscripción',
    ayuda: 'Salen de lo que llena el representante.',
    claves: ['fecha', 'representante_nombre', 'representante_cedula', 'alumno_nombre'],
  },
  {
    titulo: 'Del colegio',
    ayuda: 'Salen de los datos de cada colegio, en Por colegio.',
    claves: ['sede', 'sede_corta', 'institucion', 'minimo_alumnos', 'tarifa', 'descuento_hermano'],
  },
];

/**
 * Los seis documentos de la inscripción (decisión del cliente, 2026-10-05):
 *
 * - **Generales**: autorización de datos, salud, imagen y política. Se leen
 *   y se aceptan; son iguales para todos los colegios.
 * - **Por colegio**: ficha de matrícula y contrato. Se elige el colegio, se
 *   editan sus datos y se ven sus documentos llenos. El texto es **común**:
 *   los Word de cada colegio eran el mismo texto con otros datos.
 * - **Configuración**: el membrete de los PDF.
 *
 * Cada documento es una tarjeta: tocarla enseña cómo queda; desde ahí se
 * edita, se guarda como borrador y se publica. Una versión publicada queda
 * congelada para siempre —la base lo impide— y es lo que acepta quien se
 * inscriba desde ese momento. Un tipo sin texto arranca con el de su Word.
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-sm">
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
        <Button
          variant="outline"
          className="h-11 sm:h-10"
          onClick={verEjemplo}
          disabled={bajando}
          title="El PDF de un alumno ficticio con lo guardado de cada documento"
        >
          <FileDown className="mr-2 h-4 w-4" />
          {bajando ? 'Generando…' : 'PDF de ejemplo'}
        </Button>
      </div>

      <Tabs defaultValue="generales">
        <TabsList>
          <TabsTrigger value="generales">Generales</TabsTrigger>
          <TabsTrigger value="colegio">Por colegio</TabsTrigger>
          <TabsTrigger value="configuracion">Más</TabsTrigger>
        </TabsList>
        <TabsContent value="generales" className="space-y-3 pt-3">
          <p className="text-sm text-muted-foreground">
            Iguales para cualquier colegio. El representante los lee y los acepta.
          </p>
          {GENERALES.map((tipo) => (
            <TarjetaDocumento key={tipo} tipo={tipo} datos={documentos.data} />
          ))}
        </TabsContent>
        <TabsContent value="colegio" className="pt-3">
          <PorColegio datos={documentos.data} />
        </TabsContent>
        <TabsContent value="configuracion" className="space-y-6 pt-3">
          <Membrete />
          <CuentaBancaria />
          <MaxDisciplinas />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/**
 * El alumno ficticio de las vistas previas. Todo genérico a propósito: un
 * colegio o una tarifa reales se confundirían con los datos de verdad.
 */
const EJEMPLO: DatosDocumento = {
  valores: {
    fecha: new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(new Date()),
    representante_nombre: 'Nombre del representante',
    representante_cedula: '0000000000',
    alumno_nombre: 'Nombre del alumno',
    sede: '[nombre de la sede]',
    sede_corta: '[nombre corto de la sede]',
    institucion: '[institución]',
    minimo_alumnos: '[mínimo]',
    tarifa: '[tarifa]',
    descuento_hermano: '[descuento]',
  },
  representante: {
    nombre: 'Nombre del representante',
    cedula: '0000000000',
    telefono: '0990000000',
    factura: {
      nombre: 'Nombre para la factura',
      identificacion: '0000000000001',
      correo: 'correo@ejemplo.com',
      direccion: 'Dirección para la factura',
    },
    aplicaDescuento: 'No',
  },
  alumno: {
    nombre: 'Nombre del alumno',
    fecha_nacimiento: '1 de enero de 2016',
    curso: 'Curso',
    actividades: 'Disciplina',
    horarios: 'Disciplina: Martes 16:00 a 17:00; Disciplina: Jueves 16:00 a 17:00',
    emergencia: { nombre: 'Contacto de emergencia', relacion: 'Relación', telefono: '0990000000' },
    retiro: { nombre: 'Persona autorizada', cedula: '0000000000', relacion: 'Relación', telefono: '0990000000' },
    modalidad_salida: 'privado',
    detalle_retiro: 'Instrucciones de retiro',
    salud: { tiene: false, detalle: '', autoriza: true },
    imagen: { familias: true, redes: false, promocional: false },
  },
  fechaFirma: 'fecha y hora del envío',
  aprobacion: 'Aprobado por (quien aprueba) el (fecha)',
};

/** El alumno ficticio con los datos de un colegio en sus documentos. */
function ejemploDe(fila: PrecioColegio | undefined): DatosDocumento {
  if (!fila) return EJEMPLO;
  return {
    ...EJEMPLO,
    valores: {
      ...EJEMPLO.valores,
      sede: fila.sede ?? EJEMPLO.valores.sede!,
      sede_corta: fila.sede_corta ?? EJEMPLO.valores.sede_corta!,
      institucion: fila.institucion ?? EJEMPLO.valores.institucion!,
      minimo_alumnos: fila.minimo_alumnos !== null ? String(fila.minimo_alumnos) : EJEMPLO.valores.minimo_alumnos!,
      tarifa: fila.precio !== null ? tarifa(fila.precio) : EJEMPLO.valores.tarifa!,
      descuento_hermano:
        fila.descuento_hermano !== null ? porcentaje(fila.descuento_hermano) : EJEMPLO.valores.descuento_hermano!,
    },
  };
}

const PorColegio = ({ datos }: { datos: Documentos }) => {
  const precios = usePrecios();
  const [colId, setColId] = useState<string>('');

  if (precios.isLoading) return <p className="text-sm text-muted-foreground">Cargando colegios…</p>;
  if (precios.isError || !precios.data) {
    return (
      <p className="text-sm text-destructive">
        No se pudieron cargar los colegios: {(precios.error as Error | null)?.message}
      </p>
    );
  }

  const colegios = precios.data;
  if (colegios.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay colegios. Créalos en Colegios y vuelve aquí para poner sus datos.
      </p>
    );
  }
  const fila = colegios.find((c) => String(c.col_id) === colId) ?? colegios[0]!;
  const sinDatos = colegios.filter((c) => c.precio === null);

  return (
    <div className="space-y-5">
      {sinDatos.length > 0 && (
        <div className="rounded-md border border-amber-600/50 bg-amber-500/10 p-3 text-sm">
          <span className="font-medium">
            {sinDatos.length} colegio{sinDatos.length === 1 ? '' : 's'} sin datos
          </span>{' '}
          <span className="text-muted-foreground">
            ({sinDatos.map((c) => c.col_nombre).join(', ')}): no aparecen en el formulario de inscripción.
          </span>
        </div>
      )}

      <div className="max-w-md space-y-1.5">
        <Label htmlFor="docs-colegio">Colegio</Label>
        <Select value={String(fila.col_id)} onValueChange={setColId}>
          <SelectTrigger id="docs-colegio" className="h-11 sm:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {colegios.map((c) => (
              <SelectItem key={c.col_id} value={String(c.col_id)}>
                {c.col_nombre}
                {c.precio === null ? ' · sin datos' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <EstadoDelColegio colId={fila.col_id} />

      <DatosColegio key={fila.col_id} fila={fila} />

      <div className="space-y-1 pt-2">
        <h3 className="text-base font-semibold">Ficha de matrícula y contrato</h3>
        <p className="text-sm text-muted-foreground">
          El texto es el mismo para todos los colegios; la vista previa sale con los datos de{' '}
          {fila.col_nombre}. Un cambio en el texto vale para todos.
        </p>
      </div>
      {POR_COLEGIO.map((tipo) => (
        <TarjetaDocumento key={tipo} tipo={tipo} datos={datos} ejemplo={ejemploDe(fila)} />
      ))}
    </div>
  );
};

/** Si el documento lleva algo entre corchetes que llena el sistema. */
function tienePiezas(tipo: TipoDocumento): boolean {
  const r = REGLAS[tipo];
  return r.casillas.length + r.datos.length + r.firmas.length > 0 || r.salud || r.politica;
}

const TarjetaDocumento = ({
  tipo,
  datos,
  ejemplo = EJEMPLO,
}: {
  tipo: TipoDocumento;
  datos: Documentos;
  /** Con qué se llena la vista previa: por defecto el alumno de ejemplo. */
  ejemplo?: DatosDocumento;
}) => {
  const { hasPermission } = usePermissions();
  const puedeEditar = hasPermission('inscripciones', 'editar');

  const vigente = datos.vigentes.find((d) => d.doc_tipo === tipo);
  const borrador = datos.borradores.find((d) => d.doc_tipo === tipo);
  const anteriores = datos.historial.filter((h) => h.doc_tipo === tipo && h.doc_id !== vigente?.doc_id);
  const aceptaciones = datos.historial.find((h) => h.doc_id === vigente?.doc_id)?.aceptaciones ?? 0;
  const base = borrador ?? vigente;
  const inicial = datos.iniciales[tipo];
  const tituloGuardado = base?.doc_titulo ?? inicial.titulo;
  const textoGuardado = base?.doc_contenido ?? inicial.contenido;

  const [abierta, setAbierta] = useState(false);
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(tituloGuardado);
  const [contenido, setContenido] = useState(textoGuardado);
  const [confirmarPublicar, setConfirmarPublicar] = useState(false);
  const [viendo, setViendo] = useState<number | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  // Cuando cambia lo guardado (se guardó, publicó o descartó), el editor parte de ahí.
  const claveBase = `${base?.doc_id ?? 0}-${base?.doc_fecha ?? ''}`;
  useEffect(() => {
    setTitulo(tituloGuardado);
    setContenido(textoGuardado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveBase]);

  const guardar = useGuardarBorrador();
  const publicar = usePublicarDocumento();
  const descartar = useBorrarBorrador();

  const sinCambios = base !== undefined && base.doc_titulo === titulo.trim() && base.doc_contenido === contenido;
  const valido = titulo.trim().length >= 3 && contenido.trim().length >= 20;
  const problemas = problemasDePlantilla(tipo, editando ? contenido : textoGuardado, datos.marcadores);

  const estado = borrador
    ? { texto: `Borrador v${borrador.doc_version} sin publicar`, variante: 'secondary' as const }
    : vigente
      ? { texto: `Publicado · v${vigente.doc_version}`, variante: 'default' as const }
      : { texto: 'Sin guardar', variante: 'outline' as const };

  const insertar = (clave: string) => {
    const marca = `{{${clave}}}`;
    const el = area.current;
    if (!el) {
      setContenido((c) => c + marca);
      return;
    }
    const inicio = el.selectionStart ?? contenido.length;
    const fin = el.selectionEnd ?? contenido.length;
    // Al cambiar el valor y devolver el foco, el navegador movía el cuadro de
    // texto y la página: se guarda dónde estaban y se deja todo quieto.
    const scrollTexto = el.scrollTop;
    const scrollPagina = window.scrollY;
    setContenido(contenido.slice(0, inicio) + marca + contenido.slice(fin));
    requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
      el.setSelectionRange(inicio + marca.length, inicio + marca.length);
      el.scrollTop = scrollTexto;
      window.scrollTo({ top: scrollPagina });
    });
  };

  const guardarAhora = async () => {
    try {
      await guardar.mutateAsync({ tipo, titulo: titulo.trim(), contenido });
      setEditando(false);
    } catch {
      // El hook ya muestra el motivo; se queda editando.
    }
  };

  const cancelar = () => {
    setTitulo(tituloGuardado);
    setContenido(textoGuardado);
    setEditando(false);
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
    <section className="overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{NOMBRE_DOCUMENTO[tipo]}</p>
          <p className="truncate text-xs text-muted-foreground">
            {vigente
              ? `Publicado el ${fechaCorta(vigente.doc_publicado ?? vigente.doc_fecha)} · ${aceptaciones} inscripciones lo aceptaron`
              : base
                ? 'Guardado, sin publicar'
                : 'Texto de su Word, sin guardar todavía'}
          </p>
        </div>
        <Badge variant={estado.variante} className="hidden flex-shrink-0 sm:inline-flex">
          {estado.texto}
        </Badge>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`} />
      </button>

      {abierta && (
        <div className="space-y-4 border-t p-4">
          <Badge variant={estado.variante} className="sm:hidden">
            {estado.texto}
          </Badge>

          {!editando ? (
            <>
              <div className="max-h-[560px] overflow-y-auto rounded-md border bg-background p-4">
                <DocumentoVista
                  tipo={tipo}
                  titulo={tituloGuardado}
                  contenido={textoGuardado}
                  datos={ejemplo}
                  resaltar
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Lo resaltado son datos: al inscribirse se cambian por los reales.
              </p>

              {puedeEditar && problemas.length > 0 && <Problemas problemas={problemas} />}

              <ConditionalAction module="inscripciones" action="editar">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button className="h-11 sm:h-10" variant="outline" onClick={() => setEditando(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </Button>
                  {!base && (
                    <Button
                      className="h-11 sm:h-10"
                      variant="outline"
                      disabled={guardar.isPending}
                      onClick={() => guardar.mutate({ tipo, titulo: tituloGuardado, contenido: textoGuardado })}
                    >
                      <Save className="mr-2 h-4 w-4" /> Guardar tal cual
                    </Button>
                  )}
                  {borrador && (
                    <>
                      <Button
                        className="h-11 sm:h-10"
                        disabled={problemas.length > 0 || publicar.isPending}
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
              </ConditionalAction>
            </>
          ) : (
            <Editor
              tipo={tipo}
              datos={datos}
              ejemplo={ejemplo}
              titulo={titulo}
              contenido={contenido}
              onTitulo={setTitulo}
              onContenido={setContenido}
              onInsertar={insertar}
              area={area}
              problemas={problemas}
              guardando={guardar.isPending}
              puedeGuardar={valido && !sinCambios}
              onGuardar={guardarAhora}
              onCancelar={cancelar}
            />
          )}

          {anteriores.length > 0 && (
            <details className="rounded-md border p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4" /> Versiones anteriores
              </summary>
              <ul className="mt-2 divide-y text-sm">
                {anteriores.map((h) => (
                  <li key={h.doc_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      Versión {h.doc_version} · {fechaCorta(h.doc_publicado ?? h.doc_fecha)} · {h.aceptaciones}{' '}
                      inscripciones
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setViendo(h.doc_id)}>
                      Ver
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
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

      <VisorDocumento id={viendo} ejemplo={ejemplo} onClose={() => setViendo(null)} />
    </section>
  );
};

const Problemas = ({ problemas }: { problemas: string[] }) => (
  <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
    <p className="mb-1 font-medium text-destructive">No se puede publicar así</p>
    <ul className="list-disc space-y-0.5 pl-5">
      {problemas.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  </div>
);

const Editor = ({
  tipo,
  datos,
  ejemplo,
  titulo,
  contenido,
  onTitulo,
  onContenido,
  onInsertar,
  area,
  problemas,
  guardando,
  puedeGuardar,
  onGuardar,
  onCancelar,
}: {
  tipo: TipoDocumento;
  datos: Documentos;
  ejemplo: DatosDocumento;
  titulo: string;
  contenido: string;
  onTitulo: (v: string) => void;
  onContenido: (v: string) => void;
  onInsertar: (clave: string) => void;
  area: React.RefObject<HTMLTextAreaElement>;
  problemas: string[];
  guardando: boolean;
  puedeGuardar: boolean;
  onGuardar: () => void;
  onCancelar: () => void;
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`titulo-${tipo}`}>Título</Label>
            <Input id={`titulo-${tipo}`} value={titulo} onChange={(e) => onTitulo(e.target.value)} />
          </div>

          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">Datos para insertar</p>
              <p className="text-xs text-muted-foreground">
                Toca uno y se pone donde está el cursor. En el texto se ve entre llaves, por ejemplo{' '}
                <code className="rounded bg-muted px-1">{'{{tarifa}}'}</code>; al inscribirse se cambia por el
                valor real.
              </p>
            </div>
            {GRUPOS_DE_DATOS.map((g) => (
              <div key={g.titulo} className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.titulo} <span className="font-normal normal-case tracking-normal">· {g.ayuda}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {g.claves
                    .filter((c) => c in datos.marcadores)
                    .map((clave) => (
                      <button
                        key={clave}
                        type="button"
                        onClick={() => onInsertar(clave)}
                        className="rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {datos.marcadores[clave]}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`texto-${tipo}`}>Texto</Label>
            <Textarea
              id={`texto-${tipo}`}
              ref={area}
              value={contenido}
              onChange={(e) => onContenido(e.target.value)}
              className="min-h-[360px] font-mono text-sm"
            />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                Línea en blanco entre párrafos. <code className="rounded bg-muted px-1"># </code> al principio: subtítulo.{' '}
                <code className="rounded bg-muted px-1">## </code>: línea centrada.
              </p>
              {tienePiezas(tipo) && (
                <p>
                  Lo que está entre corchetes, como <code className="rounded bg-muted px-1">[datos alumno]</code>,
                  lo llena el sistema y no se edita: se puede mover o quitar.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-medium">Vista previa</p>
          <div className="max-h-[720px] overflow-y-auto rounded-md border bg-background p-4">
            <DocumentoVista tipo={tipo} titulo={titulo} contenido={contenido} datos={ejemplo} resaltar />
          </div>
        </div>
      </div>

      {problemas.length > 0 && <Problemas problemas={problemas} />}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="h-11 sm:h-10" disabled={!puedeGuardar || guardando} onClick={onGuardar}>
          <Save className="mr-2 h-4 w-4" />
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button className="h-11 sm:h-10" variant="ghost" onClick={onCancelar} disabled={guardando}>
          <X className="mr-2 h-4 w-4" /> Cancelar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Guardar deja un borrador; se publica después desde la tarjeta.
      </p>
    </div>
  );
};

const VisorDocumento = ({
  id,
  ejemplo,
  onClose,
}: {
  id: number | null;
  ejemplo: DatosDocumento;
  onClose: () => void;
}) => {
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
          <DocumentoVista
            tipo={doc.data.doc_tipo}
            titulo={doc.data.doc_titulo}
            contenido={doc.data.doc_contenido}
            datos={ejemplo}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentosLegales;
