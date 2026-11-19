import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { useAlumnosNuevos, useDisciplinasDeNuevos } from '@/hooks/useInscripciones';
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
  const [disciplina, setDisciplina] = useState(TODOS);
  const [pagina, setPagina] = useState(1);

  // Colegios y disciplinas salen de su alcance (las de sus colegios).
  const disciplinas = useDisciplinasDeNuevos();
  const todas = disciplinas.data ?? [];
  const opcionesColegio = [...new Map(todas.map((d) => [d.col_id, d.col_nombre] as const)).entries()]
    .map(([col_id, col_nombre]) => ({ col_id, col_nombre }))
    .sort((a, b) => a.col_nombre.localeCompare(b.col_nombre, 'es'));
  const opcionesDisciplina = todas.filter((d) => colegio === TODOS || d.col_id === Number(colegio));
  const grupos = [...new Set(opcionesDisciplina.map((d) => d.col_nombre))].map((nombre) => ({
    nombre,
    items: opcionesDisciplina.filter((d) => d.col_nombre === nombre),
  }));

  const lista = useAlumnosNuevos({
    buscar: busqueda || undefined,
    colegio: colegio === TODOS ? undefined : Number(colegio),
    disciplina: disciplina === TODOS ? undefined : Number(disciplina),
    page: pagina,
  });
  const datos = lista.data;
  const items = datos?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DebouncedSearchInput
          placeholder="Buscar por alumno o representante..."
          value={busqueda}
          onChange={(v) => {
            setBusqueda(v);
            setPagina(1);
          }}
          className="w-full sm:col-span-2"
        />
        <Select
          value={disciplina}
          onValueChange={(v) => {
            setDisciplina(v);
            setPagina(1);
          }}
        >
          <SelectTrigger className="h-11 sm:h-10" aria-label="Disciplina">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las disciplinas</SelectItem>
            {grupos.map((g) => (
              <SelectGroup key={g.nombre}>
                {grupos.length > 1 && <SelectLabel>{g.nombre}</SelectLabel>}
                {g.items.map((d) => (
                  <SelectItem key={d.colacthor_id} value={String(d.colacthor_id)}>
                    {d.act_nombre}
                    {d.horario_texto ? ` · ${d.horario_texto}` : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        {opcionesColegio.length > 1 && (
          <Select
            value={colegio}
            onValueChange={(v) => {
              setColegio(v);
              setDisciplina(TODOS);
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
            {busqueda || colegio !== TODOS || disciplina !== TODOS
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

      {datos && items.length > 0 && (
        <DataPagination
          currentPage={datos.page}
          totalPages={datos.totalPages}
          onPageChange={setPagina}
          canGoNext={datos.page < datos.totalPages}
          canGoPrevious={datos.page > 1}
          startIndex={(datos.page - 1) * datos.limit}
          endIndex={Math.min(datos.page * datos.limit, datos.total)}
          totalItems={datos.total}
          itemName="alumnos"
        />
      )}
    </div>
  );
};

export default AlumnosNuevos;
