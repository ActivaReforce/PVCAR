
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Eye } from "lucide-react";
import { ConditionalAction } from "@/components/ui/conditional-actions";

interface Categoria {
  cat_id: number;
  cat_nombre: string;
  cat_descripcion?: string | null;
}

interface Actividad {
  act_id: number;
  act_nombre: string;
  act_descripcion?: string | null;
  act_materiales_alumno?: string[] | null;
  act_indumentaria_tipo?: string | null;
  act_espacio_trabajo?: string | null;
  act_tipo_espacio?: string | null;
  act_espacio_secundario?: string | null;
  cat_id?: number | null;
  act_fecha_creacion: string;
  act_fecha_modificacion: string;
  categoria?: Categoria | null;
}

interface AllActivitiesViewProps {
  actividades: Actividad[];
  onView: (actividad: Actividad) => void;
  onEdit: (actividad: Actividad) => void;
  onDelete: (actividad: Actividad) => void;
}

const AllActivitiesView = ({
  actividades,
  onView,
  onEdit,
  onDelete
}: AllActivitiesViewProps) => {
  const getCategoryColor = (categoriaId?: number | null) => {
    if (!categoriaId) return "bg-gray-100 text-gray-800";
    
    const colors = [
      "bg-blue-100 text-blue-800",
      "bg-green-100 text-green-800",
      "bg-purple-100 text-purple-800",
      "bg-orange-100 text-orange-800",
      "bg-pink-100 text-pink-800",
      "bg-indigo-100 text-indigo-800"
    ];
    
    return colors[categoriaId % colors.length];
  };

  if (actividades.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No se encontraron actividades</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {actividades.map((actividad) => (
        <Card key={actividad.act_id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* Header with category badge */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-base mb-1">{actividad.act_nombre}</h3>
                  {actividad.categoria && (
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getCategoryColor(actividad.cat_id)}`}
                    >
                      {actividad.categoria.cat_nombre}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Activity details */}
              <div className="space-y-2 text-sm">
                {actividad.act_descripcion && (
                  <p className="text-muted-foreground line-clamp-2">
                    {actividad.act_descripcion}
                  </p>
                )}
                
                {actividad.act_espacio_trabajo && (
                  <div>
                    <span className="font-medium text-muted-foreground">Espacio:</span>
                    <p className="text-sm">{actividad.act_espacio_trabajo}</p>
                  </div>
                )}
                
                {actividad.act_indumentaria_tipo && (
                  <div>
                    <span className="font-medium text-muted-foreground">Uniforme:</span>
                    <p className="text-sm">{actividad.act_indumentaria_tipo}</p>
                  </div>
                )}
                
                {actividad.act_materiales_alumno && actividad.act_materiales_alumno.length > 0 && (
                  <div>
                    <span className="font-medium text-muted-foreground">Materiales:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {actividad.act_materiales_alumno.slice(0, 3).map((material, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {material}
                        </Badge>
                      ))}
                      {actividad.act_materiales_alumno.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{actividad.act_materiales_alumno.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-1 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onView(actividad)}
                  title="Ver detalles"
                  className="flex-1"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver
                </Button>
                <ConditionalAction module="actividades" action="editar">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(actividad)}
                    title="Editar"
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                </ConditionalAction>
                <ConditionalAction module="actividades" action="eliminar">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(actividad)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </ConditionalAction>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AllActivitiesView;
