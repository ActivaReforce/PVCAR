import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Receipt, X } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import { usePrecios } from '@/hooks/useInscripciones';
import {
  useAprobarPago,
  useEstadoDelMes,
  usePagoMensualidad,
  usePagosMensualidad,
  useRechazarPago,
} from '@/hooks/useMensualidades';
import { dinero } from '@/api/inscripciones';
import { diaLegible, mesesCortos, nombreDeMes, type AlumnoDelMes, type EstadoMes, type PagoListado } from '@/api/mensualidades';
import { cn } from '@/lib/utils';
import { fechaHora } from '@/components/inscripciones/formato';
import { useAuth } from '@/contexts/AuthContext';
import { ROL } from '@/hooks/useUserForm';
import AnularPagoDialog from './AnularPagoDialog';
import ContactoPago from './ContactoPago';
import { EstadoMesBadge } from './PagarMensualidad';

const TODOS = 'todos';
const VERDE =
  'border-transparent bg-emerald-700 text-white hover:bg-emerald-700 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-400';

/**
 * Mensualidades, lado del personal (cliente, 2026-10-30): los pagos que
 * llegan (revisar el comprobante, aprobar o rechazar con motivo) y el estado
 * de cada mes por colegio, en dos pestañas (2026-11-16). Un rechazado desaparece de aquí, como las
 * inscripciones; el representante ve el motivo hasta que vuelve a intentar.
 */
const MensualidadesPersonal = () => (
  <Tabs defaultValue="por-revisar">
    <TabsList>
      <TabsTrigger value="por-revisar">Por revisar</TabsTrigger>
      <TabsTrigger value="estado">Estado del mes</TabsTrigger>
    </TabsList>
    <TabsContent value="por-revisar" className="pt-2">
      <Pagos />
    </TabsContent>
    <TabsContent value="estado" className="pt-2">
      <EstadoDelMes />
    </TabsContent>
  </Tabs>
);

