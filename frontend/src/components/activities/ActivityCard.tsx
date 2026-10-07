import { CalendarDays, MapPin, Pencil, School, Shirt, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import MenuAcciones from '@/components/ui/menu-acciones';
import TarjetaDesplegable from '@/components/comun/TarjetaDesplegable';
import type { Actividad } from '@/api/actividades';

interface Props {
  actividad: Actividad;
  onEdit: (actividad: Actividad) => void;
  onDelete: (actividad: Actividad) => void;
}

/**
 * Una actividad: el nombre y su menú; el resto se despliega.
 *
 * El detalle es lo que antes ocupaba la tarjeta entera: para qué sirve, dónde
 * se hace, qué trae el alumno y en cuántas disciplinas y colegios se usa —el
 * número que decide si se puede borrar.
 */
const ActivityCard = ({ actividad, onEdit, onDelete }: Props) => {
  const materiales = actividad.act_materiales_alumno ?? [];
  const espacio = [actividad.act_espacio_trabajo, actividad.act_tipo_espacio].filter(Boolean).join(' · ');

  return (
    <TarjetaDesplegable
      id={`act-${actividad.act_id}`}
      titulo={actividad.act_nombre}
      color={actividad.act_color}
      subtitulo={`${actividad.disciplinas} disciplina${actividad.disciplinas === 1 ? '' : 's'}`}
      acciones={
        <MenuAcciones
          nombre={actividad.act_nombre}
          acciones={[
            {
              etiqueta: 'Editar',
              icono: Pencil,
              onSelect: () => onEdit(actividad),
              modulo: 'actividades',
              accion: 'editar',
            },
            {
              etiqueta: 'Eliminar',
              icono: Trash2,
              onSelect: () => onDelete(actividad),
              modulo: 'actividades',
              accion: 'eliminar',
              destructivo: true,
            },
          ]}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {actividad.cat_nombre ? (
          <Badge variant="secondary">{actividad.cat_nombre}</Badge>
        ) : (
          <Badge variant="outline">Sin categoría</Badge>
        )}
      </div>

      {actividad.act_descripcion && (
        <p className="break-words text-muted-foreground">{actividad.act_descripcion}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <strong>{actividad.disciplinas}</strong> disciplinas
        </span>
        <span className="flex items-center gap-1.5">
          <School className="h-4 w-4 text-muted-foreground" />
          <strong>{actividad.colegios}</strong> colegios
        </span>
      </div>

      {espacio && (
        <p className="flex items-start gap-1.5 text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span className="break-words">
            {espacio}
            {actividad.act_espacio_secundario && ` (alterno: ${actividad.act_espacio_secundario})`}
          </span>
        </p>
      )}

      {actividad.act_indumentaria_tipo && (
        <p className="flex items-start gap-1.5 text-muted-foreground">
          <Shirt className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span className="break-words">{actividad.act_indumentaria_tipo}</span>
        </p>
      )}

      {materiales.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            El alumno trae
          </p>
          <div className="flex flex-wrap gap-1">
            {materiales.map((m) => (
              <Badge key={m} variant="outline" className="max-w-full text-xs">
                <span className="truncate">{m}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </TarjetaDesplegable>
  );
};

export default ActivityCard;
