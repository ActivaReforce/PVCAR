import { useState } from 'react';
import { AlertTriangle, Clock, GraduationCap, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAsignarDisciplina, useDisciplinasDisponibles } from '@/hooks/useEntrenadores';
import type { DisciplinaDisponible, Entrenador } from '@/api/entrenadores';

interface Props {
  entrenador: Entrenador | null;
  onClose: () => void;
}

const hhmm = (hora: string | null) => hora?.slice(0, 5) ?? '--:--';

/**
 * Asignar disciplinas a un entrenador.
 *
 * Solo salen las disciplinas **activas** que caen dentro del alcance de quien
 * asigna y que ese entrenador no tiene ya. Las que ya da otro aparecen
 * marcadas con su nombre: asignarlas cierra la del otro y abre la nueva en la
 * misma transacción, que es lo que ocurre de verdad cuando alguien cambia de
 * entrenador a mitad de periodo. El sistema viejo ni lo comprobaba ni lo
 * decía: dejaba dos entrenadores activos sobre la misma disciplina.
 */
const AsignarDisciplinaModal = ({ entrenador, onClose }: Props) => {
  const [busqueda, setBusqueda] = useState('');
  const [aReemplazar, setAReemplazar] = useState<DisciplinaDisponible | null>(null);

  const disponibles = useDisciplinasDisponibles(entrenador?.ent_id ?? null);
  const asignar = useAsignarDisciplina();

  const lista = (disponibles.data ?? []).filter((d) => {
    if (!busqueda.trim()) return true;
    const texto = `${d.act_nombre} ${d.col_nombre} ${d.dia_nombre}`.toLowerCase();
    return texto.includes(busqueda.trim().toLowerCase());
  });

  const cerrar = () => {
    setBusqueda('');
    setAReemplazar(null);
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

  return (
    <Dialog open={Boolean(entrenador)} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Asignar disciplinas</DialogTitle>
          <DialogDescription className="break-words">
            A <strong>{entrenador?.usu_nombre}</strong>. Solo aparecen las disciplinas activas que
            todavía no tiene.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrar por actividad, colegio o día..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-11 pl-9 sm:h-10"
          />
        </div>

        {disponibles.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {disponibles.data && lista.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay disciplinas disponibles con ese filtro.
          </p>
        )}

        <ul className="space-y-2">
          {lista.map((d) => (
            <li
              key={d.colacthor_id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="break-words font-medium">{d.act_nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {d.col_nombre} · {d.dia_nombre.toLowerCase()}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {hhmm(d.colacthor_hora_inicio)}–{hhmm(d.colacthor_hora_fin)}
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

        {/* Confirmación del reemplazo: el modal no se cierra, así se pueden
            asignar varias disciplinas seguidas sin volver a abrirlo. */}
        <Dialog open={aReemplazar !== null} onOpenChange={(a) => !a && setAReemplazar(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Cambiar de entrenador
              </DialogTitle>
              <DialogDescription className="break-words">
                <strong>{aReemplazar?.act_nombre}</strong> ({aReemplazar?.col_nombre},{' '}
                {aReemplazar?.dia_nombre.toLowerCase()}) la da{' '}
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
      </DialogContent>
    </Dialog>
  );
};

export default AsignarDisciplinaModal;
