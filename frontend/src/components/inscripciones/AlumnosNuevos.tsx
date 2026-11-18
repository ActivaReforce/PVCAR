import { useState } from 'react';
import { ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import { useAlumnosNuevos } from '@/hooks/useInscripciones';
import { useColegiosVisibles } from '@/hooks/useColegios';
import { fechaCorta } from './formato';

const TODOS = 'todos';

/**
 * Inscripciones para el coordinador (cliente, 2026-11-18): solo ver quién
 * entró nuevo en sus colegios. Una fila por alumno de las inscripciones
 * aprobadas, con solo las disciplinas de su alcance. Sin montos, comprobantes,
 * documentos, Mensualidades ni Configuración: eso es del Propietario.
 */
const AlumnosNuevos = () => {
  const [busqueda, setBusqueda] = useState('');
  const [colegio, setColegio] = useState(TODOS);
  const [pagina, setPagina] = useState(1);

  const colegios = useColegiosVisibles();
  const lista = useAlumnosNuevos({
    buscar: busqueda || undefined,
    colegio: colegio === TODOS ? undefined : Number(colegio),
    page: pagina,
  });
  const datos = lista.data;
  const items = datos?.items ?? [];
  const opcionesColegio = colegios.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DebouncedSearchInput
          placeholder="Buscar por alumno o representante..."
          value={busqueda}
          onChange={(v) => {
            setBusqueda(v);
            setPagina(1);
          }}
          className="w-full lg:col-span-2"
        />
        {opcionesColegio.length > 1 && (
          <Select
            value={colegio}
            onValueChange={(v) => {
              setColegio(v);
              setPagina(1);
            }}
          >
            <SelectTrigger className="h-11 sm:h-10" aria-label="Colegio">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los colegios</SelectItem>
              {opcionesColegio.map((c) => (
                <SelectItem key={c.col_id} value={String(c.col_id)}>
                  {c.col_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {lista.isLoading && !datos && <p className="py-8 text-center text-muted-foreground">Cargando…</p>}
      {lista.isError && (
        <p className="text-destructive">No se pudieron cargar: {(lista.error as Error).message}</p>
      )}

      {datos && items.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <UserPlus className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="text-lg">
            {busqueda || colegio !== TODOS
              ? 'Nadie con ese filtro'
              : 'Aún no hay alumnos inscritos en tus disciplinas'}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-lg border">
          {items.map((a) => (
            <li key={a.insnino_id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium" title={a.alumno}>
                  {a.alumno}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {[a.curso, a.colegio].filter(Boolean).join(' · ')}
                </div>
                <div className="text-sm text-muted-foreground">{a.disciplinas.join(' · ')}</div>
                <div className="truncate text-xs text-muted-foreground">
                  Representante: {a.representante}
                  {a.telefono && ` · ${a.telefono}`}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:justify-end">
                {!a.activo && <Badge variant="outline">Ya no está activo</Badge>}
                {a.fecha_aprobacion && (
                  <span className="text-xs text-muted-foreground">Entró el {fechaCorta(a.fecha_aprobacion)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {datos && datos.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Página {datos.page} de {datos.totalPages} · {datos.total} en total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              disabled={datos.page <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Página siguiente"
              disabled={datos.page >= datos.totalPages}
              onClick={() => setPagina((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlumnosNuevos;
