import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface ActivityWalletProps {
  categoria: Categoria;
  actividades: Actividad[];
  isExpanded: boolean;
  onToggle: () => void;
  onView: (actividad: Actividad) => void;
  onEdit: (actividad: Actividad) => void;
  onDelete: (actividad: Actividad) => void;
}

const ActivityWallet = ({
  categoria,
  actividades,
  isExpanded,
  onToggle,
  onView,
  onEdit,
  onDelete
}: ActivityWalletProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const getCategoryColor = (categoriaId: number) => {
    const colors = ["bg-blue-100 text-blue-800 border-blue-200", "bg-green-100 text-green-800 border-green-200", "bg-purple-100 text-purple-800 border-purple-200", "bg-orange-100 text-orange-800 border-orange-200", "bg-pink-100 text-pink-800 border-pink-200", "bg-indigo-100 text-indigo-800 border-indigo-200"];
    return colors[categoriaId % colors.length];
  };
  const getWalletTheme = (categoriaId: number) => {
    const themes = ["from-blue-50 to-blue-100 border-blue-200", "from-green-50 to-green-100 border-green-200", "from-purple-50 to-purple-100 border-purple-200", "from-orange-50 to-orange-100 border-orange-200", "from-pink-50 to-pink-100 border-pink-200", "from-indigo-50 to-indigo-100 border-indigo-200"];
    return themes[categoriaId % themes.length];
  };
  if (isExpanded) {
    // Expanded view - shows full activity details
    return <div className="col-span-full">
        <Card className="bg-gradient-to-br from-background to-muted/30 border-2">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${getWalletTheme(categoria.cat_id)}`} />
                {categoria.cat_nombre}
                <Badge variant="secondary" className="ml-2">
                  {actividades.length}
                </Badge>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={onToggle} className="text-muted-foreground hover:text-foreground">
                Contraer
              </Button>
            </div>
            {categoria.cat_descripcion && <p className="text-sm text-muted-foreground">{categoria.cat_descripcion}</p>}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {actividades.map(actividad => <Card key={actividad.act_id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-base">{actividad.act_nombre}</h4>
                      </div>

                      <div className="space-y-2 text-sm">
                        {actividad.act_descripcion && <p className="text-muted-foreground line-clamp-2">
                            {actividad.act_descripcion}
                          </p>}
                        
                        {actividad.act_espacio_trabajo && <div>
                            <span className="font-medium text-muted-foreground">Espacio:</span>
                            <p className="text-sm">{actividad.act_espacio_trabajo}</p>
                          </div>}
                        
                        {actividad.act_indumentaria_tipo && <div>
                            <span className="font-medium text-muted-foreground">Uniforme:</span>
                            <p className="text-sm">{actividad.act_indumentaria_tipo}</p>
                          </div>}
                        
                        {actividad.act_materiales_alumno && actividad.act_materiales_alumno.length > 0 && <div>
                            <span className="font-medium text-muted-foreground">Materiales:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {actividad.act_materiales_alumno.slice(0, 3).map((material, index) => <Badge key={index} variant="outline" className="text-xs">
                                  {material}
                                </Badge>)}
                              {actividad.act_materiales_alumno.length > 3 && <Badge variant="outline" className="text-xs">
                                  +{actividad.act_materiales_alumno.length - 3}
                                </Badge>}
                            </div>
                          </div>}
                      </div>

                      <div className="flex gap-1 pt-2">
                        <Button variant="outline" size="sm" onClick={() => onView(actividad)} title="Ver detalles" className="flex-1">
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                        <ConditionalAction module="actividades" action="editar">
                          <Button variant="outline" size="sm" onClick={() => onEdit(actividad)} title="Editar" className="flex-1">
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </ConditionalAction>
                        <ConditionalAction module="actividades" action="eliminar">
                          <Button variant="outline" size="sm" onClick={() => onDelete(actividad)} className="text-red-600 hover:text-red-700 hover:bg-red-50" title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </ConditionalAction>
                      </div>
                    </div>
                  </CardContent>
                </Card>)}
            </div>
          </CardContent>
        </Card>
      </div>;
  }

  // Wallet view - compact with refined upward stacked cards effect
  return <Card className={`relative cursor-pointer transition-all duration-300 ease-out bg-gradient-to-br ${getWalletTheme(categoria.cat_id)} hover:shadow-lg hover:scale-[1.02] group overflow-hidden dark:text-black`} onClick={onToggle} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <CardHeader className="pb-3 relative z-10">
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getWalletTheme(categoria.cat_id)}`} />
            {categoria.cat_nombre}
          </div>
          <Badge variant="secondary" className={getCategoryColor(categoria.cat_id)}>
            {actividades.length}
          </Badge>
        </CardTitle>
        {categoria.cat_descripcion && <p className="text-sm text-muted-foreground">{categoria.cat_descripcion}</p>}
      </CardHeader>

      <CardContent className="pt-0 relative mt-auto ">
        {/* Refined center-aligned stacked cards effect */}
        

        {/* Hover instruction */}
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Haz clic para expandir
          </p>
        </div>
      </CardContent>
    </Card>;
};

export default ActivityWallet;
