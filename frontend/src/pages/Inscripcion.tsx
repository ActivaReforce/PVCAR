import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  ImageUp,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import { compressImage } from '@/lib/imageCompression';
import {
  dinero,
  inscripcionesApi,
  NOMBRE_DOCUMENTO,
  type Cobro,
  type CobroAlumno,
  type DisciplinaOfertada,
  type EnvioRecibido,
  type Formulario,
  type TipoDocumento,
} from '@/api/inscripciones';
import TextoLegal from '@/components/inscripciones/TextoLegal';
import { fechaNacimiento } from '@/components/inscripciones/formato';

/**
 * Formulario público de inscripción (Fase 14B).
 *
 * Llega por un correo masivo a representantes que todavía no tienen cuenta,
 * casi siempre en el móvil. Cuatro pasos cortos en vez de una página
 * infinita: tus datos, los alumnos, los documentos y el pago.
 *
 * Al enviar no se crea ninguna cuenta: queda pendiente hasta que Activa
 * Reforce revise el comprobante. Al aprobarla le llega un correo con su
 * acceso, y su contraseña es su cédula.
 */

const PASOS = ['Tus datos', 'Alumnos', 'Documentos', 'Pago'] as const;
const TIPOS: TipoDocumento[] = ['contrato', 'terminos', 'privacidad'];
const SIN_GRADO = 'sin-grado';

interface Representante {
  nombre: string;
  cedula: string;
  correo: string;
  telefono: string;
  sector_residencia: string;
}

interface Alumno {
  clave: number;
  nombre: string;
  fecha_nacimiento: string;
  cedula: string;
  col_id: string;
  catninograd_id: string;
  parentesco: string;
  toma_transporte: boolean;
  info_salud: string;
  otra_info: string;
  disciplinas: number[];
}

let siguienteClave = 1;
const alumnoVacio = (): Alumno => ({
  clave: siguienteClave++,
  nombre: '',
  fecha_nacimiento: '',
  cedula: '',
  col_id: '',
  catninograd_id: SIN_GRADO,
  parentesco: '',
  toma_transporte: false,
  info_salud: '',
  otra_info: '',
  disciplinas: [],
});

const describir = (d: DisciplinaOfertada) =>
  `${d.actividad} — ${d.dia} ${d.hora_inicio} a ${d.hora_fin}`;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function erroresRepresentante(r: Representante): string[] {
  const e: string[] = [];
  if (r.nombre.trim().length < 3) e.push('Escribe tu nombre completo.');
  if (!/^[0-9A-Za-z-]{6,20}$/.test(r.cedula.trim()))
    e.push('La cédula o pasaporte debe tener entre 6 y 20 caracteres, sin espacios.');
  if (!CORREO.test(r.correo.trim())) e.push('El correo no es válido.');
  if (!/^[0-9+\s()-]{7,20}$/.test(r.telefono.trim())) e.push('El teléfono no es válido.');
  return e;
}

