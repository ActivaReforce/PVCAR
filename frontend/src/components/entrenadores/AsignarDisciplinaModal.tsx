import { useState } from 'react';
import { AlertTriangle, Clock, GraduationCap, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAsignarDisciplina,
  useCerrarAsignacion,
  useDisciplinasDisponibles,
  useFichaEntrenador,
} from '@/hooks/useEntrenadores';
import type { Asignacion, DisciplinaDisponible, Entrenador } from '@/api/entrenadores';

interface Props {
  entrenador: Entrenador | null;
  onClose: () => void;
}

/**
 * Asignar y quitar disciplinas a un entrenador.
 *
 * Dos secciones (pedido del cliente, 2026-10-15):
 *   1. Lo que ya tiene, con botón "Quitar" y confirmación — quitarlas desde
 *      la ficha mezclaba lectura y acción; aquí está todo junto.
 *   2. Lo que podría asignarse: buscador + filtros + lista agrupada por
 *      colegio, marcada con "La da X" para los reemplazos.
 *
 * Las que ya da otro aparecen marcadas con su nombre: asignarlas cierra la
 * del otro y abre la nueva en la misma transacción. El sistema viejo dejaba
 * dos entrenadores activos sobre la misma disciplina sin avisar.
 */
const TODOS = 'todos';

