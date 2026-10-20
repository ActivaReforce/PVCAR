import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import { DataPagination } from '@/components/ui/data-pagination';
import EvaluacionesLista from '@/components/evaluaciones/EvaluacionesLista';
import EvaluacionForm from '@/components/evaluaciones/EvaluacionForm';
import EvaluarAlumnos from '@/components/evaluaciones/EvaluarAlumnos';
import EliminarEvaluacionDialog from '@/components/evaluaciones/EliminarEvaluacionDialog';
import PrevisualizarEvaluacionDialog from '@/components/evaluaciones/PrevisualizarEvaluacionDialog';
import VincularDisciplinasDialog from '@/components/evaluaciones/VincularDisciplinasDialog';
import EvaluacionesDeHijos from '@/components/evaluaciones/EvaluacionesDeHijos';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useCategoriasEvaluacion,
  useDarDeBajaEvaluacion,
  useEvaluaciones,
  useEvaluacionesDeMisHijos,
  useFichaEvaluacion,
  useReactivarEvaluacion,
  useResetearEvaluados,
} from '@/hooks/useEvaluaciones';
import type { Evaluacion, FiltrosEvaluaciones } from '@/api/evaluaciones';

const POR_PAGINA = 20;
const TODOS = 'todos';
const ROL_REPRESENTANTE = 4;

/** Las notas de los hijos, con sus estados de carga. */
const MisHijos = ({ consulta }: { consulta: ReturnType<typeof useEvaluacionesDeMisHijos> }) => {
  if (consulta.isLoading) {
    return <p className="py-8 text-center text-muted-foreground">Cargando evaluaciones…</p>;
  }
  if (consulta.isError) {
    return (
      <p className="text-destructive">
        No se pudieron cargar las evaluaciones: {(consulta.error as Error).message}
      </p>
    );
  }
  return <EvaluacionesDeHijos evaluaciones={consulta.data ?? []} />;
};

/**
 * Evaluaciones.
 *
 * Dos pestañas, como antes: **Gestión** (las plantillas) y **Evaluar alumnos**.
 * Lo que cambia es que todo pasa por el API y que la nota la calcula el
 * servidor; el navegador solo la muestra.
 *
 * El módulo casi no se ha usado —5 evaluaciones y **un solo intento registrado**
 * en producción— así que sus huecos no han hecho daño todavía. Los que más
 * importaban están cerrados en el backend: desvincular ya no borra notas,
 * cambiarle el método a un parámetro con notas se rechaza, y vincular una
 * disciplina crea las pendientes en una sola transacción.
 */
