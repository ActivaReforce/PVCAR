import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { METODO, type IntentoInput, type Parametro } from '@/api/evaluaciones';
import {
  useBorrarEvaluacionDeAlumno,
  useFichaDeAlumno,
  useGuardarIntentos,
} from '@/hooks/useEvaluaciones';
import { brutoMobak, enMinutos, esMobak, topeMobak } from './metodos';

interface Props {
  evaninopenId: number | null;
  onClose: () => void;
}

/** Lo registrado para un intento, antes de mandarlo. */
interface Registro {
  tiempo: string;
  logro: boolean | null;
  escala: number | null;
  mobak: number | null;
}

const vacio = (): Registro => ({ tiempo: '', logro: null, escala: null, mobak: null });

const clave = (evaparamId: number, intento: number) => `${evaparamId}:${intento}`;

/** "1:30" o "90" → 90 segundos. */
function aSegundos(texto: string): number | null {
  const limpio = texto.trim();
  if (!limpio) return null;
  if (limpio.includes(':')) {
    const [m, s] = limpio.split(':');
    const minutos = Number(m);
    const segundos = Number(s);
    if (Number.isNaN(minutos) || Number.isNaN(segundos)) return null;
    return minutos * 60 + segundos;
  }
  const n = Number(limpio);
  return Number.isNaN(n) ? null : n;
}

/**
 * Evaluar a un alumno.
 *
 * **Un parámetro por pantalla, con avance.** El modal viejo eran 1 132 líneas
 * que pintaban los 30 campos de golpe: con un parámetro de 12 intentos, en un
 * teléfono, había que hacer scroll a ciegas sin saber cuánto faltaba.
 *
 * **El puntaje no se calcula aquí.** Lo que se ve tras guardar es lo que
 * devolvió el servidor, no una segunda implementación del mismo cálculo — que
 * es exactamente lo que hacía el sistema viejo, con las tablas Mobak y la
 * interpolación de tiempo escritas en el navegador. Mientras se registra se ve
 * el valor tal cual; la nota aparece al guardar.
 */
