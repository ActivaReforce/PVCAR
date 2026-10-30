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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { nombreDeMes, type EstadoMes } from '@/api/mensualidades';
import { fechaHora } from '@/components/inscripciones/formato';
import { EstadoMesBadge } from './PagarMensualidad';

const TODOS = 'todos';
const VERDE =
  'border-transparent bg-emerald-700 text-white hover:bg-emerald-700 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-400';

/**
 * Mensualidades, lado del personal (cliente, 2026-10-30): los pagos que
 * llegan (revisar el comprobante, aprobar o rechazar con motivo) y el estado
 * de cada mes por colegio. Un rechazado desaparece de aquí, como las
 * inscripciones; el representante ve el motivo hasta que vuelve a intentar.
 */
const MensualidadesPersonal = () => (
  <div className="space-y-8">
    <Pagos />
    <EstadoDelMes />
  </div>
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
      <div>
        <h2 className="text-lg font-semibold">Pagos de mensualidades</h2>
        {datos && (
          <p className="text-sm text-muted-foreground">
            {datos.conteos.pendientes} por revisar
          </p>
        )}
      </div>

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

const FichaPago = ({ id, onClose }: { id: number | null; onClose: () => void }) => {
  const pago = usePagoMensualidad(id);
  const aprobar = useAprobarPago();
  const rechazar = useRechazarPago();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const p = pago.data;

  const cerrar = () => {
    setRechazando(false);
    setMotivo('');
    onClose();
  };

  return (
    <Dialog open={id !== null} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pago de mensualidad</DialogTitle>
          <DialogDescription>
            {p ? `${p.representante_nombre ?? 'Cuenta borrada'} · enviado el ${fechaHora(p.fecha)}` : 'Cargando…'}
          </DialogDescription>
        </DialogHeader>

        {pago.isError && <p className="text-destructive">No se pudo abrir: {(pago.error as Error).message}</p>}

        {p && (
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

            {p.estado === 'pendiente' && rechazando && (
              <div className="space-y-1.5">
                <Label htmlFor="motivo-rechazo">Motivo (lo verá el representante)</Label>
                <Textarea
                  id="motivo-rechazo"
                  value={motivo}
                  maxLength={500}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej.: el valor transferido no coincide con el total"
                />
              </div>
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
                  disabled={!motivo.trim() || rechazar.isPending}
                  onClick={async () => {
                    try {
                      await rechazar.mutateAsync({ id: p.menpag_id, motivo: motivo.trim() });
                      cerrar();
                    } catch {
                      // El hook ya muestra el motivo.
                    }
                  }}
                >
                  {rechazar.isPending ? 'Rechazando…' : 'Rechazar pago'}
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
      </DialogContent>
    </Dialog>
  );
};

const ORDEN: EstadoMes[] = ['atrasado', 'pendiente', 'revision', 'pagado', 'inscripcion'];

/** El estado de un mes por colegio: quién pagó, quién está en revisión y quién debe. */
const EstadoDelMes = () => {
  const [mes, setMes] = useState<string | undefined>(undefined);
  const [colegio, setColegio] = useState(TODOS);
  const consulta = useEstadoDelMes(mes, colegio === TODOS ? undefined : Number(colegio));
  const datos = consulta.data;

  // Del mes en curso hacia atrás, dos años.
  const meses = useMemo(() => {
    if (!datos) return [];
    const [a, m] = datos.actual.split('-').map(Number) as [number, number];
    return Array.from({ length: 24 }, (_, i) => {
      const total = a * 12 + (m - 1) - i;
      return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
    });
  }, [datos]);

  const visibles = (datos?.colegios ?? []).filter((c) => c.cobra || c.alumnos.length > 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Estado del mes</h2>
        <p className="text-sm text-muted-foreground">Cada alumno del mes elegido: pagado, en revisión o por pagar.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={mes ?? datos?.actual.slice(0, 7) ?? ''} onValueChange={setMes}>
          <SelectTrigger className="h-11 sm:h-10" aria-label="Mes">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            {meses.map((m) => (
              <SelectItem key={m} value={m}>
                {nombreDeMes(`${m}-01`)}
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
          Ningún colegio cobra este mes. Los meses de cobro se eligen en Configuración → Más → Mensualidades.
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
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Recaudado</dt>
                  <dd className="font-semibold">{dinero(t.recaudado)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">En revisión</dt>
                  <dd className="font-semibold">{dinero(t.en_revision)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Por cobrar</dt>
                  <dd className="font-semibold">{dinero(t.por_cobrar)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Alumnos</dt>
                  <dd className="font-semibold">
                    {t.pagados + t.inscripcion} al día · {t.revision} en revisión · {t.pendientes + t.atrasados} por pagar
                  </dd>
                </div>
              </dl>
            </div>
            {alumnos.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Ningún alumno con cobro este mes.</p>
            ) : (
              <ul className="divide-y">
                {alumnos.map((a) => (
                  <li key={a.nino_id} className="flex flex-col gap-1 px-4 py-2 text-sm sm:flex-row sm:items-center sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.representantes.join(', ') || 'Sin representante'}
                        {a.inscripcion.length > 0 && a.estado !== 'inscripcion' && ` · inscripción: ${a.inscripcion.join(', ')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <EstadoMesBadge estado={a.estado} />
                      <span className="w-20 text-right font-medium">{a.estado === 'inscripcion' ? '—' : dinero(a.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
};

export default MensualidadesPersonal;
