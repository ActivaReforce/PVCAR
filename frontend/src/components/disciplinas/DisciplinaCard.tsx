import { Clock, GraduationCap, Pencil, RotateCcw, School, Trash2, UserCog, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import type { Disciplina } from '@/api/disciplinas';

interface Props {
  disciplina: Disciplina;
  onEdit: (d: Disciplina) => void;
  onBaja: (d: Disciplina) => void;
  onReactivar: (d: Disciplina) => void;
  onEliminar: (d: Disciplina) => void;
}

/** 15:00:00 → 15:00. La hora viene de Postgres con segundos. */
const hhmm = (hora: string | null) => hora?.slice(0, 5) ?? '--:--';

/**
 * Una disciplina dentro del calendario.
 *
 * Enseña lo que hay que saber de un vistazo: actividad, colegio, franja,
 * quién la da y cuántos alumnos tiene. "Sin entrenador" se ve como aviso, no
 * como un hueco en blanco: son 14 de las 94 en los datos reales y es lo
 * primero que hay que resolver cada periodo.
 */
const DisciplinaCard = ({ disciplina, onEdit, onBaja, onReactivar, onEliminar }: Props) => {
  const activa = disciplina.est_id === 1;
  const entrenadores = disciplina.entrenadores;

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 ${
        activa ? 'bg-card' : 'border-dashed bg-muted/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words font-medium leading-tight">{disciplina.act_nombre}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <School className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{disciplina.col_nombre}</span>
          </p>
        </div>
        {!activa && (
          <Badge variant="secondary" className="flex-shrink-0 text-xs">
            De baja
          </Badge>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-sm">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        {hhmm(disciplina.colacthor_hora_inicio)} – {hhmm(disciplina.colacthor_hora_fin)}
      </p>

      <p className="flex items-start gap-1.5 text-sm">
        <UserCog className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        {entrenadores.length > 0 ? (
          <span className="break-words">{entrenadores.map((e) => e.usu_nombre).join(', ')}</span>
        ) : (
          <span className="text-amber-700 dark:text-amber-400">Sin entrenador</span>
        )}
      </p>

      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <GraduationCap className="h-3.5 w-3.5" />
        {disciplina.alumnos} alumnos
        {disciplina.evaluaciones > 0 && ` · ${disciplina.evaluaciones} evaluaciones`}
      </p>

      {/* Las acciones caben en una fila en escritorio y envuelven en móvil. */}
      <div className="mt-1 flex flex-wrap gap-1">
        <ConditionalAction module="disciplinas" action="editar">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 md:h-9 md:w-9"
            onClick={() => onEdit(disciplina)}
            title="Editar"
            aria-label={`Editar ${disciplina.act_nombre}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </ConditionalAction>

        {activa ? (
          <ConditionalAction module="disciplinas" action="editar">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-destructive hover:text-destructive md:h-9 md:w-9"
              onClick={() => onBaja(disciplina)}
              title="Dar de baja"
              aria-label={`Dar de baja ${disciplina.act_nombre}`}
            >
              <UserX className="h-4 w-4" />
            </Button>
          </ConditionalAction>
        ) : (
          <>
            <ConditionalAction module="disciplinas" action="editar">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 md:h-9 md:w-9"
                onClick={() => onReactivar(disciplina)}
                title="Reactivar"
                aria-label={`Reactivar ${disciplina.act_nombre}`}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </ConditionalAction>
            <ConditionalAction module="disciplinas" action="eliminar">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-destructive hover:text-destructive md:h-9 md:w-9"
                onClick={() => onEliminar(disciplina)}
                title="Eliminar permanentemente"
                aria-label={`Eliminar ${disciplina.act_nombre}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </ConditionalAction>
          </>
        )}
      </div>
    </div>
  );
};

export default DisciplinaCard;