const EvaluarAlumnoDialog = ({ evaninopenId, onClose }: Props) => {
  const ficha = useFichaDeAlumno(evaninopenId);
  const guardar = useGuardarIntentos();
  const borrar = useBorrarEvaluacionDeAlumno();

  const [paso, setPaso] = useState(0);
  const [registros, setRegistros] = useState<Record<string, Registro>>({});
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const parametros = useMemo(() => ficha.data?.parametros ?? [], [ficha.data]);

  /** Al abrir, el formulario parte de las notas que ya hubiera. */
  useEffect(() => {
    if (!ficha.data) return;

    const inicial: Record<string, Registro> = {};
    for (const p of ficha.data.parametros) {
      for (let n = 1; n <= p.evaparam_intentos; n += 1) {
        const guardado = ficha.data.intentos.find(
          (i) => i.evaparam_id === p.evaparam_id && i.evaint_intento === n,
        );
        inicial[clave(p.evaparam_id, n)] = guardado
          ? {
              tiempo: guardado.evaint_tiempo === null ? '' : enMinutos(guardado.evaint_tiempo),
              logro: guardado.evaint_logro,
              escala: guardado.evaint_num,
              mobak: guardado.evaint_mobak,
            }
          : vacio();
      }
    }
    setRegistros(inicial);
    setPaso(0);
  }, [ficha.data]);

  const parametro = parametros[paso];

  const registro = (evaparamId: number, intento: number): Registro =>
    registros[clave(evaparamId, intento)] ?? vacio();

  const cambiar = (evaparamId: number, intento: number, cambios: Partial<Registro>) => {
    setRegistros((previos) => ({
      ...previos,
      [clave(evaparamId, intento)]: { ...registro(evaparamId, intento), ...cambios },
    }));
  };

  /** Un intento cuenta como registrado si su método tiene valor. */
  const registrado = (p: Parametro, intento: number): boolean => {
    const r = registro(p.evaparam_id, intento);
    if (p.evatipometo_id === METODO.TIEMPO) return aSegundos(r.tiempo) !== null;
    if (p.evatipometo_id === METODO.LOGRO) return r.logro !== null;
    if (p.evatipometo_id === METODO.ESCALA) return r.escala !== null;
    return r.mobak !== null;
  };

  const totalIntentos = parametros.reduce((s, p) => s + p.evaparam_intentos, 0);
  const hechos = parametros.reduce(
    (s, p) =>
      s + Array.from({ length: p.evaparam_intentos }, (_, i) => i + 1).filter((n) => registrado(p, n)).length,
    0,
  );

  const aEnviar = (): IntentoInput[] => {
    const salida: IntentoInput[] = [];
    for (const p of parametros) {
      for (let n = 1; n <= p.evaparam_intentos; n += 1) {
        if (!registrado(p, n)) continue;
        const r = registro(p.evaparam_id, n);
        salida.push({
          evaparam_id: p.evaparam_id,
          evaint_intento: n,
          tiempo: p.evatipometo_id === METODO.TIEMPO ? aSegundos(r.tiempo) : null,
          logro: p.evatipometo_id === METODO.LOGRO ? r.logro : null,
          escala: p.evatipometo_id === METODO.ESCALA ? r.escala : null,
          mobak: esMobak(p.evatipometo_id) ? r.mobak : null,
        });
      }
    }
    return salida;
  };

  const enviar = async () => {
    if (evaninopenId === null) return;
    try {
      await guardar.mutateAsync({ evaninopenId, intentos: aEnviar() });
      onClose();
    } catch {
      // El hook ya enseña el motivo y el formulario conserva lo registrado.
    }
  };

  const confirmarBorrado = async () => {
    if (evaninopenId === null) return;
    setConfirmandoBorrado(false);
    try {
      await borrar.mutateAsync(evaninopenId);
      onClose();
    } catch {
      // El hook ya enseña el motivo.
    }
  };

  const yaEvaluado = ficha.data?.pendiente.est_id === 7;

  return (
    <>
      <Dialog open={evaninopenId !== null} onOpenChange={(abierto) => !abierto && onClose()}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="break-words text-lg sm:text-xl">
              {ficha.data?.pendiente.nino_nombre ?? 'Evaluar alumno'}
            </DialogTitle>
            <DialogDescription className="break-words">
              {ficha.data?.pendiente.eva_titulo} · {ficha.data?.pendiente.act_nombre}
              {yaEvaluado && ficha.data && (
                <>
                  {' '}
                  · ya evaluado con <strong>{ficha.data.puntaje}</strong> de{' '}
                  {ficha.data.pendiente.eva_puntaje_total} pts
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {ficha.isLoading && (
            <p className="py-8 text-center text-muted-foreground">Cargando la evaluación…</p>
          )}

          {ficha.isError && (
            <p className="py-8 text-center text-destructive">{(ficha.error as Error).message}</p>
          )}

          {parametro && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Parámetro {paso + 1} de {parametros.length}
                  </span>
                  <span>
                    {hechos} de {totalIntentos} intentos
                  </span>
                </div>
                <Progress value={(hechos / Math.max(1, totalIntentos)) * 100} />
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2">
                <div>
                  <h3 className="break-words font-medium">{parametro.evaparam_nombre}</h3>
                  <p className="text-sm text-muted-foreground">
                    {parametro.evatipometo_nombre} · {parametro.evaparam_puntaje} pts entre{' '}
                    {parametro.evaparam_intentos} intento
                    {parametro.evaparam_intentos === 1 ? '' : 's'}
                  </p>
                  {parametro.evaparam_nota && (
                    <p className="mt-1 break-words rounded-md bg-muted/50 p-2 text-sm">
                      {parametro.evaparam_nota}
                    </p>
                  )}
                </div>

                {Array.from({ length: parametro.evaparam_intentos }, (_, i) => i + 1).map((n) => {
                  const r = registro(parametro.evaparam_id, n);
                  const guardado = ficha.data?.intentos.find(
                    (i) => i.evaparam_id === parametro.evaparam_id && i.evaint_intento === n,
                  );

                  return (
                    <div key={n} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">
                          {parametro.evaparam_intentos > 1 ? `Intento ${n}` : 'Resultado'}
                        </Label>
                        {guardado && (
                          <span className="text-xs text-muted-foreground">
                            Guardado: {guardado.evaint_puntaje_obtenido} pts
                          </span>
                        )}
                      </div>

                      {parametro.evatipometo_id === METODO.TIEMPO && (
                        <div className="space-y-1">
                          <Input
                            value={r.tiempo}
                            onChange={(e) =>
                              cambiar(parametro.evaparam_id, n, { tiempo: e.target.value })
                            }
                            placeholder="1:30 o 90"
                            inputMode="numeric"
                            className="h-11 sm:h-10"
                            aria-label={`Tiempo del intento ${n}`}
                          />
                          <p className="text-xs text-muted-foreground">
                            Minutos:segundos, o segundos a secas.
                            {parametro.rango && (
                              <>
                                {' '}
                                0 puntos si {parametro.rango.evatieran_op_cero}{' '}
                                {parametro.rango.evatieran_tiempo_cero}s; completo si{' '}
                                {parametro.rango.evatieran_op_full}{' '}
                                {parametro.rango.evatieran_tiempo_full}s.
                              </>
                            )}
                          </p>
                        </div>
                      )}

                      {parametro.evatipometo_id === METODO.LOGRO && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={r.logro === true ? 'default' : 'outline'}
                            className="h-11 sm:h-10"
                            onClick={() => cambiar(parametro.evaparam_id, n, { logro: true })}
                          >
                            Lo consiguió
                          </Button>
                          <Button
                            type="button"
                            variant={r.logro === false ? 'default' : 'outline'}
                            className="h-11 sm:h-10"
                            onClick={() => cambiar(parametro.evaparam_id, n, { logro: false })}
                          >
                            No
                          </Button>
                        </div>
                      )}

                      {parametro.evatipometo_id === METODO.ESCALA && (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-2">
                            {Array.from(
                              {
                                length:
                                  (parametro.evaparam_escala_max ?? 5) -
                                  (parametro.evaparam_escala_min ?? 0) +
                                  1,
                              },
                              (_, i) => (parametro.evaparam_escala_min ?? 0) + i,
                            ).map((valor) => (
                              <Button
                                key={valor}
                                type="button"
                                variant={r.escala === valor ? 'default' : 'outline'}
                                className="h-11 w-11 p-0 sm:h-10 sm:w-10"
                                onClick={() => cambiar(parametro.evaparam_id, n, { escala: valor })}
                              >
                                {valor}
                              </Button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            De {parametro.evaparam_escala_min ?? 0} a{' '}
                            {parametro.evaparam_escala_max ?? 5}.
                          </p>
                        </div>
                      )}

                      {esMobak(parametro.evatipometo_id) && (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-2">
                            {Array.from(
                              { length: topeMobak(parametro.evatipometo_id) + 1 },
                              (_, valor) => valor,
                            ).map((valor) => (
                              <Button
                                key={valor}
                                type="button"
                                variant={r.mobak === valor ? 'default' : 'outline'}
                                className="h-11 w-11 p-0 sm:h-10 sm:w-10"
                                onClick={() => cambiar(parametro.evaparam_id, n, { mobak: valor })}
                              >
                                {valor}
                              </Button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {parametro.evatipometo_id === METODO.MOBAK_6
                              ? '0-2 → nada · 3-4 → la mitad · 5-6 → todo'
                              : '0 → nada · 1 → la mitad · 2 → todo'}
                            {r.mobak !== null && (
                              <>
                                {' '}
                                · has marcado {r.mobak} (
                                {brutoMobak(parametro.evatipometo_id, r.mobak)} de 2)
                              </>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1 sm:h-10 sm:flex-none"
                    onClick={() => setPaso((p) => Math.max(0, p - 1))}
                    disabled={paso === 0}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1 sm:h-10 sm:flex-none"
                    onClick={() => setPaso((p) => Math.min(parametros.length - 1, p + 1))}
                    disabled={paso >= parametros.length - 1}
                  >
                    Siguiente
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                <div className="flex gap-2">
                  {yaEvaluado && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 text-destructive hover:text-destructive sm:h-10"
                      onClick={() => setConfirmandoBorrado(true)}
                      disabled={borrar.isPending}
                      title="Borrar la evaluación y devolver al alumno a pendiente"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="brand"
                    className="h-11 flex-1 sm:h-10 sm:flex-none"
                    onClick={enviar}
                    disabled={hechos === 0 || guardar.isPending}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {guardar.isPending ? 'Guardando…' : 'Guardar'}
                  </Button>
                </div>
              </div>

              {hechos > 0 && hechos < totalIntentos && (
                <p className="text-xs text-muted-foreground">
                  Faltan {totalIntentos - hechos} intento(s): el alumno seguirá en pendientes hasta
                  que estén todos.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmandoBorrado} onOpenChange={setConfirmandoBorrado}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Borrar la evaluación de este alumno</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              Se borran sus <strong>{ficha.data?.intentos.length ?? 0}</strong> intento(s) y{' '}
              <strong>{ficha.data?.pendiente.nino_nombre}</strong> vuelve a la lista de por
              evaluar. La evaluación en sí no se toca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmarBorrado}
            >
              Borrar y devolver a pendiente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EvaluarAlumnoDialog;
