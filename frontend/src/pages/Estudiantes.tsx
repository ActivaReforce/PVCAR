import { useState } from 'react';
import { Plus } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import { DataPagination } from '@/components/ui/data-pagination';
import EstudiantesLista from '@/components/estudiantes/EstudiantesLista';
import EstudianteForm from '@/components/estudiantes/EstudianteForm';
import EstudianteFicha from '@/components/estudiantes/EstudianteFicha';
import EliminarEstudianteDialog from '@/components/estudiantes/EliminarEstudianteDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useColegios } from '@/hooks/useColegios';
import {
  useDarDeBajaEstudiante,
  useEstudiantes,
  useFichaEstudiante,
  useGrados,
  useReactivarEstudiante,
} from '@/hooks/useEstudiantes';
import type { Estudiante, FiltrosEstudiantes } from '@/api/estudiantes';

const POR_PAGINA = 20;
const TODOS = 'todos';

/**
 * Estudiantes.
 *
 * 796 alumnos: búsqueda, filtros, orden, paginación y conteos los resuelve el
 * servidor. El sistema viejo pedía los 796 con sus relaciones anidadas y
 * contaba con `.filter()` en el navegador — y, como el filtro por alcance
 * también vivía allí, cuando la lista de colegios permitidos salía vacía
 * devolvía **todos**.
 */
