import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import { DataPagination } from '@/components/ui/data-pagination';
import EntrenadorCard from '@/components/entrenadores/EntrenadorCard';
import EntrenadorFicha from '@/components/entrenadores/EntrenadorFicha';
import AsignarDisciplinaModal from '@/components/entrenadores/AsignarDisciplinaModal';
import { useColegios } from '@/hooks/useColegios';
import { useEntrenadores } from '@/hooks/useEntrenadores';
import type { Entrenador, FiltrosEntrenadores } from '@/api/entrenadores';

const POR_PAGINA = 9;
const TODOS = 'todos';

/**
 * Entrenadores.
 *
 * La lista llega filtrada por alcance: un coordinador ve solo a quienes dan
 * clase en sus colegios. Antes el filtro por colegio del sistema viejo usaba
 * un **hash del nombre del colegio** como identificador y el alcance se
 * resolvía cruzando arrays de nombres en el navegador.
 */
const Entrenadores = () => {
  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [colegio, setColegio] = useState(TODOS);
  const [estado, setEstado] = useState('1');
  const [sinAsignar, setSinAsignar] = useState(false);

  const [viendo, setViendo] = useState<Entrenador | null>(null);
  const [asignando, setAsignando] = useState<Entrenador | null>(null);

  const colegios = useColegios({ limit: 200, orden: 'nombre' });

  const filtros: FiltrosEntrenadores = {
    page,
    limit: POR_PAGINA,
    buscar: busqueda || undefined,
    colegio: colegio === TODOS ? undefined : [Number(colegio)],
    estado: estado === TODOS ? undefined : Number(estado),
    sinAsignar: sinAsignar || undefined,
    orden: 'nombre',
  };

  const lista = useEntrenadores(filtros);
  const entrenadores = lista.data?.items ?? [];
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
        <div className="text-lg">Cargando entrenadores...</div>
      </div>
    );
  }

  if (lista.isError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">
          No se pudieron cargar los entrenadores: {(lista.error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Gestión de Entrenadores</h1>
        {conteos && (
          <p className="mt-1 text-sm text-muted-foreground">
            {conteos.total} entrenadores · {conteos.activos} activos
            {conteos.inactivos > 0 && ` · ${conteos.inactivos} inactivos`} ·{' '}
            <span className={conteos.sinAsignar > 0 ? 'text-amber-700 dark:text-amber-400' : ''}>
              {conteos.sinAsignar} sin disciplinas
            </span>
          </p>
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

        <div className="grid grid-cols-2 gap-3">
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
            Sin asignar
          </Button>
        </div>
      </div>

      {entrenadores.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-lg">No hay entrenadores que mostrar</p>
          <p className="mt-2 text-sm">
            Los entrenadores se crean desde Usuarios, dándole a alguien el rol de Entrenador.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {entrenadores.map((e) => (
              <EntrenadorCard
                key={e.ent_id}
                entrenador={e}
                onVer={setViendo}
                onAsignar={setAsignando}
              />
            ))}
          </div>

          <DataPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            canGoNext={page < totalPages}
            canGoPrevious={page > 1}
            startIndex={(page - 1) * POR_PAGINA}
            endIndex={Math.min(page * POR_PAGINA, totalItems)}
            totalItems={totalItems}
            itemName="entrenadores"
          />
        </>
      )}

      <Dialog open={viendo !== null} onOpenChange={(abierto) => !abierto && setViendo(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="break-words text-lg sm:text-xl">
              {viendo?.usu_nombre}
            </DialogTitle>
          </DialogHeader>
          {viendo && (
            <EntrenadorFicha
              entId={viendo.ent_id}
              onAsignar={() => {
                setAsignando(viendo);
                setViendo(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AsignarDisciplinaModal entrenador={asignando} onClose={() => setAsignando(null)} />
    </div>
  );
};

export default Entrenadores;
