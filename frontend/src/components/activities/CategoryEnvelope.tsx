
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Edit, Trash2, Eye } from "lucide-react";

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

interface CategoryEnvelopeProps {
  categoria: Categoria;
  actividades: Actividad[];
  isExpanded: boolean;
  onToggle: () => void;
  onView: (actividad: Actividad) => void;
  onEdit: (actividad: Actividad) => void;
  onDelete: (actividad: Actividad) => void;
}

const CategoryEnvelope = ({
  categoria,
  actividades,
  isExpanded,
  onToggle,
  onView,
  onEdit,
  onDelete
}: CategoryEnvelopeProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const previewActividades = actividades.slice(0, 2);
  const remainingCount = Math.max(0, actividades.length - 2);

  return (
    <Card 
      className={`transition-all duration-300 cursor-pointer ${
        isExpanded ? 'shadow-lg border-primary/50' : 'hover:shadow-md'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onToggle}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {categoria.cat_nombre}
            <Badge variant="secondary" className="ml-2">
              {actividades.length}
            </Badge>
          </CardTitle>
        </div>
        {categoria.cat_descripcion && (
          <p className="text-sm text-muted-foreground">{categoria.cat_descripcion}</p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {!isExpanded && (
          <div className="space-y-2">
            {/* Preview cards */}
            <div className="space-y-2">
              {previewActividades.map((actividad) => (
                <div
                  key={actividad.act_id}
                  className="p-2 bg-muted/30 rounded-md border-l-3 border-l-primary/60"
                >
                  <p className="text-sm font-medium">{actividad.act_nombre}</p>
                  {actividad.act_espacio_trabajo && (
                    <p className="text-xs text-muted-foreground">
                      Espacio: {actividad.act_espacio_trabajo}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {remainingCount > 0 && (
              <div className="p-2 bg-muted/20 rounded-md text-center">
                <p className="text-xs text-muted-foreground">
                  +{remainingCount} actividad{remainingCount !== 1 ? 'es' : ''} más
                </p>
              </div>
            )}

            {/* Hover preview */}
            {isHovered && actividades.length > 2 && (
              <div className="absolute z-10 mt-2 p-3 bg-background border rounded-lg shadow-lg min-w-64 animate-fade-in">
                <p className="text-sm font-medium mb-2">Todas las actividades:</p>
                <div className="space-y-1">
                  {actividades.map((actividad) => (
                    <p key={actividad.act_id} className="text-xs text-muted-foreground">
                      • {actividad.act_nombre}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {isExpanded && (
          <div className="space-y-3 animate-fade-in">
            {actividades.map((actividad) => (
              <Card key={actividad.act_id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-base mb-2">{actividad.act_nombre}</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {actividad.act_espacio_trabajo && (
                          <div>
                            <span className="font-medium text-muted-foreground">Espacio:</span>
                            <p>{actividad.act_espacio_trabajo}</p>
                          </div>
                        )}
                        
                        {actividad.act_indumentaria_tipo && (
                          <div>
                            <span className="font-medium text-muted-foreground">Uniforme:</span>
                            <p>{actividad.act_indumentaria_tipo}</p>
                          </div>
                        )}
                        
                        {actividad.act_materiales_alumno && actividad.act_materiales_alumno.length > 0 && (
                          <div className="md:col-span-2">
                            <span className="font-medium text-muted-foreground">Materiales:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {actividad.act_materiales_alumno.map((material, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {material}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onView(actividad);
                        }}
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(actividad);
                        }}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(actividad);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CategoryEnvelope;
