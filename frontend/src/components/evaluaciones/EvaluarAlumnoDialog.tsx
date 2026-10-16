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
import { usePermissions } from '@/hooks/usePermissions';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { type IntentoInput, type Parametro } from '@/api/evaluaciones';
import {
  useBorrarEvaluacionDeAlumno,
  useFichaDeAlumno,
  useGuardarIntentos,
} from '@/hooks/useEvaluaciones';
import {
  aIntentoVivo,
  enMinutos,
  estaRegistrado,
  puntajeDeParametro,
  vacio,
  type IntentoVivo,
  type Registro,
} from './metodos';
import CamposIntento from './CamposIntento';

interface Props {
  evaninopenId: number | null;
  onClose: () => void;
}

const clave = (evaparamId: number, intento: number) => `${evaparamId}:${intento}`;

/**
 * Evaluar a un alumno.
 *
 * **Un parámetro por pantalla, con avance.** El modal viejo eran 1 132 líneas
 * que pintaban los 30 campos de golpe: con un parámetro de 12 intentos, en un
 * teléfono, había que hacer scroll a ciegas sin saber cuánto faltaba.
 *
 * **Puntaje en vivo** con el cálculo de `metodos.ts`, copia del backend; al
 * guardar, el que vale es el del servidor. Los controles de cada intento
 * viven en `CamposIntento`, compartidos con la vista previa.
 */
const EvaluarAlumnoDialog = ({ evaninopenId, onClose }: Props) => {
  // Sin `calificaciones:editar` se ve lo registrado, pero no se guarda ni se borra.
  const puedeCalificar = usePermissions().hasPermission('calificaciones', 'editar');
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
  const registrado = (p: Parametro, intento: number): boolean =>
    estaRegistrado(p, registro(p.evaparam_id, intento));

  const totalIntentos = parametros.reduce((s, p) => s + p.evaparam_intentos, 0);
  const hechos = parametros.reduce(
    (s, p) =>
      s + Array.from({ length: p.evaparam_intentos }, (_, i) => i + 1).filter((n) => registrado(p, n)).length,
    0,
  );

  /**
   * Puntaje en vivo (2026-10-15). Un parámetro cuenta como "completo" cuando
   * TODOS sus intentos están registrados: la barra avanza así, por parámetros,
   * no por intentos. El cálculo replica el `scoring.ts` del backend; al
   * guardar, el servidor es quien manda.
   */
  const intentosVivos = (p: Parametro): IntentoVivo[] =>
    Array.from({ length: p.evaparam_intentos }, (_, i) => i + 1).map((n) =>
      aIntentoVivo(p, registro(p.evaparam_id, n)),
    );

  const parametroCompleto = (p: Parametro): boolean =>
    Array.from({ length: p.evaparam_intentos }, (_, i) => i + 1).every((n) => registrado(p, n));

  const parametrosCompletos = parametros.filter(parametroCompleto).length;
  const puntajeParametro = (p: Parametro) => puntajeDeParametro(p, intentosVivos(p));
  const puntajeAcumulado = parametros.reduce((s, p) => s + puntajeParametro(p), 0);
  const totalPosible = parametros.reduce((s, p) => s + p.evaparam_puntaje, 0);

  const aEnviar = (): IntentoInput[] => {
    const salida: IntentoInput[] = [];
    for (const p of parametros) {
      for (let n = 1; n <= p.evaparam_intentos; n += 1) {
        if (!registrado(p, n)) continue;
        salida.push({
          evaparam_id: p.evaparam_id,
          evaint_intento: n,
          ...aIntentoVivo(p, registro(p.evaparam_id, n)),
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
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    Parámetro {paso + 1} de {parametros.length}
                  </span>
                  <span className="font-medium">
                    {puntajeAcumulado} / {totalPosible} pts
                  </span>
                </div>
                <Progress value={(parametrosCompletos / Math.max(1, parametros.length)) * 100} />
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="break-words font-medium">{parametro.evaparam_nombre}</h3>
                    <span className="text-sm font-semibold">
                      {puntajeParametro(parametro)} / {parametro.evaparam_puntaje} pts
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {parametro.evatipometo_nombre} · {parametro.evaparam_intentos} intento
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

                      <CamposIntento
                        parametro={parametro}
                        intento={n}
                        registro={r}
                        onCambiar={(cambios) => cambiar(parametro.evaparam_id, n, cambios)}
                      />
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

                {puedeCalificar && (
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
                )}
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
