import {
  CalendarDays,
  GraduationCap,
  Pencil,
  RotateCcw,
  School,
  Trash2,
  UserCog,
  UserX,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import MenuAcciones from '@/components/ui/menu-acciones';
import TarjetaDesplegable from '@/components/comun/TarjetaDesplegable';
import AsignarEntrenadorRapido from './AsignarEntrenadorRapido';
import { usePermissions } from '@/hooks/usePermissions';
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
 * Una disciplina dentro de su colegio y su día.
 *
 * A la vista, solo la actividad y la hora con su menú; el resto se despliega.
 * **Sin entrenador** lleva borde ámbar fuerte —es lo primero que hay que
 * resolver cada periodo— y, para quien puede asignar, el selector para
 * resolverlo ahí mismo.
 */
const DisciplinaCard = ({ disciplina, onEdit, onBaja, onReactivar, onEliminar }: Props) => {
  const { canEdit } = usePermissions();
  const activa = disciplina.est_id === 1;
  const sinEntrenador = activa && disciplina.entrenadores.length === 0;
  const horario = `${hhmm(disciplina.colacthor_hora_inicio)} – ${hhmm(disciplina.colacthor_hora_fin)}`;

  return (
    <TarjetaDesplegable
      id={`disc-${disciplina.colacthor_id}`}
      titulo={disciplina.act_nombre}
      subtitulo={horario}
      aviso={sinEntrenador}
      apagada={!activa}
      etiqueta={
        !activa ? (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            De baja
          </Badge>
        ) : undefined
      }
      acciones={
        <MenuAcciones
          nombre={disciplina.act_nombre}
          acciones={[
            {
              etiqueta: 'Editar',
              icono: Pencil,
              onSelect: () => onEdit(disciplina),
              modulo: 'disciplinas',
              accion: 'editar',
            },
            {
              etiqueta: 'Reactivar',
              icono: RotateCcw,
              onSelect: () => onReactivar(disciplina),
              modulo: 'disciplinas',
              accion: 'editar',
              visible: !activa,
            },
            {
              etiqueta: 'Dar de baja',
              icono: UserX,
              onSelect: () => onBaja(disciplina),
              modulo: 'disciplinas',
              accion: 'editar',
              destructivo: true,
              visible: activa,
            },
            {
              etiqueta: 'Eliminar',
              icono: Trash2,
              onSelect: () => onEliminar(disciplina),
              modulo: 'disciplinas',
              accion: 'eliminar',
              destructivo: true,
              visible: !activa,
            },
          ]}
        />
      }
    >
      <p className="flex items-center gap-1.5">
        <School className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="break-words">{disciplina.col_nombre}</span>
      </p>
      <p className="flex items-center gap-1.5">
        <CalendarDays className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        {disciplina.dia_nombre} · {horario}
      </p>
      <p className="flex items-start gap-1.5">
        <UserCog className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
        {disciplina.entrenadores.length > 0 ? (
          <span className="break-words">
            {disciplina.entrenadores.map((e) => e.usu_nombre).join(', ')}
          </span>
        ) : (
          <span className="font-medium text-amber-700 dark:text-amber-400">Sin entrenador</span>
        )}
      </p>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <GraduationCap className="h-4 w-4 flex-shrink-0" />
        {disciplina.alumnos} alumnos
        {disciplina.evaluaciones > 0 && ` · ${disciplina.evaluaciones} evaluaciones`}
      </p>

      {sinEntrenador && canEdit('entrenadores') && (
        <AsignarEntrenadorRapido disciplina={disciplina} />
      )}
    </TarjetaDesplegable>
  );
};

export default DisciplinaCard;
