import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  ImageUp,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  TIPOS_DOCUMENTO,
  type Cobro,
  type CobroAlumno,
  type DisciplinaOfertada,
  type EnvioRecibido,
  type Formulario,
  type ModalidadSalida,
  type PermisosImagen,
  type TipoDocumento,
} from '@/api/inscripciones';
import DocumentoVista from '@/components/inscripciones/DocumentoVista';
import {
  analizar,
  fechaLarga,
  porcentaje,
  tarifa,
  textoDeCasilla,
  textoDeSalud,
  type DatosDocumento,
} from '@/components/inscripciones/documento';
import { fechaNacimiento } from '@/components/inscripciones/formato';

/**
 * Formulario público de inscripción (Fase 14B).
 *
 * Llega por un correo masivo a representantes que todavía no tienen cuenta,
 * casi siempre en el móvil. Cada dato se escribe **una sola vez** aunque
 * salga en varios documentos: los pasos piden lo que piden las fichas del
 * cliente (matrícula, salud, imagen) y el último paso enseña los seis
 * documentos ya llenos para aceptarlos. Aceptar es firmar: no hay firma
 * dibujada (decisión del cliente, 2026-10-05).
 *
 * Al enviar no se crea ninguna cuenta: queda pendiente hasta que Activa
 * Reforce revise el comprobante. Al aprobarla le llega un correo con su
 * acceso, y su contraseña es su cédula.
 */

const PASOS = ['Tus datos', 'Alumnos', 'Salud, imagen y datos', 'Documentos', 'Pago'] as const;
/** Lo que se acepta en el paso Documentos; los otros tres se contestan en el paso anterior. */
const A_ACEPTAR: Array<[TipoDocumento, string]> = [
  ['ficha_matricula', 'He leído y acepto la ficha de matrícula.'],
  ['contrato', 'He leído y acepto el contrato.'],
  ['politica', 'He leído y acepto la Política de Tratamiento y Protección de Datos Personales.'],
];

interface Representante {
  nombre: string;
  cedula: string;
  correo: string;
  telefono: string;
  /** La factura sale a nombre del representante, salvo que diga otra cosa. */
  facturaPropia: boolean;
  factura: { nombre: string; identificacion: string; correo: string; direccion: string };
}

interface Alumno {
  clave: number;
  nombre: string;
  fecha_nacimiento: string;
  col_id: string;
  catninograd_id: string;
  parentesco: string;
  disciplinas: number[];
  emergencia: { nombre: string; relacion: string; telefono: string };
  retiro: { nombre: string; cedula: string; relacion: string; telefono: string };
  /** "Yo retiraré al menor": la persona autorizada es el representante. */
  yo_retiro: boolean;
  modalidad_salida: ModalidadSalida | '';
  detalle_retiro: string;
  salud_tiene: '' | 'no' | 'si';
  salud_detalle: string;
  salud_autoriza: boolean;
  imagen: PermisosImagen;
}

let siguienteClave = 1;
const alumnoVacio = (): Alumno => ({
  clave: siguienteClave++,
  nombre: '',
  fecha_nacimiento: '',
  col_id: '',
  catninograd_id: '',
  parentesco: '',
  disciplinas: [],
  emergencia: { nombre: '', relacion: '', telefono: '' },
  retiro: { nombre: '', cedula: '', relacion: '', telefono: '' },
  yo_retiro: false,
  modalidad_salida: '',
  detalle_retiro: '',
  salud_tiene: '',
  salud_detalle: '',
  salud_autoriza: false,
  imagen: { familias: false, redes: false, promocional: false },
});

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Solo números (decisión del cliente, 2026-10-05). */
const TELEFONO = /^\d{7,15}$/;
/** Cédula ecuatoriana: exactamente 10 números. */
const CEDULA = /^\d{10}$/;
const soloNumeros = (v: string) => v.replace(/\D/g, '');
const IDENTIFICACION = /^[0-9A-Za-z-]{6,20}$/;

/** La factura que se manda: la propia o la que escribió. */
function facturaDe(r: Representante) {
  return r.facturaPropia
    ? {
        nombre: r.nombre.trim(),
        identificacion: r.cedula.trim(),
        correo: r.correo.trim(),
        direccion: r.factura.direccion.trim(),
      }
    : {
        nombre: r.factura.nombre.trim(),
        identificacion: r.factura.identificacion.trim(),
        correo: r.factura.correo.trim(),
        direccion: r.factura.direccion.trim(),
      };
}

function erroresRepresentante(r: Representante): string[] {
  const e: string[] = [];
  if (r.nombre.trim().length < 3) e.push('Escribe tu nombre completo.');
  if (!CEDULA.test(r.cedula.trim())) e.push('La cédula debe tener 10 números.');
  if (!CORREO.test(r.correo.trim())) e.push('El correo no es válido.');
  if (!TELEFONO.test(r.telefono.trim())) e.push('El teléfono debe tener entre 7 y 15 números.');
  const f = facturaDe(r);
  if (!r.facturaPropia) {
    if (f.nombre.length < 3) e.push('Escribe el nombre para la factura.');
    if (!IDENTIFICACION.test(f.identificacion)) e.push('La cédula o RUC de la factura no es válida.');
    if (!CORREO.test(f.correo)) e.push('El correo para la factura no es válido.');
  }
  if (f.direccion.length < 5) e.push('Escribe la dirección para la factura.');
  return e;
}

