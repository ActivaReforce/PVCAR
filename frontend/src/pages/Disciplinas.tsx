import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import DisciplinaCalendar from '@/components/disciplinas/DisciplinaCalendar';
import DisciplinaForm from '@/components/disciplinas/DisciplinaForm';
import DisciplinaLoteForm from '@/components/disciplinas/DisciplinaLoteForm';
import BajaDisciplinaDialog from '@/components/disciplinas/BajaDisciplinaDialog';
import EliminarDisciplinaDialog from '@/components/disciplinas/EliminarDisciplinaDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useColegios } from '@/hooks/useColegios';
import { useDias, useDisciplinas, useReactivarDisciplina } from '@/hooks/useDisciplinas';
import type { Disciplina, FiltrosDisciplinas } from '@/api/disciplinas';

const TODOS = 'todos';

/** El calendario se lee entero: no tiene sentido paginarlo de siete en siete. */
const POR_PAGINA = 200;

/**
 * Disciplinas — el eje del modelo.
 *
 * Calendario semanal filtrado por alcance: el coordinador ve las de sus
 * colegios, el entrenador las suyas. Antes la pantalla resolvía eso en el
 * navegador con cinco ramas y un `return` temprano por rol, y cuando la lista
 * de permitidos salía vacía devolvía **todas** las del sistema.
 */
const Disciplinas = () => {
  const { canCreate } = usePermissions();

  const [busqueda, setBusqueda] = useState('');
  const [colegio, setColegio] = useState<string>(TODOS);
  const [dia, setDia] = useState<string>(TODOS);
  const [estado, setEstado] = useState<string>('1');

  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Disciplina | null>(null);
  const [aDarDeBaja, setADarDeBaja] = useState<Disciplina | null>(null);
  const [aEliminar, setAEliminar] = useState<Disciplina | null>(null);

  const dias = useDias();
  const colegios = useColegios({ limit: 200, orden: 'nombre' });
  const reactivar = useReactivarDisciplina();

  const filtros: FiltrosDisciplinas = {
    limit: POR_PAGINA,
    buscar: busqueda || undefined,
    colegio: colegio === TODOS ? undefined : [Number(colegio)],
    dia: dia === TODOS ? undefined : Number(dia),
    estado: estado === TODOS ? undefined : Number(estado),
    orden: 'horario',
  };

  const lista = useDisciplinas(filtros);
  const disciplinas = lista.data?.items ?? [];
  const conteos = lista.data?.conteos;

  if (lista.isLoading && !lista.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Cargando disciplinas...</div>
      </div>
    );
  }

  if (lista.isError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">
          No se pudieron cargar las disciplinas: {(lista.error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Gestión de Disciplinas
          </h1>
          {/* Los conteos salen de SQL sobre el filtro actual, no de contar la
              página cargada, que es lo que hacía la pantalla vieja. */}
          {conteos && (
            <p className="mt-1 text-sm text-muted-foreground">
              {conteos.total} disciplinas · {conteos.alumnos} inscripciones ·{' '}
              <span className={conteos.sinEntrenador > 0 ? 'text-amber-700 dark:text-amber-400' : ''}>
                {conteos.sinEntrenador} sin entrenador
              </span>
              {conteos.deBaja > 0 && ` · ${conteos.deBaja} de baja`}
            </p>
          )}
        </div>

        {canCreate('disciplinas') && (
          <Button variant="brand" className="w-full sm:w-auto" onClick={() => setCreando(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevas Disciplinas
          </Button>
        )}
      </div>

      {/* Un solo bloque de filtros: apilado en móvil, en fila desde sm. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DebouncedSearchInput
          placeholder="Buscar por colegio, actividad o día..."
          value={busqueda}
          onChange={setBusqueda}
          className="w-full xl:col-span-2"
        />

        <Select value={colegio} onValueChange={setColegio}>
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
          <Select value={dia} onValueChange={setDia}>
            <SelectTrigger className="h-11 sm:h-10">
              <SelectValue placeholder="Todos los días" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los días</SelectItem>
              {(dias.data ?? []).map((d) => (
                <SelectItem key={d.dia_id} value={String(d.dia_id)}>
                  {d.dia_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={estado} onValueChange={setEstado}>
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
      </div>

      {disciplinas.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-lg">No hay disciplinas que mostrar</p>
          <p className="mt-2 text-sm">Ajusta los filtros o crea las primeras.</p>
        </div>
      ) : (
        <DisciplinaCalendar
          disciplinas={disciplinas}
          dias={dias.data ?? []}
          onEdit={setEditando}
          onBaja={setADarDeBaja}
          onReactivar={(d) => reactivar.mutate(d.colacthor_id)}
          onEliminar={setAEliminar}
        />
      )}

      <Dialog open={creando} onOpenChange={(abierto) => !abierto && setCreando(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Crear disciplinas</DialogTitle>
          </DialogHeader>
          <DisciplinaLoteForm
            onSuccess={() => setCreando(false)}
            onCancel={() => setCreando(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editando !== null} onOpenChange={(abierto) => !abierto && setEditando(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Editar disciplina</DialogTitle>
          </DialogHeader>
          {editando && (
            <DisciplinaForm
              disciplina={editando}
              onSuccess={() => setEditando(null)}
              onCancel={() => setEditando(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <BajaDisciplinaDialog
        disciplina={aDarDeBaja}
        onClose={() => setADarDeBaja(null)}
        onHecho={() => setADarDeBaja(null)}
      />

      <EliminarDisciplinaDialog
        disciplina={aEliminar}
        onClose={() => setAEliminar(null)}
        onEliminado={() => setAEliminar(null)}
      />
    </div>
  );
};

export default Disciplinas;
