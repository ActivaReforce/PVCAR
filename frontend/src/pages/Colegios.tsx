import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import { DataPagination } from '@/components/ui/data-pagination';
import SchoolCard from '@/components/schools/SchoolCard';
import SchoolForm from '@/components/schools/SchoolForm';
import EliminarColegioDialog from '@/components/schools/EliminarColegioDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useColegio, useColegios } from '@/hooks/useColegios';
import type { ColegioListado, FiltrosColegios } from '@/api/colegios';

const POR_PAGINA = 9;

const ORDENES: Array<{ valor: NonNullable<FiltrosColegios['orden']>; etiqueta: string }> = [
  { valor: 'nombre', etiqueta: 'Nombre' },
  { valor: 'estudiantes', etiqueta: 'Más alumnos' },
  { valor: 'disciplinas', etiqueta: 'Más disciplinas' },
  { valor: 'creacion', etiqueta: 'Más recientes' },
];

/**
 * Colegios.
 *
 * Búsqueda, orden y paginación los resuelve el servidor, y la lista llega ya
 * filtrada por alcance: un coordinador ve solo los suyos. Antes esta pantalla
 * se traía la tabla `colegio` entera con la anon key —los siete colegios y los
 * datos de contacto de todos, para cualquiera— y filtraba y paginaba en el
 * navegador.
 */
const Colegios = () => {
  const { canCreate } = usePermissions();

  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<FiltrosColegios['orden']>('nombre');

  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [aEliminar, setAEliminar] = useState<ColegioListado | null>(null);

  const filtros: FiltrosColegios = {
    page,
    limit: POR_PAGINA,
    buscar: busqueda || undefined,
    orden,
    // "Más alumnos" y "más disciplinas" solo tienen sentido de mayor a menor.
    dir: orden === 'nombre' ? 'asc' : 'desc',
  };

  const lista = useColegios(filtros);
  const fichaEdicion = useColegio(editandoId);

  const colegios = lista.data?.items ?? [];
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

  if (lista.isLoading && !lista.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Cargando colegios...</div>
      </div>
    );
  }

  if (lista.isError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">
          No se pudieron cargar los colegios: {(lista.error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Gestión de Colegios</h1>
        {canCreate('colegios') && (
          <Button variant="brand" className="w-full sm:w-auto" onClick={() => setCreando(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Colegio
          </Button>
        )}
      </div>

      {/* Un solo bloque de filtros para los dos tamaños: en móvil se apilan. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <DebouncedSearchInput
          placeholder="Buscar por nombre, dirección o contacto..."
          value={busqueda}
          onChange={(texto) => cambiarFiltro(() => setBusqueda(texto))}
          className="w-full"
        />
        <Select
          value={orden}
          onValueChange={(valor) =>
            cambiarFiltro(() => setOrden(valor as FiltrosColegios['orden']))
          }
        >
          <SelectTrigger className="h-11 w-full sm:h-10 sm:w-56">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            {ORDENES.map(({ valor, etiqueta }) => (
              <SelectItem key={valor} value={valor}>
                Ordenar por {etiqueta.toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {colegios.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-lg">No hay colegios que mostrar</p>
          <p className="mt-2 text-sm">
            {busqueda
              ? 'Ninguno coincide con la búsqueda.'
              : 'Crea el primero con el botón de arriba.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {colegios.map((colegio) => (
              <SchoolCard
                key={colegio.col_id}
                colegio={colegio}
                onEdit={(c) => setEditandoId(c.col_id)}
                onDelete={setAEliminar}
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
            itemName="colegios"
          />
        </>
      )}

      <Dialog
        open={creando || editandoId !== null}
        onOpenChange={(abierto) => !abierto && cerrarFormulario()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editandoId !== null ? 'Editar Colegio' : 'Nuevo Colegio'}
            </DialogTitle>
            <DialogDescription>
              Los coordinadores que elijas verán únicamente los datos de este colegio.
            </DialogDescription>
          </DialogHeader>

          {editandoId !== null && fichaEdicion.isLoading ? (
            <p className="py-6 text-center text-muted-foreground">Cargando ficha…</p>
          ) : (
            <SchoolForm
              colegio={editandoId !== null ? fichaEdicion.data : null}
              onSuccess={cerrarFormulario}
              onCancel={cerrarFormulario}
            />
          )}
        </DialogContent>
      </Dialog>

      <EliminarColegioDialog
        colegio={aEliminar}
        onClose={() => setAEliminar(null)}
        onEliminado={() => setAEliminar(null)}
      />
    </div>
  );
};

export default Colegios;
