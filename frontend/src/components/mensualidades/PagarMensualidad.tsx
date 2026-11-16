import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ImageUp, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useDescartarPago, useMisMensualidades } from '@/hooks/useMensualidades';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import { aBase64, conReintentos, nuevaClave, prepararComprobante } from '@/lib/comprobante';
import { dinero } from '@/api/inscripciones';
import {
  ETIQUETA_ESTADO,
  diaLegible,
  mensualidadesApi,
  nombreDeMes,
  type EstadoMes,
  type MesDelHijo,
  type MisMensualidades,
} from '@/api/mensualidades';
import { fechaCorta } from '@/components/inscripciones/formato';
import { hoyEc } from '@/lib/fecha';
import { cn } from '@/lib/utils';

const VERDE =
  'border-transparent bg-emerald-700 text-white hover:bg-emerald-700 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-400';

export const EstadoMesBadge = ({ estado }: { estado: EstadoMes }) => {
  const clase: Record<EstadoMes, string | undefined> = {
    pagado: VERDE,
    inscripcion: VERDE,
    revision: undefined,
    pendiente: 'border-amber-500 text-amber-700 dark:border-amber-400 dark:text-amber-400',
    atrasado: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive',
  };
  return (
    <Badge variant={estado === 'revision' ? 'secondary' : 'outline'} className={clase[estado]}>
      {ETIQUETA_ESTADO[estado]}
    </Badge>
  );
};

const debe = (e: EstadoMes) => e === 'pendiente' || e === 'atrasado';
const centavos = (d: number) => Math.round(d * 100);

interface Hijo {
  nino_id: number;
  nombre: string;
  col_nombre: string;
  meses: MesDelHijo[];
}

/** El estado de un mes para la familia: el peor de sus hijos. */
function estadoDeFamilia(estados: EstadoMes[]): EstadoMes {
  for (const e of ['atrasado', 'pendiente', 'revision', 'pagado'] as EstadoMes[]) if (estados.includes(e)) return e;
  return 'pagado';
}

/**
 * Pagar la mensualidad (cliente, 2026-11-16), en tres pasos:
 *
 *   1. Los meses: todos los que hay por pagar —también los futuros que el
 *      colegio tiene abiertos— y los de este mes en adelante ya pagados o en
 *      revisión, con su etiqueta. Se eligen en orden: no se elige enero si
 *      diciembre sigue pendiente (sale un aviso); quitar uno quita los
 *      siguientes.
 *   2. Los hijos: una tarjeta por hijo con los meses elegidos, su estado y
 *      su precio. Todos marcados al empezar; se puede quitar a uno.
 *   3. Total a pagar con el desglose por mes, la cuenta y un solo
 *      comprobante.
 *
 * Debajo, el historial. Es la misma pantalla en el módulo Inscripciones y en
 * /inscripcion → "Pagar mensualidad". El valor de cada mes lo da el servidor
 * con toda la familia (descuento de hermano incluido): el total es la suma.
 */
const PagarMensualidad = () => {
  const { user } = useAuth();
  const datos = useMisMensualidades(user?.usu_id);
  const d = datos.data;

  if (datos.isLoading) return <p className="py-8 text-center text-muted-foreground">Cargando…</p>;
  if (datos.isError) {
    return <p className="text-destructive">No se pudieron cargar: {(datos.error as Error).message}</p>;
  }
  if (!d) return null;
  return <Contenido datos={d} />;
};

