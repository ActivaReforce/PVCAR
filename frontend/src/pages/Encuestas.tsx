import { useState } from 'react';
import { BarChart3, CheckCircle2, Pencil, Plus, Send, Trash2, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import ConstructorEncuesta from '@/components/encuestas/ConstructorEncuesta';
import ResultadosEncuesta from '@/components/encuestas/ResultadosEncuesta';
import {
  useEliminarEncuesta,
  useEncuestas,
  useFichaEncuesta,
  useFinalizarEncuesta,
  useImpactoEncuesta,
  usePublicarEncuesta,
  useVolverABorrador,
} from '@/hooks/useEncuestas';
import { ESTADO_ENCUESTA, NOMBRE_ESTADO, type Encuesta } from '@/api/encuestas';

const TODOS = 'todos';

/**
 * Encuestas.
 *
 * El módulo **se estrena vacío**: 0 filas en producción, en los tres respaldos.
 * El código existía, los datos no. Eso permitió arreglar el esquema entero en
 * la migración 0012 y escribir las reglas como deben ser.
 *
 * El ciclo es lo que manda la pantalla: **Borrador** se edita, **Finalizada**
 * no, **Publicada** se responde y ya no se toca. Cada botón aparece solo en el
 * estado donde significa algo, en vez de salir siempre y fallar al pulsarlo.
 */
const Encuestas = () => {
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState(TODOS);

  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [viendoId, setViendoId] = useState<number | null>(null);
  const [aPublicar, setAPublicar] = useState<Encuesta | null>(null);
  const [aEliminar, setAEliminar] = useState<Encuesta | null>(null);
  const [confirmacion, setConfirmacion] = useState('');

  const lista = useEncuestas({
    buscar: busqueda || undefined,
    estado: estado === TODOS ? undefined : Number(estado),
  });
  const fichaEdicion = useFichaEncuesta(editandoId);
  const impacto = useImpactoEncuesta(aEliminar?.encu_id ?? null);

  const finalizar = useFinalizarEncuesta();
  const volver = useVolverABorrador();
  const publicar = usePublicarEncuesta();
  const eliminar = useEliminarEncuesta();

  const encuestas = lista.data ?? [];

  const cerrarConstructor = () => {
    setCreando(false);
    setEditandoId(null);
  };

  const coincide =
    confirmacion.trim().toLowerCase() === (aEliminar?.encu_titulo ?? '').trim().toLowerCase();

  const aDestruir = Object.entries(impacto.data?.eliminables ?? {}).filter(([, n]) => n > 0);

  if (lista.isLoading && !lista.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Cargando encuestas...</div>
      </div>
    );
  }

  if (lista.isError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">
          No se pudieron cargar las encuestas: {(lista.error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-w-0 max-w-5xl space-y-6 p-4 lg:p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Encuestas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preguntas a los representantes. Una encuesta se edita en borrador, se finaliza y se
            publica.
          </p>
        </div>

        <Button variant="brand" className="w-full sm:w-auto" onClick={() => setCreando(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva encuesta
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DebouncedSearchInput
          placeholder="Buscar por título..."
          value={busqueda}
          onChange={setBusqueda}
          className="w-full sm:col-span-2"
        />
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="h-11 sm:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los estados</SelectItem>
            <SelectItem value={String(ESTADO_ENCUESTA.BORRADOR)}>Borrador</SelectItem>
            <SelectItem value={String(ESTADO_ENCUESTA.FINALIZADO)}>Finalizadas</SelectItem>
            <SelectItem value={String(ESTADO_ENCUESTA.PUBLICADO)}>Publicadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {encuestas.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <p className="text-lg">Todavía no hay encuestas</p>
          <p className="mt-2 text-sm">
            Para que alguien pueda responderlas, antes tiene que haber representantes dados de
            alta con el rol y atados a sus hijos.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {encuestas.map((e) => {
          const borrador = e.est_id === ESTADO_ENCUESTA.BORRADOR;
          const finalizada = e.est_id === ESTADO_ENCUESTA.FINALIZADO;
          const publicada = e.est_id === ESTADO_ENCUESTA.PUBLICADO;
          const proporcion =
            e.representantes > 0 ? Math.round((e.respondidas / e.representantes) * 100) : 0;

          return (
            <li key={e.encu_id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words font-medium">{e.encu_titulo}</span>
                    <Badge variant={publicada ? 'default' : 'secondary'}>
                      {NOMBRE_ESTADO[e.est_id] ?? 'Desconocido'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {e.preguntas} pregunta{e.preguntas === 1 ? '' : 's'} · creada por {e.creador}
                    {publicada && ` · ${e.respondidas} de ${e.representantes} respondieron (${proporcion}%)`}
                  </p>
                  {borrador && e.preguntas === 0 && (
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                      Sin preguntas todavía: no se puede finalizar.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 sm:flex-shrink-0">
                  {borrador && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 sm:h-9 sm:w-9"
                        onClick={() => setEditandoId(e.encu_id)}
                        title="Editar"
                        aria-label={`Editar ${e.encu_titulo}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 sm:h-9"
                        onClick={() => finalizar.mutate(e.encu_id)}
                        disabled={e.preguntas === 0 || finalizar.isPending}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Finalizar
                      </Button>
                    </>
                  )}

                  {finalizada && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 sm:h-9 sm:w-9"
                        onClick={() => volver.mutate(e.encu_id)}
                        title="Volver a borrador"
                        aria-label={`Volver ${e.encu_titulo} a borrador`}
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="brand"
                        className="h-11 sm:h-9"
                        onClick={() => setAPublicar(e)}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Publicar
                      </Button>
                    </>
                  )}

                  {publicada && (
                    <Button
                      variant="outline"
                      className="h-11 sm:h-9"
                      onClick={() => setViendoId(e.encu_id)}
                    >
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Resultados
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-destructive hover:text-destructive sm:h-9 sm:w-9"
                    onClick={() => {
                      setAEliminar(e);
                      setConfirmacion('');
                    }}
                    title="Eliminar"
                    aria-label={`Eliminar ${e.encu_titulo}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={creando || editandoId !== null}
        onOpenChange={(abierto) => !abierto && cerrarConstructor()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editandoId !== null ? 'Editar encuesta' : 'Nueva encuesta'}
            </DialogTitle>
          </DialogHeader>
          {editandoId !== null && fichaEdicion.isLoading ? (
            <p className="py-6 text-center text-muted-foreground">Cargando…</p>
          ) : (
            <ConstructorEncuesta
              ficha={editandoId !== null ? (fichaEdicion.data ?? null) : null}
              onListo={cerrarConstructor}
              onCancelar={cerrarConstructor}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={viendoId !== null} onOpenChange={(a) => !a && setViendoId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Resultados</DialogTitle>
          </DialogHeader>
          <ResultadosEncuesta encuId={viendoId} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={aPublicar !== null} onOpenChange={(a) => !a && setAPublicar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar la encuesta</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              <strong>{aPublicar?.encu_titulo}</strong> pasará a verse por los{' '}
              <strong>{aPublicar?.representantes ?? 0}</strong> representantes activos la próxima
              vez que entren. <strong>A partir de ahí ya no se puede editar</strong>, porque
              cambiar una pregunta a mitad mezclaría respuestas a cosas distintas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (aPublicar) publicar.mutate(aPublicar.encu_id);
                setAPublicar(null);
              }}
            >
              Publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={aEliminar !== null}
        onOpenChange={(a) => {
          if (!a) {
            setAEliminar(null);
            setConfirmacion('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-destructive">Eliminar encuesta</DialogTitle>
            <DialogDescription className="break-words">
              Vas a eliminar <strong>{aEliminar?.encu_titulo}</strong> y todo lo que cuelga de
              ella. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {impacto.data && (
            <div className="space-y-3">
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="mb-1 text-sm font-medium">Se eliminarán también:</p>
                {aDestruir.length > 0 ? (
                  <ul className="list-disc pl-5 text-sm">
                    {aDestruir.map(([clave, n]) => (
                      <li key={clave}>
                        <strong>{n}</strong> {clave}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No tiene nada colgando: no se pierde nada más.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmacion-encuesta">
                  Escribe <strong>{aEliminar?.encu_titulo}</strong> para confirmar
                </Label>
                <Input
                  id="confirmacion-encuesta"
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  autoComplete="off"
                  className="h-11 sm:h-10"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button variant="outline" onClick={() => setAEliminar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!coincide || eliminar.isPending}
              onClick={async () => {
                if (!aEliminar) return;
                try {
                  await eliminar.mutateAsync({ id: aEliminar.encu_id, confirmacion });
                  setAEliminar(null);
                  setConfirmacion('');
                } catch {
                  // El hook ya enseña el motivo.
                }
              }}
            >
              {eliminar.isPending ? 'Eliminando…' : 'Eliminar para siempre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Encuestas;