const Estudiantes = () => {
  const { canCreate } = usePermissions();

  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [colegio, setColegio] = useState(TODOS);
  const [grado, setGrado] = useState(TODOS);
  const [estado, setEstado] = useState('1');
  const [sinAsignar, setSinAsignar] = useState(false);

  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [viendoId, setViendoId] = useState<number | null>(null);
  const [aDarDeBaja, setADarDeBaja] = useState<Estudiante | null>(null);
  const [aEliminar, setAEliminar] = useState<Estudiante | null>(null);

  const colegios = useColegios({ limit: 200, orden: 'nombre' });
  const grados = useGrados();
  const baja = useDarDeBajaEstudiante();
  const reactivar = useReactivarEstudiante();
  const fichaEdicion = useFichaEstudiante(editandoId, false);

  const filtros: FiltrosEstudiantes = {
    page,
    limit: POR_PAGINA,
    buscar: busqueda || undefined,
    colegio: colegio === TODOS ? undefined : [Number(colegio)],
    grado: grado === TODOS ? undefined : Number(grado),
    estado: estado === TODOS ? undefined : Number(estado),
    sinAsignar: sinAsignar || undefined,
    orden: 'nombre',
  };

  const lista = useEstudiantes(filtros);
  const estudiantes = lista.data?.items ?? [];
  const conteos = lista.data?.conteos;
  const totalItems = lista.data?.total ?? 0;
  const totalPages = lista.data?.totalPages ?? 0;

  const cambiarFiltro = (accion: () => void) => {
    accion();
    setPage(1);
  };

  if (lista.isLoading && !lista.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Cargando estudiantes...</div>
      </div>
    );
  }

  if (lista.isError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">
          No se pudieron cargar los estudiantes: {(lista.error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Gestión de Alumnos</h1>
          {conteos && (
            <p className="mt-1 text-sm text-muted-foreground">
              {conteos.total} alumnos · {conteos.activos} activos
              {conteos.inactivos > 0 && ` · ${conteos.inactivos} inactivos`} ·{' '}
              <span className={conteos.sinAsignar > 0 ? 'text-amber-700 dark:text-amber-400' : ''}>
                {conteos.sinAsignar} sin disciplinas
              </span>
            </p>
          )}
        </div>

        {canCreate('estudiantes') && (
          <Button variant="brand" className="w-full sm:w-auto" onClick={() => setCreando(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Alumno
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DebouncedSearchInput
          placeholder="Buscar por nombre o cédula..."
          value={busqueda}
          onChange={(texto) => cambiarFiltro(() => setBusqueda(texto))}
          className="w-full xl:col-span-2"
        />

        <Select value={colegio} onValueChange={(v) => cambiarFiltro(() => setColegio(v))}>
          <SelectTrigger className="h-11 sm:h-10">
            <SelectValue placeholder="Todos los colegios" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los colegios</SelectItem>
            {(colegios.data?.items ?? []).map((c) => (
              <SelectItem key={c.col_id} value={String(c.col_id)}>
                {c.col_nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={grado} onValueChange={(v) => cambiarFiltro(() => setGrado(v))}>
          <SelectTrigger className="h-11 sm:h-10">
            <SelectValue placeholder="Todos los grados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los grados</SelectItem>
            {(grados.data ?? []).map((g) => (
              <SelectItem key={g.catninograd_id} value={String(g.catninograd_id)}>
                {g.catninograd_nombre} ({g.estudiantes})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-3 sm:col-span-2 xl:col-span-4 xl:w-96">
          <Select value={estado} onValueChange={(v) => cambiarFiltro(() => setEstado(v))}>
            <SelectTrigger className="h-11 sm:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Activos</SelectItem>
              <SelectItem value="2">Inactivos</SelectItem>
              <SelectItem value={TODOS}>Todos</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={sinAsignar ? 'default' : 'outline'}
            className="h-11 sm:h-10"
            onClick={() => cambiarFiltro(() => setSinAsignar((v) => !v))}
          >
            Sin disciplinas
          </Button>
        </div>
      </div>

      <EstudiantesLista
        estudiantes={estudiantes}
        onVer={(e) => setViendoId(e.nino_id)}
        onEditar={(e) => setEditandoId(e.nino_id)}
        onBaja={setADarDeBaja}
        onReactivar={(e) => reactivar.mutate(e.nino_id)}
        onEliminar={setAEliminar}
      />

      {estudiantes.length > 0 && (
        <DataPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          canGoNext={page < totalPages}
          canGoPrevious={page > 1}
          startIndex={(page - 1) * POR_PAGINA}
          endIndex={Math.min(page * POR_PAGINA, totalItems)}
          totalItems={totalItems}
          itemName="alumnos"
        />
      )}

      {/* Alta y edición comparten formulario; en edición se espera la ficha. */}
      <Dialog
        open={creando || editandoId !== null}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setCreando(false);
            setEditandoId(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editandoId !== null ? 'Editar Alumno' : 'Nuevo Alumno'}
            </DialogTitle>
          </DialogHeader>

          {editandoId !== null && fichaEdicion.isLoading ? (
            <p className="py-6 text-center text-muted-foreground">Cargando ficha…</p>
          ) : (
            <EstudianteForm
              estudiante={editandoId !== null ? fichaEdicion.data?.estudiante : null}
              onSuccess={() => {
                setCreando(false);
                setEditandoId(null);
              }}
              onCancel={() => {
                setCreando(false);
                setEditandoId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={viendoId !== null} onOpenChange={(abierto) => !abierto && setViendoId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="break-words text-lg sm:text-xl">
              Ficha del alumno
            </DialogTitle>
          </DialogHeader>
          {viendoId !== null && <EstudianteFicha ninoId={viendoId} />}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={aDarDeBaja !== null}
        onOpenChange={(abierto) => !abierto && setADarDeBaja(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dar de baja al alumno</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              <strong>{aDarDeBaja?.nino_nombre}</strong> dejará de aparecer en las listas de
              asistencia. Sus <strong>{aDarDeBaja?.disciplinas ?? 0}</strong> inscripciones activas
              se cerrarán con la fecha de hoy. El historial se conserva y se puede reactivar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (aDarDeBaja) baja.mutate(aDarDeBaja.nino_id);
                setADarDeBaja(null);
              }}
            >
              Dar de baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EliminarEstudianteDialog
        estudiante={aEliminar}
        onClose={() => setAEliminar(null)}
        onEliminado={() => setAEliminar(null)}
      />
    </div>
  );
};

export default Estudiantes;
