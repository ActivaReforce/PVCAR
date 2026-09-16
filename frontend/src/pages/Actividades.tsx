import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import ActivityCard from '@/components/activities/ActivityCard';
import ActivityForm from '@/components/activities/ActivityForm';
import EliminarActividadDialog from '@/components/activities/EliminarActividadDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useActividades, useCategorias } from '@/hooks/useActividades';
import type { Actividad, FiltrosActividades } from '@/api/actividades';

const POR_PAGINA = 9;
const TODAS = 'todas';

const ORDENES: Array<{ valor: NonNullable<FiltrosActividades['orden']>; etiqueta: string }> = [
  { valor: 'nombre', etiqueta: 'nombre' },
  { valor: 'disciplinas', etiqueta: 'más usadas' },
  { valor: 'categoria', etiqueta: 'categoría' },
  { valor: 'creacion', etiqueta: 'más recientes' },
];

/**
 * Actividades: el catálogo de qué se imparte.
 *
 * La pantalla vieja tenía dos vistas conmutables —"sobres" por categoría y
 * rejilla— más un modal de detalles, y todo salía de traerse la tabla entera.
 * Aquí hay una sola vista: tarjetas que ya enseñan el detalle, con el filtro
 * de categoría arriba y la búsqueda, el orden y la paginación en el servidor.
 */
const Actividades = () => {
  const { canCreate } = usePermissions();

  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string>(TODAS);
  const [orden, setOrden] = useState<FiltrosActividades['orden']>('nombre');

  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Actividad | null>(null);
  const [aEliminar, setAEliminar] = useState<Actividad | null>(null);

  const categorias = useCategorias();

  const filtros: FiltrosActividades = {
    page,
    limit: POR_PAGINA,
    buscar: busqueda || undefined,
    categoria: categoria === TODAS ? undefined : Number(categoria),
    orden,
    dir: orden === 'disciplinas' || orden === 'creacion' ? 'desc' : 'asc',
  };

  const lista = useActividades(filtros);
  const actividades = lista.data?.items ?? [];
  const totalItems = lista.data?.total ?? 0;
  const totalPages = lista.data?.totalPages ?? 0;

  const cambiarFiltro = (accion: () => void) => {
    accion();
    setPage(1);
  };

  const cerrarFormulario = () => {
    setCreando(false);
    setEditando(null);
  };

  if (lista.isLoading && !lista.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Cargando actividades...</div>
      </div>
    );
  }

  if (lista.isError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">
          No se pudieron cargar las actividades: {(lista.error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Gestión de Actividades</h1>
        {canCreate('actividades') && (
          <Button variant="brand" className="w-full sm:w-auto" onClick={() => setCreando(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Actividad
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <DebouncedSearchInput
          placeholder="Buscar por nombre o descripción..."
          value={busqueda}
          onChange={(texto) => cambiarFiltro(() => setBusqueda(texto))}
          className="w-full"
        />
        <Select
          value={categoria}
          onValueChange={(valor) => cambiarFiltro(() => setCategoria(valor))}
        >
          <SelectTrigger className="h-11 w-full sm:h-10 sm:w-56">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas las categorías</SelectItem>
            {(categorias.data ?? []).map((c) => (
              <SelectItem key={c.cat_id} value={String(c.cat_id)}>
                {c.cat_nombre} ({c.actividades})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={orden}
          onValueChange={(valor) =>
            cambiarFiltro(() => setOrden(valor as FiltrosActividades['orden']))
          }
        >
          <SelectTrigger className="h-11 w-full sm:h-10 sm:w-52">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            {ORDENES.map(({ valor, etiqueta }) => (
              <SelectItem key={valor} value={valor}>
                Ordenar por {etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {actividades.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-lg">No hay actividades que mostrar</p>
          <p className="mt-2 text-sm">
            {busqueda || categoria !== TODAS
              ? 'Ninguna coincide con los filtros.'
              : 'Crea la primera con el botón de arriba.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {actividades.map((actividad) => (
              <ActivityCard
                key={actividad.act_id}
                actividad={actividad}
                onEdit={setEditando}
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
            itemName="actividades"
          />
        </>
      )}

      <Dialog
        open={creando || editando !== null}
        onOpenChange={(abierto) => !abierto && cerrarFormulario()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editando ? 'Editar Actividad' : 'Nueva Actividad'}
            </DialogTitle>
          </DialogHeader>
          <ActivityForm
            actividad={editando}
            onSuccess={cerrarFormulario}
            onCancel={cerrarFormulario}
          />
        </DialogContent>
      </Dialog>

      <EliminarActividadDialog
        actividad={aEliminar}
        onClose={() => setAEliminar(null)}
        onEliminado={() => setAEliminar(null)}
      />
    </div>
  );
};

export default Actividades;