const Evaluaciones = () => {
  const { canCreate, hasPermission } = usePermissions();
  const { user } = useAuth();
  // Calificar es su propio módulo desde la 0026: ver notas y pendientes.
  const veCalificaciones = hasPermission('calificaciones', 'ver');

  /**
   * El representante con la casilla Ver ve las notas de sus hijos, no las
   * plantillas (2026-10-20). Si además tiene un rol de personal, le sale
   * como una pestaña más.
   */
  const roles = user?.roles ?? [];
  const esRepresentante = roles.some((r) => r.rol_id === ROL_REPRESENTANTE);
  const esPersonal = roles.some((r) => r.rol_id !== ROL_REPRESENTANTE);
  const misHijos = useEvaluacionesDeMisHijos(esRepresentante);
  const pestanas = 1 + (veCalificaciones ? 1 : 0) + (esRepresentante ? 1 : 0);

  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState(TODOS);
  const [estado, setEstado] = useState('1');

  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [previsualizandoId, setPrevisualizandoId] = useState<number | null>(null);
  const [vinculando, setVinculando] = useState<Evaluacion | null>(null);
  const [aDarDeBaja, setADarDeBaja] = useState<Evaluacion | null>(null);
  const [aEliminar, setAEliminar] = useState<Evaluacion | null>(null);
  const [aEditarConNotas, setAEditarConNotas] = useState<Evaluacion | null>(null);
  const [confirmandoReseteo, setConfirmandoReseteo] = useState(false);
  const resetear = useResetearEvaluados();

  const categorias = useCategoriasEvaluacion();
  const baja = useDarDeBajaEvaluacion();
  const reactivar = useReactivarEvaluacion();
  const fichaEdicion = useFichaEvaluacion(editandoId);

  const filtros: FiltrosEvaluaciones = {
    page,
    limit: POR_PAGINA,
    buscar: busqueda || undefined,
    categoria: categoria === TODOS ? undefined : categoria,
    estado: estado === TODOS ? undefined : Number(estado),
    orden: 'creacion',
  };

  const lista = useEvaluaciones(filtros, esPersonal);
  const evaluaciones = lista.data?.items ?? [];
  const conteos = lista.data?.conteos;
  const totalItems = lista.data?.total ?? 0;
  const totalPages = lista.data?.totalPages ?? 0;

  const cambiarFiltro = (accion: () => void) => {
    accion();
    setPage(1);
  };

  const cerrarFormulario = () => {
    setCreando(false);
    setEditandoId(null);
  };

  if (!esPersonal) {
    return (
      <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Evaluaciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">Las notas de tus representados.</p>
        </div>
        <MisHijos consulta={misHijos} />
      </div>
    );
  }

  if (lista.isLoading && !lista.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Cargando evaluaciones...</div>
      </div>
    );
  }

  if (lista.isError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">
          No se pudieron cargar las evaluaciones: {(lista.error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Evaluaciones</h1>
          {conteos && (
            <p className="mt-1 text-sm text-muted-foreground">
              {conteos.total} evaluaciones · {conteos.activas} activas
              {conteos.deBaja > 0 && ` · ${conteos.deBaja} de baja`}
              {conteos.sinDisciplinas > 0 && (
                <>
                  {' · '}
                  <span className="text-amber-700 dark:text-amber-400">
                    {conteos.sinDisciplinas} sin vincular
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {canCreate('evaluaciones') && (
          <Button variant="brand" className="w-full sm:w-auto" onClick={() => setCreando(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Evaluación
          </Button>
        )}
      </div>

      <Tabs defaultValue="gestion">
        <TabsList
          className={`grid w-full sm:inline-flex sm:w-auto ${
            pestanas === 3 ? 'grid-cols-3' : pestanas === 2 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          <TabsTrigger value="gestion">Gestión</TabsTrigger>
          {veCalificaciones && <TabsTrigger value="evaluar">Evaluar alumnos</TabsTrigger>}
          {esRepresentante && <TabsTrigger value="mis-hijos">Mis hijos</TabsTrigger>}
        </TabsList>

        <TabsContent value="gestion" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DebouncedSearchInput
              placeholder="Buscar por título o descripción..."
              value={busqueda}
              onChange={(texto) => cambiarFiltro(() => setBusqueda(texto))}
              className="w-full xl:col-span-2"
            />

            <Select value={categoria} onValueChange={(v) => cambiarFiltro(() => setCategoria(v))}>
              <SelectTrigger className="h-11 sm:h-10">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas las categorías</SelectItem>
                {(categorias.data ?? []).map((c) => (
                  <SelectItem key={c.categoria} value={c.categoria}>
                    {c.categoria} ({c.evaluaciones})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={estado} onValueChange={(v) => cambiarFiltro(() => setEstado(v))}>
              <SelectTrigger className="h-11 sm:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Activas</SelectItem>
                <SelectItem value="2">De baja</SelectItem>
                <SelectItem value={TODOS}>Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <EvaluacionesLista
            evaluaciones={evaluaciones}
            onPrevisualizar={(e) => setPrevisualizandoId(e.eva_id)}
            onEditar={(e) =>
              e.evaluados > 0 ? setAEditarConNotas(e) : setEditandoId(e.eva_id)
            }
            onVincular={setVinculando}
            onBaja={setADarDeBaja}
            onReactivar={(e) => reactivar.mutate(e.eva_id)}
            onEliminar={setAEliminar}
          />

          {evaluaciones.length > 0 && (
            <DataPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              canGoNext={page < totalPages}
              canGoPrevious={page > 1}
              startIndex={(page - 1) * POR_PAGINA}
              endIndex={Math.min(page * POR_PAGINA, totalItems)}
              totalItems={totalItems}
              itemName="evaluaciones"
            />
          )}
        </TabsContent>

        <TabsContent value="evaluar" className="mt-4">
          <EvaluarAlumnos evaluaciones={evaluaciones} />
        </TabsContent>

        {esRepresentante && (
          <TabsContent value="mis-hijos" className="mt-4">
            <MisHijos consulta={misHijos} />
          </TabsContent>
        )}
      </Tabs>

      <Dialog
        open={creando || editandoId !== null}
        onOpenChange={(abierto) => !abierto && cerrarFormulario()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editandoId !== null ? 'Editar evaluación' : 'Nueva evaluación'}
            </DialogTitle>
          </DialogHeader>

          {editandoId !== null && fichaEdicion.isLoading ? (
            <p className="py-6 text-center text-muted-foreground">Cargando evaluación…</p>
          ) : (
            <EvaluacionForm
              ficha={editandoId !== null ? (fichaEdicion.data ?? null) : null}
              onListo={cerrarFormulario}
              onCancelar={cerrarFormulario}
            />
          )}
        </DialogContent>
      </Dialog>

      <PrevisualizarEvaluacionDialog
        evaId={previsualizandoId}
        onClose={() => setPrevisualizandoId(null)}
      />

      <VincularDisciplinasDialog evaluacion={vinculando} onClose={() => setVinculando(null)} />

      <AlertDialog
        open={aDarDeBaja !== null}
        onOpenChange={(abierto) => !abierto && setADarDeBaja(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dar de baja la evaluación</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              <strong>{aDarDeBaja?.eva_titulo}</strong> dejará de salir en la lista de activas. Sus{' '}
              <strong>{aDarDeBaja?.disciplinas ?? 0}</strong> vínculo(s) y las notas ya puestas se
              conservan, y se puede reactivar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (aDarDeBaja) baja.mutate(aDarDeBaja.eva_id);
                setADarDeBaja(null);
              }}
            >
              Dar de baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EliminarEvaluacionDialog evaluacion={aEliminar} onClose={() => setAEliminar(null)} />

      {/*
        Bloqueo al editar una plantilla con alumnos evaluados (pedido del
        cliente, 2026-10-15). Primero avisa; para desbloquear hay que borrar
        las notas de todos (segunda confirmación) y volver a evaluarlos.
      */}
      <AlertDialog
        open={aEditarConNotas !== null && !confirmandoReseteo}
        onOpenChange={(a) => (!a ? setAEditarConNotas(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No se puede editar con notas puestas</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              <strong>{aEditarConNotas?.eva_titulo}</strong> tiene{' '}
              <strong>{aEditarConNotas?.evaluados ?? 0}</strong> alumno(s) evaluado(s). Cambiar
              los parámetros ahora dejaría las notas puestas con un método que ya no coincide. Si
              quieres editar, antes hay que borrar todas las notas; después tendrás que volver a
              evaluar a esos alumnos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                setConfirmandoReseteo(true);
              }}
            >
              Borrar notas y editar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmandoReseteo}
        onOpenChange={(a) => (!a ? setConfirmandoReseteo(false) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar las {aEditarConNotas?.evaluados ?? 0} notas?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              Se borran los intentos registrados y los alumnos vuelven a <em>Por evaluar</em>.
              Esta acción no se puede deshacer. Al terminar se abre el formulario para que puedas
              editar la plantilla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <AlertDialogCancel disabled={resetear.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={resetear.isPending}
              onClick={async (e) => {
                e.preventDefault();
                if (!aEditarConNotas) return;
                try {
                  await resetear.mutateAsync(aEditarConNotas.eva_id);
                  setEditandoId(aEditarConNotas.eva_id);
                  setAEditarConNotas(null);
                  setConfirmandoReseteo(false);
                } catch {
                  // El hook ya enseña el motivo.
                }
              }}
            >
              {resetear.isPending ? 'Borrando…' : 'Sí, borrar y editar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Evaluaciones;