const Pagos = () => {
  const colegios = usePrecios();
  const [estado, setEstado] = useState<'pendiente' | 'aprobado'>('pendiente');
  const [colegio, setColegio] = useState(TODOS);
  const [buscar, setBuscar] = useState('');
  const [pagina, setPagina] = useState(1);
  const [abierto, setAbierto] = useState<number | null>(null);

  const lista = usePagosMensualidad({
    estado,
    colegio: colegio === TODOS ? undefined : Number(colegio),
    buscar: buscar || undefined,
    page: pagina,
  });
  const datos = lista.data;
  const items = datos?.items ?? [];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DebouncedSearchInput
          placeholder="Buscar por representante, correo o alumno..."
          value={buscar}
          onChange={(v) => {
            setBuscar(v);
            setPagina(1);
          }}
          className="w-full sm:col-span-2"
        />
        <Select
          value={colegio}
          onValueChange={(v) => {
            setColegio(v);
            setPagina(1);
          }}
        >
          <SelectTrigger className="h-11 sm:h-10" aria-label="Colegio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los colegios</SelectItem>
            {(colegios.data ?? []).map((c) => (
              <SelectItem key={c.col_id} value={String(c.col_id)}>
                {c.col_nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={estado}
          onValueChange={(v) => {
            setEstado(v as 'pendiente' | 'aprobado');
            setPagina(1);
          }}
        >
          <SelectTrigger className="h-11 sm:h-10" aria-label="Estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendiente">Por revisar</SelectItem>
            <SelectItem value="aprobado">Aprobados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {lista.isLoading && !datos && <p className="py-8 text-center text-muted-foreground">Cargando pagos…</p>}
      {lista.isError && <p className="text-destructive">No se pudieron cargar: {(lista.error as Error).message}</p>}

      {datos && items.length === 0 && (
        <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          <Receipt className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p>{estado === 'pendiente' ? 'No hay pagos por revisar' : 'No hay pagos con ese filtro'}</p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-lg border">
          {items.map((p) => (
            <li key={p.menpag_id}>
              <button
                type="button"
                onClick={() => setAbierto(p.menpag_id)}
                className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.representante_nombre ?? 'Cuenta borrada'}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {p.alumnos.join(', ')} · {p.meses.join(', ')}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:justify-end">
                  <span className="text-sm font-medium">{dinero(p.total)}</span>
                  <Badge variant="secondary" className={p.estado === 'aprobado' ? VERDE : undefined}>
                    {p.estado === 'aprobado' ? 'Aprobado' : 'Por revisar'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{fechaHora(p.fecha)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {datos && datos.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Página {datos.page} de {datos.totalPages} · {datos.total} en total
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" aria-label="Página anterior" disabled={datos.page <= 1} onClick={() => setPagina((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Página siguiente"
              disabled={datos.page >= datos.totalPages}
              onClick={() => setPagina((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <FichaPago id={abierto} onClose={() => setAbierto(null)} />
    </section>
  );
};

/**
 * Rechazar (cliente, 2026-11-16): no se escribe motivo ni queda registro. Se
 * enseña con quién hablar —representante, sus hijos y lo que pagaba, teléfono,
 * correo y WhatsApp— y, al confirmar, el pago se borra como si nunca se
 * hubiera subido: el representante vuelve a pagar esos meses.
 */
const ConfirmarRechazo = ({ pago }: { pago: PagoListado }) => (
  <div className="space-y-4">
    <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
      Al confirmar, este pago y su comprobante se borran, como si nunca se hubiera subido. El representante podrá
      volver a pagar esos meses. Avísale para que lo haga de nuevo.
    </div>
    <ContactoPago pago={pago} />
  </div>
);

const FichaPago = ({ id, onClose }: { id: number | null; onClose: () => void }) => {
  const pago = usePagoMensualidad(id);
  const aprobar = useAprobarPago();
  const rechazar = useRechazarPago();
  const [rechazando, setRechazando] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const { user } = useAuth();
  // Anular un aprobado es solo del Propietario (el backend lo exige igual).
  const esPropietario = user?.roles.some((r) => r.rol_id === ROL.PROPIETARIO) ?? false;
  const p = pago.data;

  const cerrar = () => {
    setRechazando(false);
    onClose();
  };

  return (
    <>
      <Dialog open={id !== null} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pago de mensualidad</DialogTitle>
          <DialogDescription>
            {p ? `${p.representante_nombre ?? 'Cuenta borrada'} · enviado el ${fechaHora(p.fecha)}` : 'Cargando…'}
          </DialogDescription>
        </DialogHeader>

        {pago.isError && <p className="text-destructive">No se pudo abrir: {(pago.error as Error).message}</p>}

        {p && rechazando && <ConfirmarRechazo pago={p} />}

        {p && !rechazando && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {[p.representante_correo, p.representante_telefono].filter(Boolean).join(' · ')}
            </p>
            <div className="overflow-hidden rounded-md border">
              <ul className="divide-y">
                {p.detalle.map((c) => (
                  <li key={`${c.nino_id}-${c.mes}`} className="flex items-start justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {c.nombre} · {nombreDeMes(c.mes)}
                      </p>
                      <p className="break-words text-muted-foreground">
                        {c.col_nombre} · {c.disciplinas.join(' · ')}
                        {c.descuento > 0 && ` · descuento ${dinero(c.descuento)}`}
                      </p>
                    </div>
                    <span className="whitespace-nowrap font-medium">{dinero(c.total)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t bg-muted/40 p-3">
                <span className="font-semibold">
                  Total <span className="text-xs font-normal text-muted-foreground">(IVA {dinero(p.iva)})</span>
                </span>
                <span className="text-lg font-bold">{dinero(p.total)}</span>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Comprobante</p>
              {p.comprobante_url ? (
                <a href={p.comprobante_url} target="_blank" rel="noreferrer">
                  <img src={p.comprobante_url} alt="Comprobante de pago" className="max-h-96 rounded border object-contain" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">No se pudo cargar la imagen.</p>
              )}
            </div>

            {p.estado === 'aprobado' && (
              <p className="text-sm text-muted-foreground">
                Aprobado{p.revisado_por ? ` por ${p.revisado_por}` : ''}
                {p.fecha_revision ? ` el ${fechaHora(p.fecha_revision)}` : ''}.
              </p>
            )}


          </div>
        )}

        {p?.estado === 'pendiente' && (
          <DialogFooter className="gap-2 sm:gap-0">
            {rechazando ? (
              <>
                <Button variant="outline" className="h-11 sm:h-10" onClick={() => setRechazando(false)}>
                  Volver
                </Button>
                <Button
                  variant="destructive"
                  className="h-11 sm:h-10"
                  disabled={rechazar.isPending}
                  onClick={async () => {
                    try {
                      await rechazar.mutateAsync(p.menpag_id);
                      cerrar();
                    } catch {
                      // El hook ya muestra el motivo.
                    }
                  }}
                >
                  {rechazar.isPending ? 'Rechazando…' : 'Confirmar rechazo'}
                </Button>
              </>
            ) : (
              <>
                <ConditionalAction module="inscripciones" action="eliminar">
                  <Button variant="outline" className="h-11 text-destructive sm:h-10" onClick={() => setRechazando(true)}>
                    <X className="mr-2 h-4 w-4" /> Rechazar
                  </Button>
                </ConditionalAction>
                <ConditionalAction module="inscripciones" action="editar">
                  <Button
                    className="h-11 sm:h-10"
                    disabled={aprobar.isPending}
                    onClick={async () => {
                      try {
                        await aprobar.mutateAsync(p.menpag_id);
                        cerrar();
                      } catch {
                        // El hook ya muestra el motivo.
                      }
                    }}
                  >
                    <Check className="mr-2 h-4 w-4" /> {aprobar.isPending ? 'Aprobando…' : 'Aprobar'}
                  </Button>
                </ConditionalAction>
              </>
            )}
          </DialogFooter>
        )}

        {p?.estado === 'aprobado' && esPropietario && (
          <DialogFooter>
            <ConditionalAction module="inscripciones" action="eliminar">
              <Button
                variant="outline"
                className="h-11 border-destructive/50 text-destructive hover:bg-destructive/10 sm:h-10"
                onClick={() => setAnulando(true)}
              >
                Anular pago
              </Button>
            </ConditionalAction>
          </DialogFooter>
        )}
      </DialogContent>
      </Dialog>

      <AnularPagoDialog
        pago={anulando ? (p ?? null) : null}
        onClose={() => setAnulando(false)}
        onAnulado={() => {
          setAnulando(false);
          cerrar();
        }}
      />
    </>
  );
};

const ORDEN: Array<EstadoMes | null> = ['atrasado', 'pendiente', 'revision', 'pagado', 'inscripcion', null];

/** Una cifra de la cabecera de cada colegio: etiqueta arriba, número grande debajo. */
const Cifra = ({ etiqueta, valor, nota }: { etiqueta: string; valor: string | number; nota?: string }) => (
  <div className="min-w-0">
    <dt className="truncate text-xs text-muted-foreground sm:text-sm" title={etiqueta}>
      {etiqueta}
    </dt>
    <dd className="text-base font-semibold tabular-nums sm:text-lg">{valor}</dd>
    {nota && <dd className="text-xs text-destructive">{nota}</dd>}
  </div>
);

/** El dinero de una fila: lo que entró este mes, o lo que vale/debe el mes. */
const DineroDeFila = ({ a, mes }: { a: AlumnoDelMes; mes: string }) => {
  const debe = a.estado === 'pendiente' || a.estado === 'atrasado';
  let nota: string | null = null;
  if (a.recibido > 0 && a.cubre.length > 0) nota = `incluye ${mesesCortos(a.cubre)}`;
  else if (a.pagado_el && !a.pagado_el.startsWith(mes.slice(0, 7))) nota = `pagado el ${diaLegible(a.pagado_el)}`;
  return (
    <div className="text-right">
      <p className={cn('w-24 font-medium', debe && 'text-muted-foreground')}>
        {a.estado === 'inscripcion' && a.recibido === 0 ? '—' : debe && a.recibido === 0 ? dinero(a.valor) : dinero(a.recibido)}
      </p>
      {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
};

/**
 * El estado de un mes por colegio: quién pagó, quién está en revisión y quién
 * debe. Solo lectura. El dinero va por fecha de pago (cliente, 2026-11-16):
 * lo pagado por adelantado suma en el mes en que se pagó, y en los meses que
 * cubre sale pagado con $0 y la fecha del pago.
 */
const EstadoDelMes = () => {
  const [abierto, setAbierto] = useState<number | null>(null);
  const [mes, setMes] = useState<string | undefined>(undefined);
  const [colegio, setColegio] = useState(TODOS);
  const consulta = useEstadoDelMes(mes, colegio === TODOS ? undefined : Number(colegio));
  const datos = consulta.data;

  // Tres años enteros: el pasado, el actual y el siguiente (cliente, 2026-11-16).
  // Cambia solo con el año: en enero de 2027 sale de 2026 a 2028. Por defecto, el mes actual.
  const meses = useMemo(() => {
    if (!datos) return [];
    const ano = Number(datos.actual.slice(0, 4));
    return [ano + 1, ano, ano - 1].flatMap((a) =>
      Array.from({ length: 12 }, (_, i) => `${a}-${String(12 - i).padStart(2, '0')}`),
    );
  }, [datos]);

  const visibles = (datos?.colegios ?? []).filter((c) => c.cobra || c.alumnos.length > 0);
  const elegido = mes ?? datos?.actual.slice(0, 7) ?? '';
  const nombreElegido = elegido ? nombreDeMes(`${elegido}-01`).split(' ')[0]!.toLowerCase() : '';

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cada alumno del mes elegido: pagado, en revisión o por pagar. El dinero cuenta en el mes en que se pagó.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={elegido} onValueChange={setMes}>
          <SelectTrigger className="h-11 sm:h-10" aria-label="Mes">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            {meses.map((m) => (
              <SelectItem key={m} value={m}>
                {nombreDeMes(`${m}-01`)}
                {datos && m === datos.actual.slice(0, 7) ? ' · este mes' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={colegio} onValueChange={setColegio}>
          <SelectTrigger className="h-11 sm:h-10" aria-label="Colegio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los colegios</SelectItem>
            {(datos?.colegios ?? []).map((c) => (
              <SelectItem key={c.col_id} value={String(c.col_id)}>
                {c.col_nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {consulta.isLoading && !datos && <p className="py-8 text-center text-muted-foreground">Cargando…</p>}
      {consulta.isError && <p className="text-destructive">No se pudo cargar: {(consulta.error as Error).message}</p>}

      {datos && visibles.length === 0 && (
        <p className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          Ningún colegio cobra este mes. Los meses de cobro se eligen en Configuración → Mensualidades.
        </p>
      )}

      {visibles.map((c) => {
        const t = c.totales;
        const alumnos = [...c.alumnos].sort(
          (x, y) => ORDEN.indexOf(x.estado) - ORDEN.indexOf(y.estado) || x.nombre.localeCompare(y.nombre),
        );
        return (
          <div key={c.col_id} className="overflow-hidden rounded-lg border">
            <div className="space-y-2 border-b bg-muted/40 px-4 py-3">
              <p className="font-semibold">{c.col_nombre}</p>
              {!c.cobra && <p className="text-sm text-muted-foreground">Este mes está en pausa para este colegio.</p>}
              <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
                <Cifra etiqueta={`Recaudado en ${nombreElegido}`} valor={dinero(t.recaudado)} />
                <Cifra etiqueta="En revisión" valor={dinero(t.en_revision)} />
                <Cifra etiqueta={`Por cobrar de ${nombreElegido}`} valor={dinero(t.por_cobrar)} />
              </dl>
              <dl className="grid grid-cols-3 gap-x-4 gap-y-1 border-t pt-2 text-sm">
                <Cifra etiqueta="Alumnos al día" valor={t.pagados + t.inscripcion} />
                <Cifra etiqueta="Alumnos en revisión" valor={t.revision} />
                <Cifra
                  etiqueta="Alumnos por pagar"
                  valor={t.pendientes + t.atrasados}
                  nota={t.atrasados > 0 ? `${t.atrasados} atrasado${t.atrasados === 1 ? '' : 's'}` : undefined}
                />
              </dl>
            </div>
            {alumnos.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Ningún alumno con cobro este mes.</p>
            ) : (
              <ul className="divide-y">
                {alumnos.map((a) => (
                  <li key={a.nino_id ?? `n-${a.nombre}`}>
                    <FilaAlumno pago={a.menpag_id ?? null} onAbrir={setAbierto}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.baja
                          ? 'Dado de baja'
                          : a.representantes.join(', ') || (a.inscripcion_en_revision ? 'Aún no aprobado' : 'Sin representante')}
                        {a.inscripcion.length > 0 && a.estado !== 'inscripcion' && ` · inscripción: ${a.inscripcion.join(', ')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.estado ? (
                        <EstadoMesBadge estado={a.estado} />
                      ) : a.inscripcion_en_revision ? (
                        <Badge variant="secondary">Inscripción en revisión</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Pagó otros meses
                        </Badge>
                      )}
                      <DineroDeFila a={a} mes={`${elegido}-01`} />
                    </div>
                    </FilaAlumno>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <FichaPago id={abierto} onClose={() => setAbierto(null)} />
    </section>
  );
};

/** Una fila del estado del mes: si tiene pago, se pulsa y abre su detalle, como en Por revisar. */
const FilaAlumno = ({
  pago,
  onAbrir,
  children,
}: {
  pago: number | null;
  onAbrir: (id: number) => void;
  children: React.ReactNode;
}) => {
  const clase = 'flex w-full flex-col gap-1 px-4 py-2 text-left text-sm sm:flex-row sm:items-center sm:gap-3';
  if (pago === null) return <div className={clase}>{children}</div>;
  return (
    <button
      type="button"
      onClick={() => onAbrir(pago)}
      className={cn(clase, 'transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none')}
    >
      {children}
    </button>
  );
};

export default MensualidadesPersonal;
