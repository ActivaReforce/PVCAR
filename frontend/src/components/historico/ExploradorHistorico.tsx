import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import { DataPagination } from '@/components/ui/data-pagination';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import SelectorBuscable from './SelectorBuscable';
import { cn } from '@/lib/utils';
import {
  useConjuntoHistorico,
  useConjuntosHistorico,
  useExportarHistorico,
  useOpcionesHistorico,
} from '@/hooks/useHistorico';
import type {
  ColumnaHistorico,
  ConjuntoDisponible,
  FiltrosHistorico,
  GrupoConjunto,
  Opcion,
  Orden,
} from '@/api/historico';

const GRUPOS: GrupoConjunto[] = ['Personas', 'Estructura', 'Asistencia', 'Evaluaciones'];
const POR_PAGINA = 50;
const TODOS = 'todos';

const entero = (n: number) => n.toLocaleString('es-EC');

function celda(valor: unknown, columna: ColumnaHistorico): string {
  if (valor === null || valor === undefined || valor === '') return '';
  if (columna.numero && typeof valor === 'number') {
    const texto = valor.toLocaleString('es-EC');
    return columna.clave.startsWith('pct_') ? `${texto} %` : texto;
  }
  return String(valor);
}

// ---------------------------------------------------------------------------

/**
 * Los quince conjuntos, agrupados. En pantalla ancha, una columna fija a la
 * izquierda; en el teléfono, un desplegable arriba.
 */