function edadEnAnos(aaaammdd: string): number | null {
  const fecha = new Date(`${aaaammdd}T12:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return null;
  return (Date.now() - fecha.getTime()) / (365.25 * 24 * 3600 * 1000);
}

const quienDe = (alumnos: Alumno[], i: number) =>
  alumnos.length > 1 ? `${alumnos[i]!.nombre.trim() || `Alumno ${i + 1}`}: ` : '';

function erroresAlumnos(alumnos: Alumno[]): string[] {
  const e: string[] = [];
  alumnos.forEach((a, i) => {
    const quien = quienDe(alumnos, i);
    if (a.nombre.trim().length < 3) e.push(`${quien}escribe su nombre completo.`);
    const edad = a.fecha_nacimiento ? edadEnAnos(a.fecha_nacimiento) : null;
    if (edad === null) e.push(`${quien}falta la fecha de nacimiento.`);
    else if (edad < 2 || edad > 20) e.push(`${quien}revisa la fecha de nacimiento.`);
    if (!a.parentesco) e.push(`${quien}indica tu parentesco.`);
    if (!a.col_id) e.push(`${quien}elige el colegio.`);
    else if (a.disciplinas.length === 0) e.push(`${quien}elige al menos una disciplina.`);
    if (!a.catninograd_id) e.push(`${quien}elige el curso.`);
    const em = a.emergencia;
    if (em.nombre.trim().length < 3 || em.relacion.trim().length < 2 || !TELEFONO.test(em.telefono.trim()))
      e.push(`${quien}completa el contacto de emergencia (nombre, relación y teléfono).`);
    if (!a.yo_retiro && retiroDe(a) === 'incompleto')
      e.push(`${quien}completa los datos de quien lo retira (nombre, cédula, relación y teléfono) o déjalos vacíos.`);
    if (!a.modalidad_salida) e.push(`${quien}elige transporte escolar o privado.`);
  });
  return e;
}

/**
 * La persona autorizada para retirarlo: el representante si marcó "Yo
 * retiraré al menor"; si no, la que escribió, o nadie si dejó todo vacío.
 */
function retiroDe(a: Alumno, rep?: Representante) {
  if (a.yo_retiro && rep) {
    return {
      nombre: rep.nombre.trim(),
      cedula: rep.cedula.trim(),
      relacion: a.parentesco,
      telefono: rep.telefono.trim(),
    };
  }
  const r = {
    nombre: a.retiro.nombre.trim(),
    cedula: a.retiro.cedula.trim(),
    relacion: a.retiro.relacion.trim(),
    telefono: a.retiro.telefono.trim(),
  };
  const campos = Object.values(r);
  if (campos.every((c) => c === '')) return null;
  if (
    r.nombre.length < 3 ||
    r.relacion.length < 2 ||
    !TELEFONO.test(r.telefono) ||
    !IDENTIFICACION.test(r.cedula)
  )
    return 'incompleto' as const;
  return r;
}

function erroresSalud(alumnos: Alumno[]): string[] {
  const e: string[] = [];
  alumnos.forEach((a, i) => {
    const quien = quienDe(alumnos, i);
    if (!a.salud_tiene) e.push(`${quien}responde la pregunta de salud.`);
    if (a.salud_tiene === 'si' && !a.salud_detalle.trim())
      e.push(`${quien}especifica la condición de salud.`);
    if (a.salud_tiene && !a.salud_autoriza)
      e.push(`${quien}marca la autorización del tratamiento de la información de salud.`);
  });
  return e;
}

function aBase64(archivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });
}

/** Con qué se llenan los documentos de un alumno, igual que en el PDF. */
function datosDocumento(
  rep: Representante,
  alumno: Alumno,
  formulario: Formulario,
  cobro: CobroAlumno | undefined,
): DatosDocumento {
  const colegio = formulario.colegios.find((c) => String(c.col_id) === alumno.col_id);
  const curso = formulario.grados.find((g) => String(g.catninograd_id) === alumno.catninograd_id);
  const elegidas = (colegio?.disciplinas ?? []).filter((d) => alumno.disciplinas.includes(d.colacthor_id));
  const factura = facturaDe(rep);
  const falta = (t: string, que: string) => t.trim() || `[${que}]`;
  return {
    valores: {
      fecha: fechaLarga(new Date()),
      representante_nombre: falta(rep.nombre, 'tu nombre'),
      representante_cedula: falta(rep.cedula, 'tu cédula'),
      alumno_nombre: falta(alumno.nombre, 'nombre del alumno'),
      sede: colegio?.sede ?? '[sede]',
      sede_corta: colegio?.sede_corta ?? '[sede]',
      institucion: colegio?.institucion ?? '[institución]',
      minimo_alumnos: colegio ? String(colegio.minimo_alumnos) : '[mínimo]',
      tarifa: colegio ? tarifa(colegio.precio) : '[tarifa]',
      descuento_hermano: colegio ? porcentaje(colegio.descuento_hermano) : '[descuento]',
    },
    representante: {
      nombre: rep.nombre.trim(),
      cedula: rep.cedula.trim(),
      telefono: rep.telefono.trim(),
      factura,
      aplicaDescuento: cobro ? (cobro.descuento_pct > 0 ? 'Sí' : 'No') : '',
    },
    alumno: {
      nombre: alumno.nombre.trim(),
      fecha_nacimiento: alumno.fecha_nacimiento ? fechaNacimiento(alumno.fecha_nacimiento) : '',
      curso: curso?.catninograd_nombre ?? '',
      actividades: [...new Set(elegidas.map((d) => d.actividad))].join(', '),
      horarios: elegidas.map((d) => `${d.actividad}: ${d.dia} ${d.hora_inicio} a ${d.hora_fin}`).join('; '),
      emergencia: alumno.emergencia,
      retiro: (() => {
        const r = retiroDe(alumno, rep);
        return r && r !== 'incompleto' ? r : { nombre: '', cedula: '', relacion: '', telefono: '' };
      })(),
      modalidad_salida: alumno.modalidad_salida || null,
      detalle_retiro: alumno.detalle_retiro.trim(),
      salud: {
        tiene: alumno.salud_tiene === '' ? null : alumno.salud_tiene === 'si',
        // Sin autorización, el detalle no se guarda: tampoco sale en el documento.
        detalle: alumno.salud_tiene === 'si' ? alumno.salud_detalle.trim() : '',
        autoriza: alumno.salud_autoriza,
      },
      imagen: alumno.imagen,
    },
    fechaFirma: 'al enviar la inscripción',
    aprobacion: null,
  };
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
    facturaPropia: true,
    factura: { nombre: '', identificacion: '', correo: '', direccion: '' },
  });
  const [alumnos, setAlumnos] = useState<Alumno[]>(() => [alumnoVacio()]);
  const [acepta, setAcepta] = useState<Record<TipoDocumento, boolean>>(
    () => Object.fromEntries(TIPOS_DOCUMENTO.map((t) => [t, false])) as Record<TipoDocumento, boolean>,
  );
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const [resultado, setResultado] = useState<EnvioRecibido | null>(null);
  const arriba = useRef<HTMLDivElement>(null);

  // El total lo calcula el backend con los precios de la base, para que lo
  // que se ve aquí sea exactamente lo que dirán los documentos.
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
            ? [
                ...erroresSalud(alumnos),
                ...(acepta.autorizacion_datos ? [] : ['Falta autorizar el tratamiento de datos personales.']),
              ]
            : paso === 3
              ? A_ACEPTAR.filter(([t]) => !acepta[t]).map(([t]) => `Falta aceptar: ${NOMBRE_DOCUMENTO[t]}.`)
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
          factura: facturaDe(rep),
        },
        ninos: alumnos.map((a) => ({
          nombre: a.nombre.trim(),
          fecha_nacimiento: a.fecha_nacimiento,
          col_id: Number(a.col_id),
          catninograd_id: Number(a.catninograd_id),
          parentesco: a.parentesco,
          disciplinas: a.disciplinas,
          emergencia: {
            nombre: a.emergencia.nombre.trim(),
            relacion: a.emergencia.relacion.trim(),
            telefono: a.emergencia.telefono.trim(),
          },
          retiro: (() => {
            const r = retiroDe(a, rep);
            return r === 'incompleto' ? null : r;
          })(),
          modalidad_salida: a.modalidad_salida as ModalidadSalida,
          detalle_retiro: a.detalle_retiro.trim() || null,
          salud: {
            tiene: a.salud_tiene === 'si',
            detalle: a.salud_tiene === 'si' ? a.salud_detalle.trim() : null,
            autoriza: a.salud_autoriza,
          },
          imagen: a.imagen,
        })),
        documentos: Object.fromEntries(
          TIPOS_DOCUMENTO.map((t) => [t, datos.documentos[t]!.doc_id]),
        ) as Record<TipoDocumento, number>,
        acepta: Object.fromEntries(TIPOS_DOCUMENTO.map((t) => [t, true])) as Record<TipoDocumento, true>,
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
          setAcepta(Object.fromEntries(TIPOS_DOCUMENTO.map((t) => [t, false])) as Record<TipoDocumento, boolean>);
          setErrores([err.message]);
          setPaso(2);
        }
      } else if (err instanceof ApiError) {
        // El backend dice qué falta y dónde ("Alumno 1 · Salud: …").
        const problemas = (err.details as { problemas?: string[] } | undefined)?.problemas ?? [];
        setErrores(problemas.length > 0 ? problemas : [err.message]);
      } else {
        setErrores(['No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.']);
      }
      subir();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <img src="/activaIcon.png" alt="" className="h-9 w-9 rounded" />
          <div className="leading-tight">
            <p className="font-bold tracking-wide">ACTIVA REFORCE</p>
            <p className="text-xs text-muted-foreground">Inscripción</p>
          </div>
        </div>
      </header>

      <main ref={arriba} className="mx-auto max-w-3xl scroll-mt-4 px-4 py-6">
        {formulario.isLoading && <p className="py-16 text-center text-muted-foreground">Cargando…</p>}
        {formulario.isError && (
          <Aviso titulo="No se pudo abrir el formulario">Revisa tu conexión y recarga la página.</Aviso>
        )}
        {formulario.data && !formulario.data.disponible && !resultado && (
          <Aviso titulo="Las inscripciones no están abiertas">Vuelve a intentarlo más tarde o escríbenos.</Aviso>
        )}

        {resultado && <Exito resultado={resultado} correo={rep.correo.trim()} />}

        {formulario.data?.disponible && !resultado && (
          <div className="space-y-5">
            <ol className="grid grid-cols-5 gap-2" aria-label="Pasos">
              {PASOS.map((nombre, i) => (
                <li key={nombre} className="min-w-0">
                  <div className={`h-1.5 rounded-full ${i <= paso ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
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
              <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
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
                <PasoAlumnos alumnos={alumnos} onChange={setAlumnos} formulario={formulario.data} rep={rep} />
              )}
              {paso === 2 && (
                <PasoSalud
                  alumnos={alumnos}
                  onChange={setAlumnos}
                  formulario={formulario.data}
                  rep={rep}
                  aceptaDatos={acepta.autorizacion_datos}
                  onAceptaDatos={(v) => setAcepta((a) => ({ ...a, autorizacion_datos: v }))}
                />
              )}
              {paso === 3 && (
                <PasoDocumentos
                  formulario={formulario.data}
                  rep={rep}
                  alumnos={alumnos}
                  cobro={cotizacion.data}
                  acepta={acepta}
                  onAcepta={(t, v) => setAcepta((a) => ({ ...a, [t]: v }))}
                />
              )}
              {paso === 4 && (
                <PasoPago
                  cuentaBancaria={formulario.data.cuenta_bancaria}
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
                <Button variant="outline" className="h-12 sm:h-10" onClick={() => irA(paso - 1)} disabled={enviando}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                </Button>
              ) : (
                <span />
              )}
              {paso < PASOS.length - 1 ? (
                <Button
                  className="h-12 sm:h-10"
                  onClick={siguiente}
                  disabled={paso === 3 && A_ACEPTAR.some(([t]) => !acepta[t])}
                >
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button className="h-12 sm:h-10" onClick={enviar} disabled={enviando || preparando || !comprobante}>
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

const Texto = ({
  id,
  etiqueta,
  ayuda,
  valor,
  onChange,
  ...resto
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  valor: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'id'>) => (
  <Campo id={id} etiqueta={etiqueta} ayuda={ayuda}>
    <Input id={id} value={valor} onChange={(e) => onChange(e.target.value)} className="h-11" {...resto} />
  </Campo>
);

const PasoRepresentante = ({ rep, onChange }: { rep: Representante; onChange: (r: Representante) => void }) => {
  const poner = (campo: 'nombre' | 'cedula' | 'correo' | 'telefono') => (v: string) =>
    onChange({ ...rep, [campo]: v });
  const ponerFactura = (campo: keyof Representante['factura']) => (v: string) =>
    onChange({ ...rep, factura: { ...rep.factura, [campo]: v } });
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Tus datos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Eres el representante legal: con estos datos se crea tu cuenta en la plataforma.
        </p>
      </div>
      <Texto id="rep-nombre" etiqueta="Nombres y apellidos" valor={rep.nombre} onChange={poner('nombre')} autoComplete="name" />
      <Texto
        id="rep-cedula"
        etiqueta="Cédula"
        ayuda="Su cédula será su contraseña para entrar a la plataforma. Podrás cambiarla después."
        valor={rep.cedula}
        onChange={(v) => poner('cedula')(soloNumeros(v))}
        autoComplete="off"
        inputMode="numeric"
        maxLength={10}
      />
      <Texto
        id="rep-correo"
        etiqueta="Correo electrónico"
        ayuda="Aquí te llegará el aviso cuando se apruebe la inscripción."
        valor={rep.correo}
        onChange={poner('correo')}
        type="email"
        autoComplete="email"
      />
      <Texto
        id="rep-telefono"
        etiqueta="Teléfono"
        valor={rep.telefono}
        onChange={(v) => poner('telefono')(soloNumeros(v))}
        type="tel"
        inputMode="numeric"
        maxLength={15}
        autoComplete="tel"
      />

      <div className="space-y-4 border-t pt-5">
        <h2 className="font-semibold">Facturación</h2>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <Label htmlFor="factura-propia">La factura va a mi nombre, con mi cédula y mi correo</Label>
          <Switch
            id="factura-propia"
            checked={rep.facturaPropia}
            onCheckedChange={(v) => onChange({ ...rep, facturaPropia: v })}
          />
        </div>
        {!rep.facturaPropia && (
          <>
            <Texto id="fac-nombre" etiqueta="Nombres y apellidos para factura" valor={rep.factura.nombre} onChange={ponerFactura('nombre')} />
            <Texto
              id="fac-id"
              etiqueta="Cédula o RUC"
              valor={rep.factura.identificacion}
              onChange={ponerFactura('identificacion')}
              maxLength={20}
            />
            <Texto
              id="fac-correo"
              etiqueta="Correo electrónico para factura"
              valor={rep.factura.correo}
              onChange={ponerFactura('correo')}
              type="email"
            />
          </>
        )}
        <Texto id="fac-direccion" etiqueta="Dirección para factura" valor={rep.factura.direccion} onChange={ponerFactura('direccion')} autoComplete="street-address" />
      </div>
    </>
  );
};

const PasoAlumnos = ({
  alumnos,
  onChange,
  formulario,
  rep,
}: {
  alumnos: Alumno[];
  onChange: (a: Alumno[]) => void;
  formulario: Formulario;
  rep: Representante;
}) => {
  const cambiar = (clave: number, cambios: Partial<Alumno>) =>
    onChange(alumnos.map((a) => (a.clave === clave ? { ...a, ...cambios } : a)));

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Alumnos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Si inscribes a más de un hijo, agrégalos aquí. Cada uno tendrá sus propios documentos.
        </p>
      </div>

      {alumnos.map((a, i) => (
        <FichaAlumno
          key={a.clave}
          alumno={a}
          numero={alumnos.length > 1 ? i + 1 : null}
          formulario={formulario}
          rep={rep}
          onChange={(c) => cambiar(a.clave, c)}
          onQuitar={alumnos.length > 1 ? () => onChange(alumnos.filter((x) => x.clave !== a.clave)) : null}
        />
      ))}

      {alumnos.length < 8 && (
        <Button variant="outline" className="h-11 w-full" onClick={() => onChange([...alumnos, alumnoVacio()])}>
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
  rep,
  onChange,
  onQuitar,
}: {
  alumno: Alumno;
  numero: number | null;
  formulario: Formulario;
  rep: Representante;
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

      <Texto id={id('nombre')} etiqueta="Nombres y apellidos del estudiante" valor={alumno.nombre} onChange={(v) => onChange({ nombre: v })} autoComplete="off" />

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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id={id('colegio')} etiqueta="Colegio">
          <Select value={alumno.col_id} onValueChange={(v) => onChange({ col_id: v, disciplinas: [] })}>
            <SelectTrigger id={id('colegio')} className="h-11">
              <SelectValue placeholder="Elige el colegio" />
            </SelectTrigger>
            <SelectContent>
              {formulario.colegios.map((c) => (
                <SelectItem key={c.col_id} value={String(c.col_id)}>
                  {c.col_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo id={id('grado')} etiqueta="Curso">
          <Select value={alumno.catninograd_id} onValueChange={(v) => onChange({ catninograd_id: v })}>
            <SelectTrigger id={id('grado')} className="h-11">
              <SelectValue placeholder="Elige el curso" />
            </SelectTrigger>
            <SelectContent>
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
        <section className="space-y-3 border-t pt-5">
          <h2 className="font-semibold">
            Disciplina contratada{' '}
            <span className="text-sm font-normal text-muted-foreground">
              · {dinero(colegio.precio)} al mes más IVA, cada una
            </span>
          </h2>
          {porActividad.map(([actividad, horarios]) => (
            <div key={actividad} className="rounded-md bg-muted/40 p-3">
              <p className="mb-2 text-sm font-medium">{actividad}</p>
              <div className="space-y-1">
                {horarios.map((d) => {
                  const cid = id(`disc-${d.colacthor_id}`);
                  return (
                    <label key={d.colacthor_id} htmlFor={cid} className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-1">
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
        </section>
      )}

      <section className="space-y-3 border-t pt-5">
        <h2 className="font-semibold">Contacto alterno de emergencia</h2>
        <Texto id={id('em-nombre')} etiqueta="Nombres y apellidos" valor={alumno.emergencia.nombre} onChange={(v) => onChange({ emergencia: { ...alumno.emergencia, nombre: v } })} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Texto id={id('em-relacion')} etiqueta="Relación con el menor" valor={alumno.emergencia.relacion} onChange={(v) => onChange({ emergencia: { ...alumno.emergencia, relacion: v } })} />
          <Texto
            id={id('em-telefono')}
            etiqueta="Teléfono"
            type="tel"
            inputMode="numeric"
            maxLength={15}
            valor={alumno.emergencia.telefono}
            onChange={(v) => onChange({ emergencia: { ...alumno.emergencia, telefono: soloNumeros(v) } })}
          />
        </div>
      </section>

      <section className="space-y-3 border-t pt-5">
        <h2 className="font-semibold">Retiro del menor y transporte</h2>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <Label htmlFor={id('yo-retiro')}>Yo retiraré al menor</Label>
          <Switch
            id={id('yo-retiro')}
            checked={alumno.yo_retiro}
            onCheckedChange={(v) => onChange({ yo_retiro: v })}
          />
        </div>
        {(() => {
          // Con "Yo retiraré al menor" salen sus datos, sin poder cambiarlos.
          const r = alumno.yo_retiro
            ? { nombre: rep.nombre, cedula: rep.cedula, relacion: alumno.parentesco, telefono: rep.telefono }
            : alumno.retiro;
          const poner = (campo: keyof Alumno['retiro']) => (v: string) =>
            onChange({ retiro: { ...alumno.retiro, [campo]: campo === 'telefono' ? soloNumeros(v) : v } });
          return (
            <>
              <Texto id={id('re-nombre')} etiqueta="Persona autorizada para retirar al menor" valor={r.nombre} onChange={poner('nombre')} disabled={alumno.yo_retiro} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Texto id={id('re-cedula')} etiqueta="Cédula / identificación" maxLength={20} valor={r.cedula} onChange={poner('cedula')} disabled={alumno.yo_retiro} />
                <Texto id={id('re-relacion')} etiqueta="Relación con el menor" valor={r.relacion} onChange={poner('relacion')} disabled={alumno.yo_retiro} />
                <Texto
                  id={id('re-telefono')}
                  etiqueta="Teléfono"
                  type="tel"
                  inputMode="numeric"
                  maxLength={15}
                  valor={r.telefono}
                  onChange={poner('telefono')}
                  disabled={alumno.yo_retiro}
                />
              </div>
            </>
          );
        })()}
        <Campo id={id('modalidad')} etiqueta="Modalidad de salida / recorrido">
          <RadioGroup
            id={id('modalidad')}
            value={alumno.modalidad_salida}
            onValueChange={(v) => onChange({ modalidad_salida: v as ModalidadSalida })}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            {(
              [
                ['escolar', 'Transporte escolar'],
                ['privado', 'Transporte privado'],
              ] as const
            ).map(([valor, texto]) => (
              <label key={valor} htmlFor={id(`mod-${valor}`)} className="flex min-h-11 cursor-pointer items-center gap-2">
                <RadioGroupItem id={id(`mod-${valor}`)} value={valor} />
                <span className="text-sm">{texto}</span>
              </label>
            ))}
          </RadioGroup>
        </Campo>
        <Campo id={id('detalle-retiro')} etiqueta="Detalle del recorrido, ruta o instrucciones de retiro (opcional)">
          <Textarea
            id={id('detalle-retiro')}
            value={alumno.detalle_retiro}
            onChange={(e) => onChange({ detalle_retiro: e.target.value })}
            maxLength={500}
          />
        </Campo>
      </section>
    </div>
  );
};

/**
 * Las fichas de salud y de imagen. Las preguntas y las casillas salen del
 * texto publicado de cada documento: si Activa cambia la redacción, aquí
 * cambia también.
 */
const PasoSalud = ({
  alumnos,
  onChange,
  formulario,
  rep,
  aceptaDatos,
  onAceptaDatos,
}: {
  alumnos: Alumno[];
  onChange: (a: Alumno[]) => void;
  formulario: Formulario;
  rep: Representante;
  aceptaDatos: boolean;
  onAceptaDatos: (v: boolean) => void;
}) => {
  const [politica, setPolitica] = useState(false);
  const autorizacion = formulario.documentos.autorizacion_datos?.doc_contenido;
  const bloquesDatos = autorizacion ? analizar(autorizacion) : [];
  const introDatos = bloquesDatos.flatMap((b) => (b.t === 'parrafo' ? [b.texto] : []));
  const enlacePolitica =
    bloquesDatos.flatMap((b) => (b.t === 'politica' ? [b.texto] : []))[0] ??
    'Ver Política de Tratamiento y Protección de Datos Personales';
  const casillaDatos =
    textoDeCasilla(autorizacion, 'acepta') ?? 'Autorizo el tratamiento de mis datos personales y los del menor.';
  const docPolitica = formulario.documentos.politica!;
  const cambiar = (clave: number, cambios: Partial<Alumno>) =>
    onChange(alumnos.map((a) => (a.clave === clave ? { ...a, ...cambios } : a)));
  const medicos = formulario.documentos.datos_medicos?.doc_contenido;
  const imagen = formulario.documentos.imagen?.doc_contenido;
  const pregunta = textoDeSalud(medicos) ?? '¿Existe alguna condición de salud que debamos conocer?';
  const autoriza = textoDeCasilla(medicos, 'autoriza') ?? 'Autorizo el tratamiento de esta información de salud.';
  const introImagen = imagen
    ? analizar(imagen).filter((b) => b.t === 'parrafo').map((b) => (b.t === 'parrafo' ? b.texto : ''))
    : [];
  const permisos: Array<[keyof PermisosImagen, string]> = [
    ['familias', textoDeCasilla(imagen, 'familias') ?? 'Compartir con las familias del grupo'],
    ['redes', textoDeCasilla(imagen, 'redes') ?? 'Publicar en redes sociales'],
    ['promocional', textoDeCasilla(imagen, 'promocional') ?? 'Material promocional'],
  ];

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Salud, imagen y tratamiento de datos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Salud e imagen, por cada alumno.</p>
      </div>
      {alumnos.map((a, i) => {
        const id = (c: string) => `salud-${a.clave}-${c}`;
        return (
          <div key={a.clave} className="space-y-5 rounded-md border p-3 sm:p-4">
            {alumnos.length > 1 && <p className="font-medium">{a.nombre.trim() || `Alumno ${i + 1}`}</p>}

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Información de salud</h2>
              <p className="text-sm">{pregunta}</p>
              <RadioGroup
                value={a.salud_tiene}
                onValueChange={(v) => cambiar(a.clave, { salud_tiene: v as 'no' | 'si' })}
                className="flex flex-wrap gap-x-6 gap-y-2"
              >
                {(
                  [
                    ['no', 'No'],
                    ['si', 'Sí'],
                  ] as const
                ).map(([valor, texto]) => (
                  <label key={valor} htmlFor={id(valor)} className="flex min-h-11 cursor-pointer items-center gap-2">
                    <RadioGroupItem id={id(valor)} value={valor} />
                    <span className="text-sm">{texto}</span>
                  </label>
                ))}
              </RadioGroup>
              {a.salud_tiene === 'si' && (
                <Campo id={id('detalle')} etiqueta="Especifique">
                  <Textarea
                    id={id('detalle')}
                    value={a.salud_detalle}
                    onChange={(e) => cambiar(a.clave, { salud_detalle: e.target.value })}
                    maxLength={1000}
                  />
                </Campo>
              )}
              {a.salud_tiene && (
                <>
                  <label htmlFor={id('autoriza')} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3">
                    <Checkbox
                      id={id('autoriza')}
                      checked={a.salud_autoriza}
                      onCheckedChange={(v) => cambiar(a.clave, { salud_autoriza: v === true })}
                      className="mt-0.5"
                    />
                    <span className="text-sm">{autoriza}</span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Esta información será de acceso restringido y solo se compartirá con la institución
                    educativa, personal médico o servicios de emergencia cuando sea necesario para proteger al
                    menor.
                  </p>
                </>
              )}
            </section>

            <section className="space-y-3 border-t pt-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Uso de imagen</h2>
              {introImagen.map((t) => (
                <p key={t} className="text-sm text-muted-foreground">
                  {t}
                </p>
              ))}
              {permisos.map(([clave, texto]) => (
                <label key={clave} htmlFor={id(`img-${clave}`)} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    id={id(`img-${clave}`)}
                    checked={a.imagen[clave]}
                    onCheckedChange={(v) => cambiar(a.clave, { imagen: { ...a.imagen, [clave]: v === true } })}
                    className="mt-0.5"
                  />
                  <span className="text-sm">{texto}</span>
                </label>
              ))}
            </section>
          </div>
        );
      })}

      <section className="space-y-3 rounded-md border p-3 sm:p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tratamiento de datos personales
        </h2>
        {introDatos.map((t) => (
          <p key={t} className="text-sm text-muted-foreground">
            {t}
          </p>
        ))}
        <label htmlFor="acepta-datos" className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3">
          <Checkbox
            id="acepta-datos"
            checked={aceptaDatos}
            onCheckedChange={(v) => onAceptaDatos(v === true)}
            className="mt-0.5"
          />
          <span className="text-sm">
            {casillaDatos}
            {alumnos.length > 1 ? ` (para los ${alumnos.length} alumnos)` : ''}
          </span>
        </label>
        <button
          type="button"
          onClick={() => setPolitica(true)}
          className="text-left text-sm text-primary underline underline-offset-2"
        >
          {enlacePolitica}
        </button>
      </section>

      <Dialog open={politica} onOpenChange={setPolitica}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{NOMBRE_DOCUMENTO.politica}</DialogTitle>
            <DialogDescription>Versión {docPolitica.doc_version}</DialogDescription>
          </DialogHeader>
          <DocumentoVista
            tipo="politica"
            titulo={docPolitica.doc_titulo}
            contenido={docPolitica.doc_contenido}
            datos={datosDocumento(rep, alumnos[0]!, formulario, undefined)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

/**
 * Para leer y confirmar: una tarjeta por documento, ya lleno, que se abre en
 * una ventana. Salud, imagen y tratamiento de datos ya se contestaron en el
 * paso anterior; aquí solo se aceptan la ficha, el contrato y la política
 * (decisión del cliente, 2026-10-05).
 */
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
  const [claveAlumno, setClaveAlumno] = useState(alumnos[0]?.clave ?? 0);
  const [abierto, setAbierto] = useState<TipoDocumento | null>(null);
  const indice = Math.max(0, alumnos.findIndex((a) => a.clave === claveAlumno));
  const alumno = alumnos[indice]!;
  const datos = datosDocumento(rep, alumno, formulario, cobro?.alumnos[indice]);
  const doc = abierto ? formulario.documentos[abierto] : undefined;
  const varios = alumnos.length > 1 ? ` (para los ${alumnos.length} alumnos)` : '';

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Documentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Están llenos con lo que escribiste. Toca cada uno para leerlo y acepta al final.
        </p>
      </div>

      {alumnos.length > 1 && (
        <Campo id="docs-alumno" etiqueta="Documentos de">
          <Select value={String(alumno.clave)} onValueChange={(v) => setClaveAlumno(Number(v))}>
            <SelectTrigger id="docs-alumno" className="h-11">
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
        </Campo>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TIPOS_DOCUMENTO.map((tipo) => (
          <button
            key={tipo}
            type="button"
            onClick={() => setAbierto(tipo)}
            className="flex min-h-14 items-center gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{NOMBRE_DOCUMENTO[tipo]}</span>
              <span className="block text-xs text-muted-foreground">Toca para leerlo</span>
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2 border-t pt-5">
        {A_ACEPTAR.map(([tipo, texto]) => (
          <label
            key={tipo}
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
              {texto.replace(/\.$/, '')}
              {varios}.
            </span>
          </label>
        ))}
      </div>

      <Dialog open={abierto !== null} onOpenChange={(v) => !v && setAbierto(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{abierto ? NOMBRE_DOCUMENTO[abierto] : ''}</DialogTitle>
            <DialogDescription>
              {alumnos.length > 1 ? `De ${alumno.nombre.trim() || 'este alumno'}` : 'Lleno con tus datos'}
            </DialogDescription>
          </DialogHeader>
          {abierto && doc && (
            <DocumentoVista
              tipo={abierto}
              titulo={doc.doc_titulo}
              contenido={doc.doc_contenido}
              datos={datos}
              onVerPolitica={() => setAbierto('politica')}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const PasoPago = ({
  cuentaBancaria,
  vista,
  preparando,
  onArchivo,
  alumnos,
  cobro,
  cargandoCobro,
}: {
  cuentaBancaria: string | null;
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
                    {c.disciplinas} disciplina{c.disciplinas === 1 ? '' : 's'} × {dinero(c.precio_disciplina)}
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
          <dl className="space-y-1 border-t p-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{dinero(cobro.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">IVA {cobro.alumnos[0] ? `${cobro.alumnos[0].iva_pct} %` : ''}</dt>
              <dd>{dinero(cobro.iva)}</dd>
            </div>
          </dl>
          <div className="flex items-center justify-between border-t bg-muted/40 p-3">
            <span className="font-semibold">Pago Inscripción</span>
            <span className="text-lg font-bold">{dinero(cobro.total)}</span>
          </div>
        </>
      ) : (
        <p className="p-3 text-sm text-muted-foreground">
          {cargandoCobro ? 'Calculando el total…' : 'No se pudo calcular el total. Vuelve a los pasos anteriores.'}
        </p>
      )}
    </div>

    {cuentaBancaria && (
      <div className="rounded-md border bg-muted/40 p-3">
        <p className="mb-1 text-sm font-semibold">Transfiere a esta cuenta</p>
        <p className="whitespace-pre-line break-words text-sm">{cuentaBancaria}</p>
      </div>
    )}

    <p className="text-sm">
      Sube el comprobante de la transferencia del pago, por favor
      {alumnos.length > 1 ? ` (uno solo por los ${alumnos.length} alumnos)` : ''}.
    </p>
    <label
      htmlFor="comprobante"
      className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 text-center hover:bg-muted/40"
    >
      {vista ? (
        <img src={vista} alt="Comprobante elegido" className="max-h-72 rounded object-contain" />
      ) : (
        <>
          <ImageUp className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">{preparando ? 'Preparando la imagen…' : 'Toca para elegir la imagen'}</span>
        </>
      )}
      {vista && (
        <span className="text-sm text-muted-foreground">{preparando ? 'Preparando la imagen…' : 'Toca para cambiarla'}</span>
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
      <p className="mt-1 text-sm text-muted-foreground">Total mensual: {dinero(resultado.total)} con IVA</p>
    </div>
    <div className="space-y-2 text-sm">
      <p>
        Vamos a revisar tus datos y el comprobante. Cuando la aprobemos te llegará un correo a{' '}
        <strong className="break-all">{correo}</strong> con tu acceso a la plataforma y los documentos aprobados.
      </p>
      <p>
        Tu contraseña será tu <strong>número de cédula o pasaporte</strong>, tal como lo escribiste.
      </p>
    </div>
    {resultado.paquetes.some((c) => c.url) && (
      <div className="space-y-2">
        <p className="text-sm font-medium">Descarga ahora tu copia de los documentos:</p>
        {resultado.paquetes.map(
          (c) =>
            c.url && (
              <Button key={c.alumno} variant="outline" className="h-11 w-full" asChild>
                <a href={c.url} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-4 w-4" /> Documentos de {c.alumno}
                </a>
              </Button>
            ),
        )}
        <p className="text-xs text-muted-foreground">Los enlaces caducan en unos minutos. Si pierdes tu copia, pídenosla.</p>
      </div>
    )}
  </div>
);

export default Inscripcion;