const AsignarDisciplinaModal = ({ entrenador, onClose }: Props) => {
  const [busqueda, setBusqueda] = useState('');
  const [colegio, setColegio] = useState(TODOS);
  const [dia, setDia] = useState(TODOS);
  const [soloLibres, setSoloLibres] = useState(true);
  const [aReemplazar, setAReemplazar] = useState<DisciplinaDisponible | null>(null);
  const [aQuitar, setAQuitar] = useState<Asignacion | null>(null);

  const abierto = Boolean(entrenador);
  const ficha = useFichaEntrenador(entrenador?.ent_id ?? null, false);
  const disponibles = useDisciplinasDisponibles(entrenador?.ent_id ?? null);
  const asignar = useAsignarDisciplina();
  const cerrar = useCerrarAsignacion();

  const asignaciones = ficha.data?.asignaciones ?? [];
  const activasPorColegio = new Map<string, Asignacion[]>();
  for (const a of asignaciones) {
    activasPorColegio.set(a.col_nombre, [...(activasPorColegio.get(a.col_nombre) ?? []), a]);
  }
  const variosColegiosYa = activasPorColegio.size > 1;

  const todas = disponibles.data ?? [];
  const colegios = [...new Map(todas.map((d) => [d.col_id, d.col_nombre])).entries()].sort(
    ([, a], [, b]) => a.localeCompare(b, 'es'),
  );
  const dias = [
    ...new Map(todas.flatMap((d) => d.horarios.map((h) => [h.dia_id, h.dia_nombre] as const))).entries(),
  ].sort(([a], [b]) => a - b);
  const libres = todas.filter((d) => !d.entrenador_actual).length;

  const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const lista = todas.filter((d) => {
    if (soloLibres && d.entrenador_actual) return false;
    if (colegio !== TODOS && d.col_id !== Number(colegio)) return false;
    if (dia !== TODOS && !d.horarios.some((h) => h.dia_id === Number(dia))) return false;
    if (!busqueda.trim()) return true;
    const diasTexto = d.horarios.map((h) => h.dia_nombre).join(' ');
    return sinTildes(`${d.act_nombre} ${d.col_nombre} ${diasTexto}`).includes(
      sinTildes(busqueda.trim()),
    );
  });

  const porColegio = new Map<string, DisciplinaDisponible[]>();
  for (const d of lista) porColegio.set(d.col_nombre, [...(porColegio.get(d.col_nombre) ?? []), d]);
  const secciones = [...porColegio.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));

  const cerrarTodo = () => {
    setBusqueda('');
    setColegio(TODOS);
    setDia(TODOS);
    setSoloLibres(true);
    setAReemplazar(null);
    setAQuitar(null);
    onClose();
  };

  const pedirAsignacion = async (d: DisciplinaDisponible, reemplazar: boolean) => {
    if (!entrenador) return;
    if (d.entrenador_actual && !reemplazar) {
      setAReemplazar(d);
      return;
    }
    try {
      await asignar.mutateAsync({
        id: entrenador.ent_id,
        colacthorId: d.colacthor_id,
        reemplazar,
      });
      setAReemplazar(null);
    } catch {
      // El hook ya muestra el motivo.
    }
  };

  const confirmarQuitar = async () => {
    if (!entrenador || !aQuitar) return;
    try {
      await cerrar.mutateAsync({ id: entrenador.ent_id, entasigId: aQuitar.entasig_id });
      setAQuitar(null);
    } catch {
      // El hook ya enseña el toast.
    }
  };

  const filaAsignada = (a: Asignacion) => (
    <li
      key={a.entasig_id}
      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="break-words font-medium">{a.act_nombre}</p>
        {!variosColegiosYa && <p className="text-sm text-muted-foreground">{a.col_nombre}</p>}
        <p className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {a.horario_texto}
          </span>
          <span className="flex items-center gap-1">
            <GraduationCap className="h-3 w-3" />
            {a.alumnos} alumnos
          </span>
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11 w-full flex-shrink-0 text-destructive hover:text-destructive sm:w-auto"
        disabled={cerrar.isPending}
        onClick={() => setAQuitar(a)}
      >
        <X className="mr-2 h-4 w-4" />
        Quitar
      </Button>
    </li>
  );

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && cerrarTodo()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Asignar disciplinas</DialogTitle>
          <DialogDescription className="break-words">
            A <strong>{entrenador?.usu_nombre}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* 1. Las que ya tiene (2026-10-15) */}
        <section className="space-y-2">
          <h3 className="font-semibold">
            Disciplinas asignadas
            {asignaciones.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · {asignaciones.length}
              </span>
            )}
          </h3>
          {ficha.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : asignaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no tiene ninguna.</p>
          ) : variosColegiosYa ? (
            <div className="space-y-3">
              {[...activasPorColegio.entries()].map(([col, laLista]) => (
                <div key={col} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {col} · {laLista.length}
                  </p>
                  <ul className="space-y-2">{laLista.map(filaAsignada)}</ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-2">{asignaciones.map(filaAsignada)}</ul>
          )}
          <p className="text-xs text-muted-foreground">
            Quitar cierra la asignación con la fecha de hoy; las asistencias que registró se
            quedan a su nombre.
          </p>
        </section>

        <div className="h-px bg-border" />

        {/* 2. Las que puede asignarse */}
        <section className="space-y-3">
          <h3 className="font-semibold">Añadir disciplina</h3>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrar por actividad, colegio o día..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="h-11 pl-9 sm:h-10"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select value={colegio} onValueChange={setColegio}>
              <SelectTrigger className="h-11 sm:h-10" aria-label="Colegio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los colegios</SelectItem>
                {colegios.map(([id, nombre]) => (
                  <SelectItem key={id} value={String(id)}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dia} onValueChange={setDia}>
              <SelectTrigger className="h-11 sm:h-10" aria-label="Día">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los días</SelectItem>
                {dias.map(([id, nombre]) => (
                  <SelectItem key={id} value={String(id)}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={soloLibres ? 'libres' : 'todas'}
              onValueChange={(v) => setSoloLibres(v === 'libres')}
            >
              <SelectTrigger className="h-11 sm:h-10" aria-label="Cuáles">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="libres">Sin entrenador ({libres})</SelectItem>
                <SelectItem value="todas">Todas ({todas.length})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {disponibles.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

          {disponibles.data && lista.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay disciplinas disponibles con ese filtro.
            </p>
          )}

          <div className="space-y-4">
            {secciones.map(([nombreColegio, delColegio]) => (
              <section key={nombreColegio} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {nombreColegio} · {delColegio.length}
                </p>
                <ul className="space-y-2">
                  {delColegio.map((d) => (
                    <li
                      key={d.colacthor_id}
                      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-medium">{d.act_nombre}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {d.horario_texto}
                          </span>
                          <span className="flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />
                            {d.alumnos} alumnos
                          </span>
                        </p>
                        {d.entrenador_actual && (
                          <Badge variant="outline" className="mt-1.5 max-w-full text-xs">
                            <span className="truncate">La da {d.entrenador_actual}</span>
                          </Badge>
                        )}
                      </div>

                      <Button
                        variant={d.entrenador_actual ? 'outline' : 'brand'}
                        size="sm"
                        className="min-h-11 w-full flex-shrink-0 sm:w-auto"
                        disabled={asignar.isPending}
                        onClick={() => pedirAsignacion(d, false)}
                      >
                        {d.entrenador_actual ? 'Reemplazar' : 'Asignar'}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        {/* Confirmación del reemplazo */}
        <Dialog open={aReemplazar !== null} onOpenChange={(a) => !a && setAReemplazar(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Cambiar de entrenador
              </DialogTitle>
              <DialogDescription className="break-words">
                <strong>{aReemplazar?.act_nombre}</strong> ({aReemplazar?.col_nombre},{' '}
                {aReemplazar?.horario_texto}) la da{' '}
                <strong>{aReemplazar?.entrenador_actual}</strong>. Se cerrará su asignación con la
                fecha de hoy y se abrirá la de {entrenador?.usu_nombre}. El historial de
                asistencias no se toca.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setAReemplazar(null)}>
                Cancelar
              </Button>
              <Button
                variant="brand"
                disabled={asignar.isPending}
                onClick={() => aReemplazar && pedirAsignacion(aReemplazar, true)}
              >
                {asignar.isPending ? 'Cambiando…' : 'Cambiar entrenador'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirmación al quitar (2026-10-15). */}
        <AlertDialog open={aQuitar !== null} onOpenChange={(a) => !a && setAQuitar(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Quitar {aQuitar?.act_nombre}?</AlertDialogTitle>
              <AlertDialogDescription>
                Se cierra la asignación con la fecha de hoy. {aQuitar?.col_nombre}
                {aQuitar?.horario_texto ? ` · ${aQuitar.horario_texto}` : ''}. Las asistencias
                que registró siguen a su nombre y la disciplina queda sin entrenador hasta que
                se asigne otro.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cerrar.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmarQuitar}
                disabled={cerrar.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {cerrar.isPending ? 'Quitando…' : 'Quitar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};

export default AsignarDisciplinaModal;
