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
  mensualidadesApi,
  nombreDeMes,
  type EstadoMes,
  type MisMensualidades,
} from '@/api/mensualidades';
import { fechaCorta } from '@/components/inscripciones/formato';

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
const clave = (ninoId: number, mes: string) => `${ninoId}|${mes}`;

/**
 * Pagar la mensualidad (cliente, 2026-10-30): los hijos por colegio, cada
 * mes que se debe con su casilla y su valor, el total al momento, la cuenta
 * y el comprobante. Debajo, el historial de cada hijo. Es la misma pantalla
 * en el módulo Inscripciones y en /inscripcion → "Pagar mensualidad".
 *
 * El valor de cada mes lo da el servidor con toda la familia (descuento de
 * hermano incluido), así que el total es la suma de lo marcado: no hace falta
 * volver a preguntar al marcar o desmarcar.
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
  const porPagar = useMemo(
    () =>
      datos.colegios.flatMap((c) =>
        c.hijos.flatMap((h) => h.meses.filter((m) => debe(m.estado)).map((m) => ({ ...m, nino_id: h.nino_id }))),
      ),
    [datos],
  );
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  // Al cargar (o recargar) se marca todo lo que se debe.
  useEffect(() => {
    setMarcados(new Set(porPagar.map((m) => clave(m.nino_id, m.mes))));
  }, [porPagar]);

  const [comprobante, setComprobante] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<number | null>(null);
  const [claveEnvio, setClaveEnvio] = useState(nuevaClave);

  const elegidos = porPagar.filter((m) => marcados.has(clave(m.nino_id, m.mes)));
  const total = elegidos.reduce((s, m) => s + Math.round(m.total * 100), 0) / 100;
  const rechazados = datos.pagos.filter((p) => p.estado === 'rechazado');

  const alternar = (k: string, si: boolean) =>
    setMarcados((antes) => {
      const nuevo = new Set(antes);
      if (si) nuevo.add(k);
      else nuevo.delete(k);
      return nuevo;
    });

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
          { cuotas: elegidos.map((m) => ({ nino_id: m.nino_id, mes: m.mes })), total, comprobante: { mime, base64 } },
          claveEnvio,
        ),
      );
      setEnviado(elegidos.length);
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

  const sinHijos = datos.colegios.length === 0;

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
            aprobemos lo verás como pagado en el historial.
          </p>
        </div>
      )}

      {sinHijos && (
        <p className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          No tienes mensualidades: tus hijos aún no tienen meses de cobro.
        </p>
      )}

      {!sinHijos && porPagar.length === 0 && (
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          <p className="font-medium">Estás al día. No tienes mensualidades por pagar.</p>
        </div>
      )}

      {porPagar.length > 0 && (
        <section className="space-y-4 rounded-lg border bg-background p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Pagar mensualidad</h2>
            <p className="text-sm text-muted-foreground">
              Marca lo que vas a pagar. Se paga hasta el día {datos.dia_limite} de cada mes.
            </p>
          </div>

          {datos.colegios.map((c) => {
            const hijos = c.hijos.filter((h) => h.meses.some((m) => debe(m.estado)));
            if (hijos.length === 0) return null;
            return (
              <div key={c.col_id} className="space-y-3">
                {datos.colegios.length > 1 && <p className="text-sm font-semibold text-muted-foreground">{c.col_nombre}</p>}
                {hijos.map((h) => (
                  <div key={h.nino_id} className="rounded-md bg-muted/40 p-3">
                    <p className="mb-2 font-medium">{h.nombre}</p>
                    <div className="space-y-1">
                      {h.meses
                        .filter((m) => debe(m.estado))
                        .map((m) => {
                          const k = clave(h.nino_id, m.mes);
                          const id = `pagar-${k}`;
                          return (
                            <label key={k} htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-1">
                              <Checkbox id={id} checked={marcados.has(k)} onCheckedChange={(v) => alternar(k, v === true)} />
                              <span className="min-w-0 flex-1 text-sm">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{nombreDeMes(m.mes)}</span>
                                  <EstadoMesBadge estado={m.estado} />
                                </span>
                                <span className="block break-words text-xs text-muted-foreground">
                                  {m.disciplinas.join(' · ')}
                                  {m.descuento > 0 && ` · descuento de hermano ${dinero(m.descuento)}`}
                                  {m.inscripcion.length > 0 && ` · ya pagado en la inscripción: ${m.inscripcion.join(', ')}`}
                                </span>
                              </span>
                              <span className="whitespace-nowrap text-sm font-medium">{dinero(m.total)}</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
            <span className="font-semibold">Total a pagar <span className="text-xs font-normal text-muted-foreground">(IVA incluido)</span></span>
            <span className="text-lg font-bold">{dinero(total)}</span>
          </div>

          {datos.cuenta_bancaria && (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="mb-1 text-sm font-semibold">Transfiere a esta cuenta</p>
              <p className="whitespace-pre-line break-words text-sm">{datos.cuenta_bancaria}</p>
            </div>
          )}

          <p className="text-sm">Sube el comprobante de la transferencia (uno solo por todo lo marcado).</p>
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
            disabled={elegidos.length === 0 || !comprobante || enviando || preparando}
            onClick={() => void enviar()}
          >
            {enviando ? 'Enviando…' : `Enviar pago de ${dinero(total)}`}
          </Button>
        </section>
      )}

      {!sinHijos && <Historial datos={datos} />}
    </div>
  );
};

/** Cada hijo con todos sus meses, del más nuevo al más antiguo, agrupados por colegio. */
const Historial = ({ datos }: { datos: MisMensualidades }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold">Historial de pagos</h2>
    {datos.colegios.map((c) => (
      <div key={c.col_id} className="space-y-3">
        {datos.colegios.length > 1 && <p className="text-sm font-semibold text-muted-foreground">{c.col_nombre}</p>}
        {c.hijos.map((h) => (
          <div key={h.nino_id} className="overflow-hidden rounded-lg border">
            <p className="border-b bg-muted/40 px-4 py-2 font-medium">{h.nombre}</p>
            <ul className="divide-y">
              {[...h.meses].reverse().map((m) => (
                <li key={m.mes} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                  <span className="min-w-[8.5rem] font-medium">{nombreDeMes(m.mes)}</span>
                  <EstadoMesBadge estado={m.estado} />
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