function edadEnAnos(aaaammdd: string): number | null {
  const fecha = new Date(`${aaaammdd}T12:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return null;
  return (Date.now() - fecha.getTime()) / (365.25 * 24 * 3600 * 1000);
}

function erroresAlumnos(alumnos: Alumno[]): string[] {
  const e: string[] = [];
  alumnos.forEach((a, i) => {
    const quien = alumnos.length > 1 ? `Alumno ${i + 1}: ` : '';
    if (a.nombre.trim().length < 3) e.push(`${quien}escribe su nombre completo.`);
    const edad = a.fecha_nacimiento ? edadEnAnos(a.fecha_nacimiento) : null;
    if (edad === null) e.push(`${quien}falta la fecha de nacimiento.`);
    else if (edad < 2 || edad > 20) e.push(`${quien}revisa la fecha de nacimiento.`);
    if (!a.parentesco) e.push(`${quien}indica tu parentesco.`);
    if (!a.col_id) e.push(`${quien}elige el colegio.`);
    else if (a.disciplinas.length === 0) e.push(`${quien}elige al menos una disciplina.`);
  });
  return e;
}

/** Igual que el backend: lo que se lee aquí es lo que queda en el PDF. */
function rellenarContrato(
  texto: string,
  rep: Representante,
  alumno: Alumno | undefined,
  formulario: Formulario,
  cobro: CobroAlumno | undefined,
): string {
  const grado = formulario.grados.find((g) => String(g.catninograd_id) === alumno?.catninograd_id);
  const pendiente = '[se calcula al elegir disciplinas]';
  const colegio = formulario.colegios.find((c) => String(c.col_id) === alumno?.col_id);
  const disciplinas = (colegio?.disciplinas ?? [])
    .filter((d) => alumno?.disciplinas.includes(d.colacthor_id))
    .map(describir)
    .join('; ');
  const valores: Record<string, string> = {
    representante_nombre: rep.nombre.trim() || '[tu nombre]',
    representante_cedula: rep.cedula.trim() || '[tu cédula]',
    representante_correo: rep.correo.trim() || '[tu correo]',
    representante_telefono: rep.telefono.trim() || '[tu teléfono]',
    representante_sector: rep.sector_residencia.trim() || '—',
    parentesco: alumno?.parentesco || '[parentesco]',
    alumno_cedula: alumno?.cedula.trim() || '—',
    grado: grado?.catninograd_nombre ?? '—',
    precio_disciplina: cobro ? dinero(cobro.precio_disciplina) : pendiente,
    descuento: cobro
      ? cobro.descuento_pct > 0
        ? `${cobro.descuento_pct} % por hermano en ${cobro.disciplinas_con_descuento} disciplina${cobro.disciplinas_con_descuento === 1 ? '' : 's'} (${dinero(cobro.descuento)})`
        : 'Sin descuento'
      : pendiente,
    valor_alumno: cobro ? dinero(cobro.total) : pendiente,
    alumno_nombre: alumno?.nombre.trim() || '[nombre del alumno]',
    alumno_fecha_nacimiento: alumno?.fecha_nacimiento
      ? fechaNacimiento(alumno.fecha_nacimiento)
      : '[fecha de nacimiento]',
    colegio: colegio?.col_nombre ?? '[colegio]',
    disciplinas: disciplinas || '[disciplinas]',
    fecha: new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(new Date()),
  };
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (original, clave: string) =>
    clave in valores ? valores[clave]! : original,
  );
}

function aBase64(archivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });
}

const Inscripcion = () => {
  const formulario = useQuery({
    queryKey: ['inscripcion-publica', 'formulario'],
    queryFn: () => inscripcionesApi.formulario(),
    staleTime: 5 * 60_000,
  });

  const [paso, setPaso] = useState(0);
  const [rep, setRep] = useState<Representante>({
    nombre: '',
    cedula: '',
    correo: '',
    telefono: '',
    sector_residencia: '',
  });
  const [alumnos, setAlumnos] = useState<Alumno[]>(() => [alumnoVacio()]);
  const [acepta, setAcepta] = useState<Record<TipoDocumento, boolean>>({
    contrato: false,
    terminos: false,
    privacidad: false,
  });
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const [resultado, setResultado] = useState<EnvioRecibido | null>(null);
  const arriba = useRef<HTMLDivElement>(null);

  // El total lo calcula el backend con los precios de la base, para que lo
  // que se ve aquí sea exactamente lo que dirá el contrato.
  const seleccion = alumnos
    .filter((a) => a.col_id && a.disciplinas.length > 0)
    .map((a) => ({ col_id: Number(a.col_id), disciplinas: [...a.disciplinas].sort((x, y) => x - y) }));
  const cotizacion = useQuery({
    queryKey: ['inscripcion-publica', 'cotizacion', seleccion],
    queryFn: () => inscripcionesApi.cotizar(seleccion),
    enabled: paso >= 2 && seleccion.length === alumnos.length,
  });

  const subir = () => arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const irA = (nuevo: number) => {
    setErrores([]);
    setPaso(nuevo);
    subir();
  };

  const siguiente = () => {
    const e =
      paso === 0
        ? erroresRepresentante(rep)
        : paso === 1
          ? erroresAlumnos(alumnos)
          : paso === 2
            ? TIPOS.filter((t) => !acepta[t]).map(
                (t) => `Falta aceptar: ${NOMBRE_DOCUMENTO[t]}.`,
              )
            : [];
    if (e.length > 0) {
      setErrores(e);
      subir();
      return;
    }
    irA(paso + 1);
  };

  const elegirComprobante = async (archivo: File | undefined) => {
    setErrores([]);
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      setErrores(['El comprobante tiene que ser una foto o captura (imagen).']);
      return;
    }
    setPreparando(true);
    try {
      // JPEG siempre: una captura del banco en PNG pesa diez veces más.
      const comprimido = await compressImage(archivo, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1800,
        initialQuality: 0.85,
        fileType: 'image/jpeg',
      });
      if (comprimido.size > 2 * 1024 * 1024) {
        setErrores(['La imagen pesa demasiado incluso comprimida. Prueba con una captura.']);
        return;
      }
      if (vista) URL.revokeObjectURL(vista);
      setComprobante(comprimido);
      setVista(URL.createObjectURL(comprimido));
    } finally {
      setPreparando(false);
    }
  };

  const enviar = async () => {
    const datos = formulario.data;
    if (!datos || !comprobante) {
      setErrores(['Sube la foto o captura del comprobante de pago.']);
      return;
    }
    const mime = ['image/jpeg', 'image/png', 'image/webp'].includes(comprobante.type)
      ? comprobante.type
      : 'image/jpeg';

    setEnviando(true);
    setErrores([]);
    try {
      const recibido = await inscripcionesApi.enviar({
        representante: {
          nombre: rep.nombre.trim(),
          cedula: rep.cedula.trim(),
          correo: rep.correo.trim(),
          telefono: rep.telefono.trim(),
          sector_residencia: rep.sector_residencia.trim() || undefined,
        },
        ninos: alumnos.map((a) => ({
          nombre: a.nombre.trim(),
          fecha_nacimiento: a.fecha_nacimiento,
          cedula: a.cedula.trim() || undefined,
          col_id: Number(a.col_id),
          catninograd_id: a.catninograd_id === SIN_GRADO ? null : Number(a.catninograd_id),
          parentesco: a.parentesco,
          toma_transporte: a.toma_transporte,
          info_salud: a.info_salud.trim() || undefined,
          otra_info: a.otra_info.trim() || undefined,
          disciplinas: a.disciplinas,
        })),
        documentos: {
          contrato: datos.documentos.contrato!.doc_id,
          terminos: datos.documentos.terminos!.doc_id,
          privacidad: datos.documentos.privacidad!.doc_id,
        },
        acepta: { contrato: true, terminos: true, privacidad: true },
        comprobante: { mime, base64: await aBase64(comprobante) },
      });
      setResultado(recibido);
      subir();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Cambió un documento o una disciplina mientras llenaba: se recarga
        // y se le devuelve al paso que tiene que revisar.
        await formulario.refetch();
        const problemas = (err.details as { problemas?: string[] } | undefined)?.problemas;
        if (problemas) {
          setErrores([err.message, ...problemas]);
          setPaso(1);
        } else {
          setAcepta({ contrato: false, terminos: false, privacidad: false });
          setErrores([err.message]);
          setPaso(2);
        }
      } else {
        setErrores([
          err instanceof ApiError
            ? err.message
            : 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.',
        ]);
      }
      subir();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <img src="/activaIcon.png" alt="" className="h-9 w-9 rounded" />
          <div className="leading-tight">
            <p className="font-bold tracking-wide">ACTIVA REFORCE</p>
            <p className="text-xs text-muted-foreground">Inscripción</p>
          </div>
        </div>
      </header>

      <main ref={arriba} className="mx-auto max-w-2xl scroll-mt-4 px-4 py-6">
        {formulario.isLoading && (
          <p className="py-16 text-center text-muted-foreground">Cargando…</p>
        )}
        {formulario.isError && (
          <Aviso titulo="No se pudo abrir el formulario">
            Revisa tu conexión y recarga la página.
          </Aviso>
        )}
        {formulario.data && !formulario.data.disponible && !resultado && (
          <Aviso titulo="Las inscripciones no están abiertas">
            Vuelve a intentarlo más tarde o escríbenos.
          </Aviso>
        )}

        {resultado && <Exito resultado={resultado} correo={rep.correo.trim()} />}

        {formulario.data?.disponible && !resultado && (
          <div className="space-y-5">
            <ol className="grid grid-cols-4 gap-2" aria-label="Pasos">
              {PASOS.map((nombre, i) => (
                <li key={nombre} className="min-w-0">
                  <div
                    className={`h-1.5 rounded-full ${i <= paso ? 'bg-primary' : 'bg-muted-foreground/20'}`}
                  />
                  <p
                    className={`mt-1 truncate text-xs ${i === paso ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                    aria-current={i === paso ? 'step' : undefined}
                  >
                    {nombre}
                  </p>
                </li>
              ))}
            </ol>

            {errores.length > 0 && (
              <div
                role="alert"
                className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm"
              >
                <p className="mb-1 flex items-center gap-2 font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Revisa esto antes de seguir
                </p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {errores.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <section className="space-y-5 rounded-lg border bg-background p-4 sm:p-6">
              {paso === 0 && <PasoRepresentante rep={rep} onChange={setRep} />}
              {paso === 1 && (
                <PasoAlumnos alumnos={alumnos} onChange={setAlumnos} formulario={formulario.data} />
              )}
              {paso === 2 && (
                <PasoDocumentos
                  formulario={formulario.data}
                  rep={rep}
                  alumnos={alumnos}
                  cobro={cotizacion.data}
                  acepta={acepta}
                  onAcepta={(t, v) => setAcepta((a) => ({ ...a, [t]: v }))}
                />
              )}
              {paso === 3 && (
                <PasoPago
                  vista={vista}
                  preparando={preparando}
                  onArchivo={elegirComprobante}
                  alumnos={alumnos}
                  cobro={cotizacion.data}
                  cargandoCobro={cotizacion.isFetching}
                />
              )}
            </section>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              {paso > 0 ? (
                <Button
                  variant="outline"
                  className="h-12 sm:h-10"
                  onClick={() => irA(paso - 1)}
                  disabled={enviando}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                </Button>
              ) : (
                <span />
              )}
              {paso < PASOS.length - 1 ? (
                <Button className="h-12 sm:h-10" onClick={siguiente}>
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  className="h-12 sm:h-10"
                  onClick={enviar}
                  disabled={enviando || preparando || !comprobante}
                >
                  {enviando ? 'Enviando…' : 'Enviar inscripción'}
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------

const Aviso = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div className="rounded-lg border bg-background p-6 text-center">
    <p className="text-lg font-semibold">{titulo}</p>
    <p className="mt-2 text-sm text-muted-foreground">{children}</p>
  </div>
);

const Campo = ({
  id,
  etiqueta,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{etiqueta}</Label>
    {children}
    {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
  </div>
);

const PasoRepresentante = ({
  rep,
  onChange,
}: {
  rep: Representante;
  onChange: (r: Representante) => void;
}) => {
  const cambiar = (campo: keyof Representante) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...rep, [campo]: e.target.value });
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Tus datos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Eres el representante: con estos datos se crea tu cuenta en la plataforma.
        </p>
      </div>
      <Campo id="rep-nombre" etiqueta="Nombre completo">
        <Input
          id="rep-nombre"
          value={rep.nombre}
          onChange={cambiar('nombre')}
          autoComplete="name"
          className="h-11"
        />
      </Campo>
      <Campo
        id="rep-cedula"
        etiqueta="Cédula o pasaporte"
        ayuda="Será tu contraseña para entrar a la plataforma. Podrás cambiarla después."
      >
        <Input
          id="rep-cedula"
          value={rep.cedula}
          onChange={cambiar('cedula')}
          inputMode="text"
          autoComplete="off"
          maxLength={20}
          className="h-11"
        />
      </Campo>
      <Campo
        id="rep-correo"
        etiqueta="Correo electrónico"
        ayuda="Aquí te llegará el aviso cuando se apruebe la inscripción."
      >
        <Input
          id="rep-correo"
          type="email"
          value={rep.correo}
          onChange={cambiar('correo')}
          autoComplete="email"
          className="h-11"
        />
      </Campo>
      <Campo id="rep-telefono" etiqueta="Teléfono celular">
        <Input
          id="rep-telefono"
          type="tel"
          value={rep.telefono}
          onChange={cambiar('telefono')}
          autoComplete="tel"
          className="h-11"
        />
      </Campo>
      <Campo id="rep-sector" etiqueta="Sector donde vives (opcional)">
        <Input
          id="rep-sector"
          value={rep.sector_residencia}
          onChange={cambiar('sector_residencia')}
          className="h-11"
        />
      </Campo>
    </>
  );
};

const PasoAlumnos = ({
  alumnos,
  onChange,
  formulario,
}: {
  alumnos: Alumno[];
  onChange: (a: Alumno[]) => void;
  formulario: Formulario;
}) => {
  const cambiar = (clave: number, cambios: Partial<Alumno>) =>
    onChange(alumnos.map((a) => (a.clave === clave ? { ...a, ...cambios } : a)));

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Alumnos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Si inscribes a más de un hijo, agrégalos aquí. Cada uno tendrá su propio contrato.
        </p>
      </div>

      {alumnos.map((a, i) => (
        <FichaAlumno
          key={a.clave}
          alumno={a}
          numero={alumnos.length > 1 ? i + 1 : null}
          formulario={formulario}
          onChange={(c) => cambiar(a.clave, c)}
          onQuitar={
            alumnos.length > 1 ? () => onChange(alumnos.filter((x) => x.clave !== a.clave)) : null
          }
        />
      ))}

      {alumnos.length < 8 && (
        <Button
          variant="outline"
          className="h-11 w-full"
          onClick={() => onChange([...alumnos, alumnoVacio()])}
        >
          <Plus className="mr-2 h-4 w-4" /> Agregar otro alumno
        </Button>
      )}
    </>
  );
};

const FichaAlumno = ({
  alumno,
  numero,
  formulario,
  onChange,
  onQuitar,
}: {
  alumno: Alumno;
  numero: number | null;
  formulario: Formulario;
  onChange: (c: Partial<Alumno>) => void;
  onQuitar: (() => void) | null;
}) => {
  const id = (campo: string) => `alumno-${alumno.clave}-${campo}`;
  const colegio = formulario.colegios.find((c) => String(c.col_id) === alumno.col_id);

  /** Agrupadas por actividad: "Fútbol" con sus días, no 18 filas sueltas. */
  const porActividad = useMemo(() => {
    const grupos = new Map<string, DisciplinaOfertada[]>();
    for (const d of colegio?.disciplinas ?? []) {
      grupos.set(d.actividad, [...(grupos.get(d.actividad) ?? []), d]);
    }
    return [...grupos.entries()];
  }, [colegio]);

  const alternar = (colacthorId: number, marcado: boolean) =>
    onChange({
      disciplinas: marcado
        ? [...alumno.disciplinas, colacthorId]
        : alumno.disciplinas.filter((d) => d !== colacthorId),
    });

  return (
    <div className="space-y-4 rounded-md border p-3 sm:p-4">
      {(numero !== null || onQuitar) && (
        <div className="flex items-center justify-between">
          <p className="font-medium">Alumno {numero}</p>
          {onQuitar && (
            <Button variant="ghost" size="sm" onClick={onQuitar} className="text-destructive">
              <Trash2 className="mr-1 h-4 w-4" /> Quitar
            </Button>
          )}
        </div>
      )}

      <Campo id={id('nombre')} etiqueta="Nombre completo del alumno">
        <Input
          id={id('nombre')}
          value={alumno.nombre}
          onChange={(e) => onChange({ nombre: e.target.value })}
          autoComplete="off"
          className="h-11"
        />
      </Campo>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id={id('nacimiento')} etiqueta="Fecha de nacimiento">
          <Input
            id={id('nacimiento')}
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={alumno.fecha_nacimiento}
            onChange={(e) => onChange({ fecha_nacimiento: e.target.value })}
            className="h-11"
          />
        </Campo>
        <Campo id={id('cedula')} etiqueta="Cédula del alumno (opcional)">
          <Input
            id={id('cedula')}
            value={alumno.cedula}
            onChange={(e) => onChange({ cedula: e.target.value })}
            maxLength={20}
            className="h-11"
          />
        </Campo>
      </div>

      <Campo id={id('parentesco')} etiqueta="Tú eres su…">
        <Select value={alumno.parentesco} onValueChange={(v) => onChange({ parentesco: v })}>
          <SelectTrigger id={id('parentesco')} className="h-11">
            <SelectValue placeholder="Elige" />
          </SelectTrigger>
          <SelectContent>
            {formulario.parentescos.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Campo>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id={id('colegio')} etiqueta="Colegio">
          <Select
            value={alumno.col_id}
            onValueChange={(v) => onChange({ col_id: v, disciplinas: [] })}
          >
            <SelectTrigger id={id('colegio')} className="h-11">
              <SelectValue placeholder="Elige el colegio" />
            </SelectTrigger>
            <SelectContent>
              {formulario.colegios.map((c) => (
                <SelectItem key={c.col_id} value={String(c.col_id)}>
                  {c.col_nombre} · {dinero(c.precio)} al mes por disciplina
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo id={id('grado')} etiqueta="Grado (opcional)">
          <Select
            value={alumno.catninograd_id}
            onValueChange={(v) => onChange({ catninograd_id: v })}
          >
            <SelectTrigger id={id('grado')} className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_GRADO}>Sin indicar</SelectItem>
              {formulario.grados.map((g) => (
                <SelectItem key={g.catninograd_id} value={String(g.catninograd_id)}>
                  {g.catninograd_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
      </div>

      {colegio && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">
            Disciplinas{' '}
            <span className="font-normal text-muted-foreground">
              · {dinero(colegio.precio)} al mes cada una
            </span>
          </legend>
          {porActividad.map(([actividad, horarios]) => (
            <div key={actividad} className="rounded-md bg-muted/40 p-3">
              <p className="mb-2 text-sm font-medium">{actividad}</p>
              <div className="space-y-1">
                {horarios.map((d) => {
                  const cid = id(`disc-${d.colacthor_id}`);
                  return (
                    <label
                      key={d.colacthor_id}
                      htmlFor={cid}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-1"
                    >
                      <Checkbox
                        id={cid}
                        checked={alumno.disciplinas.includes(d.colacthor_id)}
                        onCheckedChange={(v) => alternar(d.colacthor_id, v === true)}
                      />
                      <span className="text-sm">
                        {d.dia} · {d.hora_inicio} a {d.hora_fin}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </fieldset>
      )}

      <div className="flex min-h-11 items-center justify-between gap-3">
        <Label htmlFor={id('transporte')}>¿Usa el transporte escolar?</Label>
        <Switch
          id={id('transporte')}
          checked={alumno.toma_transporte}
          onCheckedChange={(v) => onChange({ toma_transporte: v })}
        />
      </div>

      <Campo
        id={id('salud')}
        etiqueta="Información de salud (opcional)"
        ayuda="Alergias, condiciones o medicación que el entrenador deba conocer."
      >
        <Textarea
          id={id('salud')}
          value={alumno.info_salud}
          onChange={(e) => onChange({ info_salud: e.target.value })}
          maxLength={1000}
        />
      </Campo>
      <Campo id={id('otra')} etiqueta="Algo más que debamos saber (opcional)">
        <Textarea
          id={id('otra')}
          value={alumno.otra_info}
          onChange={(e) => onChange({ otra_info: e.target.value })}
          maxLength={1000}
        />
      </Campo>
    </div>
  );
};

const PasoDocumentos = ({
  formulario,
  rep,
  alumnos,
  acepta,
  onAcepta,
  cobro,
}: {
  formulario: Formulario;
  rep: Representante;
  alumnos: Alumno[];
  acepta: Record<TipoDocumento, boolean>;
  onAcepta: (t: TipoDocumento, v: boolean) => void;
  cobro: Cobro | undefined;
}) => {
  const [alumnoContrato, setAlumnoContrato] = useState(alumnos[0]?.clave ?? 0);
  const indice = Math.max(
    0,
    alumnos.findIndex((a) => a.clave === alumnoContrato),
  );
  const alumno = alumnos[indice];

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Documentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Léelos y marca cada casilla. Marcar las tres equivale a firmar el contrato.
        </p>
      </div>

      {TIPOS.map((tipo) => {
        const doc = formulario.documentos[tipo]!;
        const texto =
          tipo === 'contrato'
            ? rellenarContrato(doc.doc_contenido, rep, alumno, formulario, cobro?.alumnos[indice])
            : doc.doc_contenido;
        return (
          <div key={tipo} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{doc.doc_titulo}</h2>
              {tipo === 'contrato' && alumnos.length > 1 && (
                <Select
                  value={String(alumno?.clave)}
                  onValueChange={(v) => setAlumnoContrato(Number(v))}
                >
                  <SelectTrigger className="h-10 w-auto min-w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {alumnos.map((a, i) => (
                      <SelectItem key={a.clave} value={String(a.clave)}>
                        {a.nombre.trim() || `Alumno ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div
              className="max-h-72 overflow-y-auto rounded-md border bg-muted/30 p-3"
              tabIndex={0}
              aria-label={doc.doc_titulo}
            >
              <TextoLegal texto={texto} />
            </div>
            <label
              htmlFor={`acepta-${tipo}`}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3"
            >
              <Checkbox
                id={`acepta-${tipo}`}
                checked={acepta[tipo]}
                onCheckedChange={(v) => onAcepta(tipo, v === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                {tipo === 'contrato'
                  ? alumnos.length > 1
                    ? `He leído y acepto el contrato, uno por cada alumno (${alumnos.length}).`
                    : 'He leído y acepto el contrato.'
                  : `He leído y acepto ${tipo === 'terminos' ? 'los términos y condiciones' : 'la política de privacidad'}.`}
              </span>
            </label>
          </div>
        );
      })}
    </>
  );
};

const PasoPago = ({
  vista,
  preparando,
  onArchivo,
  alumnos,
  cobro,
  cargandoCobro,
}: {
  vista: string | null;
  preparando: boolean;
  onArchivo: (f: File | undefined) => void;
  alumnos: Alumno[];
  cobro: Cobro | undefined;
  cargandoCobro: boolean;
}) => (
  <>
    <div>
      <h1 className="text-xl font-semibold">Pago</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Transfiere o deposita el total y sube una foto o captura del comprobante
        {alumnos.length > 1 ? `, uno solo por los ${alumnos.length} alumnos` : ''}.
      </p>
    </div>

    <div className="rounded-md border">
      {cobro ? (
        <>
          <ul className="divide-y">
            {cobro.alumnos.map((c, i) => (
              <li key={alumnos[i]?.clave ?? i} className="flex items-start justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{alumnos[i]?.nombre.trim() || `Alumno ${i + 1}`}</p>
                  <p className="text-muted-foreground">
                    {c.disciplinas} disciplina{c.disciplinas === 1 ? '' : 's'} ×{' '}
                    {dinero(c.precio_disciplina)}
                    {c.descuento > 0 && (
                      <>
                        {' '}
                        − {c.descuento_pct} % por hermano en {c.disciplinas_con_descuento}
                      </>
                    )}
                  </p>
                </div>
                <span className="whitespace-nowrap font-medium">{dinero(c.total)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t bg-muted/40 p-3">
            <span className="font-semibold">Total mensual</span>
            <span className="text-lg font-bold">{dinero(cobro.total)}</span>
          </div>
        </>
      ) : (
        <p className="p-3 text-sm text-muted-foreground">
          {cargandoCobro ? 'Calculando el total…' : 'No se pudo calcular el total. Vuelve al paso anterior.'}
        </p>
      )}
    </div>

    <label
      htmlFor="comprobante"
      className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 text-center hover:bg-muted/40"
    >
      {vista ? (
        <img src={vista} alt="Comprobante elegido" className="max-h-72 rounded object-contain" />
      ) : (
        <>
          <ImageUp className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">
            {preparando ? 'Preparando la imagen…' : 'Toca para elegir la imagen'}
          </span>
        </>
      )}
      {vista && (
        <span className="text-sm text-muted-foreground">
          {preparando ? 'Preparando la imagen…' : 'Toca para cambiarla'}
        </span>
      )}
    </label>
    <input
      id="comprobante"
      type="file"
      accept="image/*"
      className="sr-only"
      onChange={(e) => {
        void onArchivo(e.target.files?.[0]);
        e.target.value = '';
      }}
    />

    <p className="text-xs text-muted-foreground">
      Al enviar, tu inscripción queda en revisión. No se crea tu cuenta hasta que la aprobemos.
    </p>
  </>
);

const Exito = ({ resultado, correo }: { resultado: EnvioRecibido; correo: string }) => (
  <div className="space-y-5 rounded-lg border bg-background p-6">
    <div className="text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
      <h1 className="mt-3 text-xl font-semibold">¡Inscripción enviada!</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Total mensual: {dinero(resultado.total)}
      </p>
    </div>
    <div className="space-y-2 text-sm">
      <p>
        Vamos a revisar tus datos y el comprobante. Cuando la aprobemos te llegará un correo a{' '}
        <strong className="break-all">{correo}</strong> con tu acceso a la plataforma.
      </p>
      <p>
        Tu contraseña será tu <strong>número de cédula o pasaporte</strong>, tal como lo
        escribiste.
      </p>
    </div>
    {resultado.contratos.some((c) => c.url) && (
      <div className="space-y-2">
        <p className="text-sm font-medium">Descarga tu copia del contrato ahora:</p>
        {resultado.contratos.map(
          (c) =>
            c.url && (
              <Button key={c.alumno} variant="outline" className="h-11 w-full" asChild>
                <a href={c.url} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-4 w-4" /> Contrato de {c.alumno}
                </a>
              </Button>
            ),
        )}
        <p className="text-xs text-muted-foreground">
          Los enlaces caducan en unos minutos. Si pierdes tu copia, pídenosla.
        </p>
      </div>
    )}
  </div>
);

export default Inscripcion;