const Contenido = ({ datos }: { datos: MisMensualidades }) => {
  const queryClient = useQueryClient();
  const descartar = useDescartarPago();
  const actual = `${hoyEc().slice(0, 7)}-01`;

  const hijos: Hijo[] = useMemo(
    () =>
      datos.colegios.flatMap((c) =>
        c.hijos.map((h) => ({ nino_id: h.nino_id, nombre: h.nombre, col_nombre: c.col_nombre, meses: h.meses })),
      ),
    [datos],
  );

  /** Los meses que se enseñan: lo que se debe y, de este mes en adelante, también lo pagado. */
  const meses = useMemo(() => {
    const porMes = new Map<string, EstadoMes[]>();
    for (const h of hijos) {
      for (const m of h.meses) {
        if (m.mes < actual && !debe(m.estado)) continue;
        porMes.set(m.mes, [...(porMes.get(m.mes) ?? []), m.estado === 'inscripcion' ? 'pagado' : m.estado]);
      }
    }
    return [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, estados]) => ({ mes, estado: estadoDeFamilia(estados) }));
  }, [hijos, actual]);

  const [elegidos, setElegidos] = useState<string[]>([]);
  const [sinHijos, setSinHijos] = useState<Set<number>>(new Set());
  const [avisoOrden, setAvisoOrden] = useState<string | null>(null);
  // Al cargar (o recargar) no se elige nada: el representante decide qué meses paga.
  useEffect(() => {
    setElegidos([]);
    setSinHijos(new Set());
    setAvisoOrden(null);
  }, [datos]);

  const alternarMes = (mes: string) => {
    if (elegidos.includes(mes)) {
      // Quitar uno quita los siguientes: no puede quedar un hueco.
      setElegidos(elegidos.filter((m) => m < mes));
      setAvisoOrden(null);
      return;
    }
    const falta = meses.find((m) => m.mes < mes && debe(m.estado) && !elegidos.includes(m.mes));
    if (falta) {
      setAvisoOrden(`Primero selecciona ${nombreDeMes(falta.mes)}, que está pendiente.`);
      return;
    }
    setAvisoOrden(null);
    setElegidos([...elegidos, mes].sort());
  };

  const alternarHijo = (id: number, si: boolean) =>
    setSinHijos((antes) => {
      const nuevo = new Set(antes);
      if (si) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });

  /** Lo que se paga: los meses elegidos de los hijos marcados que se deben. */
  const cuotas = hijos
    .filter((h) => !sinHijos.has(h.nino_id))
    .flatMap((h) =>
      h.meses.filter((m) => elegidos.includes(m.mes) && debe(m.estado)).map((m) => ({ ...m, nino_id: h.nino_id })),
    );
  const total = cuotas.reduce((s, m) => s + centavos(m.total), 0) / 100;
  const desglose = elegidos
    .map((mes) => {
      const delMes = cuotas.filter((c) => c.mes === mes);
      return { mes, hijos: delMes.length, total: delMes.reduce((s, c) => s + centavos(c.total), 0) / 100 };
    })
    .filter((x) => x.hijos > 0);
  const rechazados = datos.pagos.filter((p) => p.estado === 'rechazado');

  const [comprobante, setComprobante] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<number | null>(null);
  const [claveEnvio, setClaveEnvio] = useState(nuevaClave);

  const elegirArchivo = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    setPreparando(true);
    try {
      const listo = await prepararComprobante(archivo);
      if (vista) URL.revokeObjectURL(vista);
      setComprobante(listo);
      setVista(URL.createObjectURL(listo));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer la imagen.');
    } finally {
      setPreparando(false);
    }
  };

  const enviar = async () => {
    if (!comprobante) {
      setError('Sube la foto o captura del comprobante de pago.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const mime = ['image/jpeg', 'image/png', 'image/webp'].includes(comprobante.type) ? comprobante.type : 'image/jpeg';
      const base64 = await aBase64(comprobante);
      await conReintentos(() =>
        mensualidadesApi.pagar(
          { cuotas: cuotas.map((m) => ({ nino_id: m.nino_id, mes: m.mes })), total, comprobante: { mime, base64 } },
          claveEnvio,
        ),
      );
      setEnviado(desglose.length);
      setClaveEnvio(nuevaClave());
      setComprobante(null);
      if (vista) URL.revokeObjectURL(vista);
      setVista(null);
      await queryClient.invalidateQueries({ queryKey: ['mensualidades'] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await queryClient.invalidateQueries({ queryKey: ['mensualidades'] });
      }
      setError(
        err instanceof ApiError
          ? err.message
          : 'No salió el pago: parece que se cortó la conexión. No recargues la página; revisa tu señal y vuelve a pulsar Enviar.',
      );
    } finally {
      setEnviando(false);
    }
  };

  const sinNinos = hijos.length === 0;
  const hayPorPagar = meses.some((m) => debe(m.estado));
  // Al día: nada por pagar hasta este mes (lo que queda es adelantable).
  const alDia = !meses.some((m) => m.mes <= actual && debe(m.estado));
  const limites = [...new Set(datos.colegios.map((c) => c.dia_limite))];
  const hijosDelPaso = hijos.filter((h) => h.meses.some((m) => elegidos.includes(m.mes)));

  return (
    <div className="space-y-6">
      {rechazados.map((p) => (
        <div key={p.menpag_id} role="alert" className="space-y-2 rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" /> Pago rechazado · {dinero(p.total)} · enviado el {fechaCorta(p.fecha)}
          </p>
          <p>{[...new Set(p.cuotas.map((c) => `${c.nombre}: ${nombreDeMes(c.mes)}`))].join(' · ')}</p>
          <p>
            <span className="font-medium">Motivo:</span> {p.motivo}
          </p>
          <Button
            variant="outline"
            className="h-11 sm:h-10"
            disabled={descartar.isPending}
            onClick={() => descartar.mutate(p.menpag_id)}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Volver a intentar
          </Button>
        </div>
      ))}

      {enviado !== null && (
        <div role="status" className="flex items-start gap-3 rounded-md border border-primary/40 bg-primary/5 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <p>
            Recibimos tu pago ({enviado} {enviado === 1 ? 'mes' : 'meses'}). Queda <strong>en revisión</strong>; cuando lo
            aprobemos lo verás como pagado.
          </p>
        </div>
      )}

      {sinNinos && (
        <p className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          No tienes mensualidades: tus hijos aún no tienen meses de cobro.
        </p>
      )}

      {!sinNinos && alDia && (
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          <p className="font-medium">
            Estás al día.{hayPorPagar ? ' Si quieres, puedes pagar meses por adelantado.' : ' No tienes mensualidades por pagar.'}
          </p>
        </div>
      )}

      {meses.length > 0 && (
        <section className="space-y-5 rounded-lg border bg-background p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Pagar mensualidad</h2>
            <p className="text-sm text-muted-foreground">
              {limites.length === 1 ? `Se paga hasta el día ${limites[0]} de cada mes. ` : ''}
              Puedes pagar varios meses con una sola transferencia.
            </p>
          </div>

          {/* 1. Los meses */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">1. Elige el mes o los meses que vas a pagar</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="group" aria-label="Meses">
              {meses.map((m) => {
                const elegido = elegidos.includes(m.mes);
                const pagable = debe(m.estado);
                return (
                  <button
                    key={m.mes}
                    type="button"
                    aria-pressed={elegido}
                    disabled={!pagable}
                    onClick={() => alternarMes(m.mes)}
                    className={cn(
                      'flex min-h-14 flex-col items-start justify-center gap-1 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default',
                      elegido ? 'border-primary bg-primary/10 ring-1 ring-primary' : pagable && 'hover:bg-muted',
                      !pagable && 'bg-muted/40',
                    )}
                  >
                    <span className="font-medium">{nombreDeMes(m.mes)}</span>
                    <EstadoMesBadge estado={m.estado} />
                  </button>
                );
              })}
            </div>
            {avisoOrden && (
              <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
                {avisoOrden}
              </p>
            )}
          </div>

          {/* 2. Los hijos */}
          {elegidos.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">2. {hijosDelPaso.length === 1 ? 'Tu hijo' : 'Elige a tus hijos'}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {hijosDelPaso.map((h) => {
                  const suyos = h.meses.filter((m) => elegidos.includes(m.mes));
                  const pagaAlgo = suyos.some((m) => debe(m.estado));
                  const marcado = pagaAlgo && !sinHijos.has(h.nino_id);
                  const id = `hijo-${h.nino_id}`;
                  return (
                    <div key={h.nino_id} className={cn('rounded-md border p-3', marcado && 'border-primary')}>
                      <label htmlFor={id} className="mb-2 flex min-h-11 cursor-pointer items-center gap-3">
                        <Checkbox
                          id={id}
                          checked={marcado}
                          disabled={!pagaAlgo}
                          onCheckedChange={(v) => alternarHijo(h.nino_id, v === true)}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium">{h.nombre}</span>
                          {datos.colegios.length > 1 && <span className="block text-xs text-muted-foreground">{h.col_nombre}</span>}
                        </span>
                      </label>
                      <ul className="space-y-1">
                        {suyos.map((m) => (
                          <li key={m.mes} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="min-w-[7.5rem]">{nombreDeMes(m.mes)}</span>
                            <EstadoMesBadge estado={m.estado} />
                            <span className={cn('ml-auto whitespace-nowrap font-medium', !marcado && 'text-muted-foreground')}>
                              {debe(m.estado) ? dinero(m.total) : '—'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Total y comprobante */}
          {cuotas.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold">3. Paga y sube el comprobante</p>
              <div className="overflow-hidden rounded-md border">
                <div className="flex items-center justify-between bg-muted/40 p-3">
                  <span className="font-semibold">
                    Total a pagar <span className="text-xs font-normal text-muted-foreground">(IVA incluido)</span>
                  </span>
                  <span className="text-lg font-bold">{dinero(total)}</span>
                </div>
                <ul className="divide-y border-t text-sm">
                  {desglose.map((x) => (
                    <li key={x.mes} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span>
                        Mensualidad {nombreDeMes(x.mes).toLowerCase()}
                        {x.hijos > 1 && <span className="text-muted-foreground"> · {x.hijos} hijos</span>}
                      </span>
                      <span className="whitespace-nowrap font-medium">{dinero(x.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {datos.cuenta_bancaria && (
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="mb-1 text-sm font-semibold">Transfiere a esta cuenta</p>
                  <p className="whitespace-pre-line break-words text-sm">{datos.cuenta_bancaria}</p>
                </div>
              )}

              <p className="text-sm">Sube el comprobante de la transferencia (uno solo por todo).</p>
              <label
                htmlFor="comprobante-mensualidad"
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
                {vista && <span className="text-sm text-muted-foreground">{preparando ? 'Preparando la imagen…' : 'Toca para cambiarla'}</span>}
              </label>
              <input
                id="comprobante-mensualidad"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  void elegirArchivo(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                className="h-12 w-full sm:h-10 sm:w-auto"
                disabled={!comprobante || enviando || preparando}
                onClick={() => void enviar()}
              >
                {enviando ? 'Enviando…' : `Enviar pago de ${dinero(total)}`}
              </Button>
            </div>
          )}
        </section>
      )}

      {!sinNinos && <Historial datos={datos} actual={actual} />}
    </div>
  );
};

/**
 * Cada hijo con sus meses hasta el actual y los ya pagados por adelantado,
 * del más nuevo al más antiguo, agrupados por colegio.
 */
const Historial = ({ datos, actual }: { datos: MisMensualidades; actual: string }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold">Historial de pagos</h2>
    {datos.colegios.map((c) => (
      <div key={c.col_id} className="space-y-3">
        {datos.colegios.length > 1 && <p className="text-sm font-semibold text-muted-foreground">{c.col_nombre}</p>}
        {c.hijos.map((h) => (
          <div key={h.nino_id} className="overflow-hidden rounded-lg border">
            <p className="border-b bg-muted/40 px-4 py-2 font-medium">{h.nombre}</p>
            <ul className="divide-y">
              {[...h.meses]
                .filter((m) => m.mes <= actual || !debe(m.estado))
                .reverse()
                .map((m) => (
                  <li key={m.mes} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                    <span className="min-w-[8.5rem] font-medium">{nombreDeMes(m.mes)}</span>
                    <EstadoMesBadge estado={m.estado} />
                    {m.pagado_el && <span className="text-xs text-muted-foreground">pagado el {diaLegible(m.pagado_el)}</span>}
                    <span className="ml-auto whitespace-nowrap">{m.estado === 'inscripcion' ? '—' : dinero(m.total)}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    ))}
  </section>
);

export default PagarMensualidad;
