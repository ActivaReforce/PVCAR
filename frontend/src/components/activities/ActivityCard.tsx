import { CalendarDays, MapPin, Pencil, School, Shirt, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import MenuAcciones from '@/components/ui/menu-acciones';
import type { Actividad } from '@/api/actividades';

interface Props {
  actividad: Actividad;
  onEdit: (actividad: Actividad) => void;
  onDelete: (actividad: Actividad) => void;
}

/**
 * Tarjeta de una actividad.
 *
 * Enseña de una vez lo que la pantalla vieja repartía entre un "sobre" que
 * había que abrir, un modal de detalles y una tabla: para qué sirve, dónde se
 * hace, qué hay que traer y —lo que no estaba— en cuántas disciplinas y
 * colegios se usa. Ese número es el que decide si se puede borrar.
 */
const ActivityCard = ({ actividad, onEdit, onDelete }: Props) => {
  const materiales = actividad.act_materiales_alumno ?? [];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 break-words text-lg font-semibold leading-tight">
            {actividad.act_nombre}
          </h3>
          {actividad.cat_nombre ? (
            <Badge variant="secondary" className="flex-shrink-0">
              {actividad.cat_nombre}
            </Badge>
          ) : (
            <Badge variant="outline" className="flex-shrink-0">
              Sin categoría
            </Badge>
          )}

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
        </div>

        {actividad.act_descripcion && (
          <p className="text-sm text-muted-foreground break-words">{actividad.act_descripcion}</p>
        )}

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <strong>{actividad.disciplinas}</strong> disciplinas
          </span>
          <span className="flex items-center gap-1.5">
            <School className="h-4 w-4 text-muted-foreground" />
            <strong>{actividad.colegios}</strong> colegios
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 pt-0 text-sm">
        {(actividad.act_espacio_trabajo || actividad.act_tipo_espacio) && (
          <p className="flex items-start gap-1.5 text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span className="break-words">
              {[actividad.act_espacio_trabajo, actividad.act_tipo_espacio]
                .filter(Boolean)
                .join(' · ')}
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

      </CardContent>
    </Card>
  );
};

export default ActivityCard;