function SelectorDeConjunto({
  conjuntos,
  actual,
  onElegir,
}: {
  conjuntos: ConjuntoDisponible[];
  actual: string;
  onElegir: (id: string) => void;
}) {
  return (
    <>
      <div className="lg:hidden">
        <Label className="text-xs">Qué quieres ver</Label>
        <Select value={actual} onValueChange={onElegir}>
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRUPOS.map((g) => (
              <SelectGroup key={g}>
                <SelectLabel>{g}</SelectLabel>
                {conjuntos
                  .filter((c) => c.grupo === g)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.titulo} · {entero(c.filas)}
                    </SelectItem>
                  ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <nav className="hidden space-y-4 lg:block" aria-label="Conjuntos de datos">
        {GRUPOS.map((g) => (
          <div key={g}>
            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g}
            </p>
            <ul className="space-y-0.5">
              {conjuntos
                .filter((c) => c.grupo === g)
                .map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onElegir(c.id)}
                      aria-current={c.id === actual ? 'page' : undefined}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        c.id === actual
                          ? 'bg-accent font-medium text-accent-foreground'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <span className="truncate">{c.titulo}</span>
                      <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
                        {entero(c.filas)}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

// ---------------------------------------------------------------------------

/** Un `Select` corto (estado, rol, tipo de asistencia), con "Todos". */
function SelectCorto({
  id,
  etiqueta,
  todos,
  opciones,
  valor,
  onChange,
}: {
  id: string;
  etiqueta: string;
  todos: string;
  opciones: Opcion[];
  valor: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {etiqueta}
      </Label>
      <Select
        value={valor === undefined ? TODOS : String(valor)}
        onValueChange={(v) => onChange(v === TODOS ? undefined : Number(v))}
      >
        <SelectTrigger id={id} className="h-11 sm:h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>{todos}</SelectItem>
          {opciones.map((o) => (
            <SelectItem key={o.id} value={String(o.id)}>
              {o.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Un conjunto: filtros, tabla ordenable, paginación y exportación.
 *
 * Se monta con `key={conjunto.id}`, así que al cambiar de conjunto los filtros,
 * el orden y la página vuelven a cero sin tener que limpiarlos a mano.
 *
 * **Lo que se ve es lo que se exporta**: el Excel lleva los mismos filtros y el
 * mismo orden que la tabla, sin paginar, y una hoja que los deja escritos.
 */
function TablaConjunto({ conjunto }: { conjunto: ConjuntoDisponible }) {
  const [filtros, setFiltros] = useState<FiltrosHistorico>({});
  const [orden, setOrden] = useState<Orden>({ dir: 'asc' });
  const [page, setPage] = useState(1);

  const opciones = useOpcionesHistorico();
  const pagina = useConjuntoHistorico(conjunto.id, filtros, orden, page, POR_PAGINA);
  const exportar = useExportarHistorico();

  const admite = new Set(conjunto.filtros);
  const op = opciones.data;
  const total = pagina.data?.total ?? 0;
  const filas = pagina.data?.filas ?? [];
  const hayFiltros = Object.values(filtros).some((v) => v !== undefined && v !== '');

  const poner = <K extends keyof FiltrosHistorico>(clave: K, valor: FiltrosHistorico[K]) => {
    setFiltros((f) => ({ ...f, [clave]: valor === '' ? undefined : valor }));
    setPage(1);
  };

  /** Primer clic: ascendente. Segundo: descendente. Tercero: vuelve al orden de serie. */
  const ordenarPor = (clave: string) => {
    setOrden((o) =>
      o.orden !== clave
        ? { orden: clave, dir: 'asc' }
        : o.dir === 'asc'
          ? { orden: clave, dir: 'desc' }
          : { dir: 'asc' },
    );
    setPage(1);
  };

  /* En la asistencia de alumnos, "entrenador" filtra por quien registró la marca. */
  const etiquetaEntrenador =
    conjunto.id === 'asistencia-alumnos' ? 'Registrado por' : 'Entrenador';
  const sobre = conjunto.rangoSobre ? ` (${conjunto.rangoSobre})` : '';

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground">{conjunto.titulo}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{conjunto.descripcion}</p>
        </div>
        <ConditionalAction module="reportes" action="crear">
          <Button
            variant="brand"
            className="h-11 w-full flex-shrink-0 sm:h-10 sm:w-auto"
            disabled={exportar.isPending || total === 0}
            onClick={() => exportar.mutate({ id: conjunto.id, filtros, orden })}
          >
            {exportar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Exportar {hayFiltros ? 'lo filtrado' : 'todo'} a Excel
          </Button>
        </ConditionalAction>
      </div>

      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {admite.has('buscar') && (
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Buscar</Label>
            <DebouncedSearchInput
              placeholder="Escribe un nombre…"
              value={filtros.buscar ?? ''}
              onChange={(t) => poner('buscar', t)}
              className="w-full"
            />
          </div>
        )}
        {admite.has('colegio') && (
          <div className="space-y-1">
            <Label className="text-xs">Colegio</Label>
            <SelectorBuscable
              etiqueta="Colegio"
              todos="Todos los colegios"
              opciones={op?.colegios ?? []}
              valor={filtros.colegio}
              onChange={(v) => poner('colegio', v)}
            />
          </div>
        )}
        {admite.has('actividad') && (
          <div className="space-y-1">
            <Label className="text-xs">Actividad</Label>
            <SelectorBuscable
              etiqueta="Actividad"
              todos="Todas las actividades"
              opciones={op?.actividades ?? []}
              valor={filtros.actividad}
              onChange={(v) => poner('actividad', v)}
            />
          </div>
        )}
        {admite.has('entrenador') && (
          <div className="space-y-1">
            <Label className="text-xs">{etiquetaEntrenador}</Label>
            <SelectorBuscable
              etiqueta={etiquetaEntrenador}
              todos="Todos"
              opciones={op?.entrenadores ?? []}
              valor={filtros.entrenador}
              onChange={(v) => poner('entrenador', v)}
            />
          </div>
        )}
        {admite.has('rol') && (
          <SelectCorto
            id="h-rol"
            etiqueta="Rol"
            todos="Todos los roles"
            opciones={op?.roles ?? []}
            valor={filtros.rol}
            onChange={(v) => poner('rol', v)}
          />
        )}
        {admite.has('estado') && (
          <SelectCorto
            id="h-estado"
            etiqueta="Estado"
            todos="Todos los estados"
            opciones={conjunto.estados}
            valor={filtros.estado}
            onChange={(v) => poner('estado', v)}
          />
        )}
        {admite.has('asistencia') && (
          <SelectCorto
            id="h-asistencia"
            etiqueta="Asistencia"
            todos="Presente, ausente…"
            opciones={op?.asistencia ?? []}
            valor={filtros.asistencia}
            onChange={(v) => poner('asistencia', v)}
          />
        )}
        {admite.has('desde') && (
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div className="space-y-1">
              <Label htmlFor="h-desde" className="text-xs">
                Desde{sobre}
              </Label>
              <Input
                id="h-desde"
                type="date"
                value={filtros.desde ?? ''}
                max={filtros.hasta || undefined}
                onChange={(e) => poner('desde', e.target.value)}
                className="h-11 sm:h-10"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="h-hasta" className="text-xs">
                Hasta
              </Label>
              <Input
                id="h-hasta"
                type="date"
                value={filtros.hasta ?? ''}
                min={filtros.desde || undefined}
                onChange={(e) => poner('hasta', e.target.value)}
                className="h-11 sm:h-10"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          {pagina.isLoading
            ? 'Consultando…'
            : `${entero(total)} fila${total === 1 ? '' : 's'}${hayFiltros ? ` de ${entero(conjunto.filas)}` : ''}`}
        </span>
        {hayFiltros && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setFiltros({});
              setPage(1);
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Quitar filtros
          </Button>
        )}
        {orden.orden && (
          <Badge variant="secondary" className="gap-1">
            Ordenado por {conjunto.columnas.find((c) => c.clave === orden.orden)?.cabecera}
            {orden.dir === 'desc' ? ' (mayor a menor)' : ''}
          </Badge>
        )}
      </div>

      {pagina.isError && (
        <p className="py-8 text-center text-destructive">{(pagina.error as Error).message}</p>
      )}

      {!pagina.isLoading && !pagina.isError && filas.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <p className="text-lg">No hay filas con esos filtros</p>
        </div>
      )}

      {filas.length > 0 && (
        <>
          {/* Desborda en horizontal a propósito: un conjunto tiene las columnas que
              tiene, y en el teléfono se recorre deslizando. La cabecera se queda fija. */}
          <div
            className={cn(
              'max-h-[70vh] overflow-auto rounded-lg border',
              pagina.isFetching && 'opacity-60 transition-opacity',
            )}
          >
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr>
                  {conjunto.columnas.map((c) => {
                    const activa = orden.orden === c.clave;
                    const Icono = !activa ? ArrowUpDown : orden.dir === 'asc' ? ArrowUp : ArrowDown;
                    return (
                      <th
                        key={c.clave}
                        scope="col"
                        aria-sort={activa ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className={cn('whitespace-nowrap px-1 py-1 font-medium', c.numero ? 'text-right' : 'text-left')}
                      >
                        <button
                          type="button"
                          onClick={() => ordenarPor(c.clave)}
                          className={cn(
                            'inline-flex min-h-[36px] items-center gap-1 rounded px-2 hover:bg-background/60',
                            activa ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {c.cabecera}
                          <Icono className={cn('h-3.5 w-3.5', !activa && 'opacity-40')} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filas.map((fila, i) => (
                  <tr key={i} className="hover:bg-muted/40">
                    {conjunto.columnas.map((c) => {
                      const texto = celda(fila[c.clave], c);
                      return (
                        <td
                          key={c.clave}
                          title={texto.length > 30 ? texto : undefined}
                          className={cn(
                            'max-w-[18rem] truncate px-3 py-2',
                            c.numero && 'text-right tabular-nums',
                          )}
                        >
                          {texto || <span className="text-muted-foreground">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DataPagination
            currentPage={page}
            totalPages={pagina.data?.totalPages ?? 0}
            onPageChange={setPage}
            canGoNext={page < (pagina.data?.totalPages ?? 0)}
            canGoPrevious={page > 1}
            startIndex={(page - 1) * POR_PAGINA}
            endIndex={Math.min(page * POR_PAGINA, total)}
            totalItems={total}
            itemName="filas"
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface Props {
  conjuntoId: string;
  onElegir: (id: string) => void;
}

const ExploradorHistorico = ({ conjuntoId, onElegir }: Props) => {
  const conjuntos = useConjuntosHistorico();

  if (conjuntos.isLoading) {
    return <p className="py-12 text-center text-muted-foreground">Cargando…</p>;
  }
  if (conjuntos.isError) {
    return <p className="py-8 text-center text-destructive">{(conjuntos.error as Error).message}</p>;
  }

  const lista = conjuntos.data ?? [];
  const actual = lista.find((c) => c.id === conjuntoId) ?? lista[0];
  if (!actual) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <SelectorDeConjunto conjuntos={lista} actual={actual.id} onElegir={onElegir} />
      <TablaConjunto key={actual.id} conjunto={actual} />
    </div>
  );
};

export default ExploradorHistorico;
