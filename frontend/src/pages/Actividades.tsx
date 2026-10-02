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
import ActivityCard from '@/components/activities/ActivityCard';
import { GrupoDesplegable } from '@/components/comun/TarjetaDesplegable';
import ActivityForm from '@/components/activities/ActivityForm';
import EliminarActividadDialog from '@/components/activities/EliminarActividadDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useActividades, useCategorias } from '@/hooks/useActividades';
import type { Actividad, FiltrosActividades } from '@/api/actividades';

/** Todas a la vez: son unas veinte y el tope del API es 200. Sin paginador. */
const TODAS_DE_UNA = 200;
const TODAS = 'todas';
/** Valor del filtro para las que no tienen categoría (el API lo entiende como 0). */
const SIN_CATEGORIA = '0';

const ORDENES: Array<{ valor: NonNullable<FiltrosActividades['orden']>; etiqueta: string }> = [
  { valor: 'nombre', etiqueta: 'nombre' },
  { valor: 'disciplinas', etiqueta: 'más usadas' },
  { valor: 'creacion', etiqueta: 'más recientes' },
];

/**
 * Actividades: el catálogo de qué se imparte.
 *
 * Todas de una vez, en secciones por categoría, sin paginador (pedido del
 * cliente al probar la Fase 8). Cada tarjeta enseña el nombre y su menú; el
 * detalle se despliega al pasar el ratón y se queda abierto con un clic. La
 * búsqueda, el filtro y el orden siguen en el servidor.
 */
const Actividades = () => {
  const { canCreate } = usePermissions();

  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string>(TODAS);
  const [orden, setOrden] = useState<FiltrosActividades['orden']>('nombre');

  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Actividad | null>(null);
  const [aEliminar, setAEliminar] = useState<Actividad | null>(null);

  const categorias = useCategorias();

  const filtros: FiltrosActividades = {
    page: 1,
    limit: TODAS_DE_UNA,
    buscar: busqueda || undefined,
    categoria: categoria === TODAS ? undefined : Number(categoria),
    orden,
    dir: orden === 'disciplinas' || orden === 'creacion' ? 'desc' : 'asc',
  };

  const lista = useActividades(filtros);
  const actividades = lista.data?.items ?? [];

  /* Secciones por categoría en el orden de la lista (alfabético por categoría);
     "Sin categoría" siempre al final. El orden elegido manda dentro de cada una. */
  const secciones = new Map<string, Actividad[]>();
  for (const a of actividades) {
    const clave = a.cat_nombre ?? '';
    secciones.set(clave, [...(secciones.get(clave) ?? []), a]);
  }
  const ordenSecciones = [...secciones.keys()].sort((x, y) =>
    x === '' ? 1 : y === '' ? -1 : x.localeCompare(y, 'es'),
  );


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
          onChange={(texto) => setBusqueda(texto)}
          className="w-full"
        />
        <Select
          value={categoria}
          onValueChange={(valor) => setCategoria(valor)}
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
            <SelectItem value={SIN_CATEGORIA}>Sin categoría</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={orden}
          onValueChange={(valor) =>
            setOrden(valor as FiltrosActividades['orden'])
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
        <GrupoDesplegable>
          <div className="space-y-6">
            {ordenSecciones.map((clave) => {
              const delGrupo = secciones.get(clave) ?? [];
              return (
                <section key={clave || 'sin-categoria'} className="space-y-2">
                  <header className="flex items-baseline justify-between border-b pb-1">
                    <h2 className="font-semibold">{clave || 'Sin categoría'}</h2>
                    <span className="text-xs text-muted-foreground">
                      {delGrupo.length} {delGrupo.length === 1 ? 'actividad' : 'actividades'}
                    </span>
                  </header>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {delGrupo.map((actividad) => (
                      <ActivityCard
                        key={actividad.act_id}
                        actividad={actividad}
                        onEdit={setEditando}
                        onDelete={setAEliminar}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </GrupoDesplegable>
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
