import { useEffect, useMemo, useState } from 'react';
import { Search, UserRoundPlus, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import {
  useActualizarSector,
  useAlumnosDisponibles,
  useFichaRepresentante,
  useGuardarHijos,
  useRepresentantes,
} from '@/hooks/useEncuestas';
import { iniciales } from '@/components/evaluaciones/metodos';
import type { Representante } from '@/api/representantes';

const TODOS = 'todos';

/**
 * Representantes.
 *
 * La pantalla que **no existía**. Los representantes se ataban desde la ficha
 * de cada alumno, uno a uno, y no había dónde ver quiénes son ni de qué niños
 * responden. Sin eso, las encuestas no tienen a quién preguntar.
 *
 * Aquí **no se dan de alta**: un representante es un usuario con el rol 4, y su
 * ficha la crea Usuarios al concederle el rol. Esta pantalla ve y ata.
 *
 * Hoy en producción hay **cero**, así que se estrena vacía y lo dice con el
 * camino para empezar en vez de con una tabla en blanco.
 */
const Representantes = () => {
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('1');
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const lista = useRepresentantes({
    buscar: busqueda || undefined,
    estado: estado === TODOS ? undefined : Number(estado),
  });

  const representantes = lista.data?.representantes ?? [];
  const conteos = lista.data?.conteos;

  if (lista.isLoading && !lista.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Cargando representantes...</div>
      </div>
    );
  }

  if (lista.isError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">
          No se pudieron cargar los representantes: {(lista.error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-w-0 max-w-5xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Representantes</h1>
        {conteos && (
          <p className="mt-1 text-sm text-muted-foreground">
            {conteos.total} representantes · {conteos.activos} activos
            {conteos.sinHijos > 0 && (
              <>
                {' · '}
                <span className="text-amber-700 dark:text-amber-400">
                  {conteos.sinHijos} sin representados
                </span>
              </>
            )}
            {conteos.sinFicha > 0 && (
              <>
                {' · '}
                <span className="text-destructive">{conteos.sinFicha} sin ficha</span>
              </>
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DebouncedSearchInput
          placeholder="Buscar por nombre o correo..."
          value={busqueda}
          onChange={setBusqueda}
          className="w-full sm:col-span-2"
        />
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="h-11 sm:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Activos</SelectItem>
            <SelectItem value="2">Inactivos</SelectItem>
            <SelectItem value={TODOS}>Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {representantes.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <Users className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="text-lg">Todavía no hay representantes</p>
          <p className="mx-auto mt-2 max-w-md text-sm">
            Se dan de alta desde <strong>Usuarios</strong>, creando la persona con el rol
            <strong> Representante</strong>. Después, aquí se le atan sus representados.
          </p>
        </div>
      )}

      {representantes.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-lg border">
          {representantes.map((r) => (
            <li
              key={r.usu_id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={r.usu_foto_url ?? undefined} alt="" />
                  <AvatarFallback>{iniciales(r.usu_nombre)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-medium" title={r.usu_nombre}>
                    {r.usu_nombre}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {r.usu_correo}
                    {r.padre_sector_residencia && ` · ${r.padre_sector_residencia}`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:flex-shrink-0">
                {r.padre_id === null ? (
                  <Badge variant="destructive">Sin ficha</Badge>
                ) : r.hijos === 0 ? (
                  <Badge variant="secondary">Sin representados</Badge>
                ) : (
                  <Badge variant="default">
                    {r.hijos} representado{r.hijos === 1 ? '' : 's'}
                  </Badge>
                )}

                {r.encuestasRespondidas > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {r.encuestasRespondidas} encuesta{r.encuestasRespondidas === 1 ? '' : 's'}
                  </span>
                )}

                <ConditionalAction module="estudiantes" action="editar">
                  <Button
                    variant="outline"
                    className="h-11 flex-1 sm:h-9 sm:flex-none"
                    onClick={() => setEditandoId(r.usu_id)}
                  >
                    <UserRoundPlus className="mr-2 h-4 w-4" />
                    Representados
                  </Button>
                </ConditionalAction>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DialogoRepresentados usuId={editandoId} onClose={() => setEditandoId(null)} />
    </div>
  );
};

/**
 * Los representados de una persona.
 *
 * Llega la lista completa que debe tener y el backend calcula la diferencia,
 * igual que las inscripciones de un alumno. Y solo toca lo que quien guarda
 * puede ver: un coordinador no suelta sin querer a los hijos de otro colegio.
 */
const DialogoRepresentados = ({
  usuId,
  onClose,
}: {
  usuId: number | null;
  onClose: () => void;
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [sector, setSector] = useState('');

  const ficha = useFichaRepresentante(usuId);
  const disponibles = useAlumnosDisponibles(usuId, busqueda);
  const guardar = useGuardarHijos();
  const guardarSector = useActualizarSector();

  useEffect(() => {
    if (!ficha.data) return;
    setElegidos(new Set(ficha.data.hijos.map((h) => h.nino_id)));
    setSector(ficha.data.representante.padre_sector_residencia ?? '');
  }, [ficha.data]);

  /** Los ya atados salen siempre, aunque la búsqueda no los alcance. */
  const filas = useMemo(() => {
    const atados = (ficha.data?.hijos ?? []).map((h) => ({
      nino_id: h.nino_id,
      nino_nombre: h.nino_nombre,
      col_nombre: h.col_nombre,
      catninograd_nombre: h.catninograd_nombre,
      representantes: 0,
      atado: true,
    }));
    const libres = (disponibles.data ?? []).map((d) => ({ ...d, atado: false }));
    return [...atados, ...libres];
  }, [ficha.data, disponibles.data]);

  const alternar = (ninoId: number) => {
    setElegidos((previos) => {
      const siguiente = new Set(previos);
      if (siguiente.has(ninoId)) siguiente.delete(ninoId);
      else siguiente.add(ninoId);
      return siguiente;
    });
  };

  const nombre = ficha.data?.representante.usu_nombre ?? '';

  return (
    <Dialog open={usuId !== null} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="break-words text-lg sm:text-xl">
            Representados de {nombre}
          </DialogTitle>
          <DialogDescription>
            Marca los alumnos de los que responde. Solo salen los de tu alcance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="sector">Sector de residencia</Label>
          <Input
            id="sector"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="Calderón, Los Chillos…"
            className="h-11 sm:h-10"
          />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar alumno…"
            className="h-11 pl-10 sm:h-10"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {ficha.isLoading && (
            <p className="py-8 text-center text-muted-foreground">Cargando…</p>
          )}

          {filas.length === 0 && !ficha.isLoading && (
            <p className="py-8 text-center text-muted-foreground">
              No hay alumnos dentro de tu alcance.
            </p>
          )}

          <ul className="divide-y">
            {filas.map((f) => (
              <li key={f.nino_id} className="flex items-start gap-3 py-3">
                <Checkbox
                  id={`nino-${f.nino_id}`}
                  checked={elegidos.has(f.nino_id)}
                  onCheckedChange={() => alternar(f.nino_id)}
                  className="mt-1"
                />
                <label htmlFor={`nino-${f.nino_id}`} className="min-w-0 flex-1 cursor-pointer">
                  <div className="truncate font-medium">{f.nino_nombre}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {f.col_nombre}
                    {f.catninograd_nombre && ` · ${f.catninograd_nombre}`}
                    {!f.atado && f.representantes > 0 && ` · ya tiene ${f.representantes}`}
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" className="h-11 sm:h-10" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="brand"
            className="h-11 sm:h-10"
            disabled={usuId === null || guardar.isPending || guardarSector.isPending}
            onClick={async () => {
              if (usuId === null) return;
              try {
                if (sector.trim() !== (ficha.data?.representante.padre_sector_residencia ?? '')) {
                  await guardarSector.mutateAsync({ usuId, sector: sector.trim() });
                }
                await guardar.mutateAsync({ usuId, ninoIds: [...elegidos] });
                onClose();
              } catch {
                // El hook ya enseña el motivo.
              }
            }}
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Representantes;
