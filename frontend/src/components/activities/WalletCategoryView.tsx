import { useState } from "react";
import ActivityWallet from "./ActivityWallet";
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
interface WalletCategoryViewProps {
  actividadesByCategory: Array<{
    categoria: Categoria;
    actividades: Actividad[];
  }>;
  onView: (actividad: Actividad) => void;
  onEdit: (actividad: Actividad) => void;
  onDelete: (actividad: Actividad) => void;
}
const WalletCategoryView = ({
  actividadesByCategory,
  onView,
  onEdit,
  onDelete
}: WalletCategoryViewProps) => {
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const handleCategoryToggle = (categoriaId: number) => {
    setExpandedCategory(expandedCategory === categoriaId ? null : categoriaId);
  };
  if (actividadesByCategory.length === 0) {
    return <div className="text-center py-12">
        <p className="text-muted-foreground">
          No se encontraron actividades que coincidan con los filtros
        </p>
      </div>;
  }
  return <div className="space-y-6">
      {/* Responsive grid for wallets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {actividadesByCategory.map(({
        categoria,
        actividades
      }) => <ActivityWallet key={categoria.cat_id} categoria={categoria} actividades={actividades} isExpanded={expandedCategory === categoria.cat_id} onToggle={() => handleCategoryToggle(categoria.cat_id)} onView={onView} onEdit={onEdit} onDelete={onDelete} />)}
      </div>

      {/* Instructions for users */}
      {expandedCategory === null && <div className="text-center py-2 border-t border-border/50">
          
          <p className="text-xs text-muted-foreground mt-1">
            Haz clic en una categoría para ver todos los detalles y acciones
          </p>
        </div>}
    </div>;
};
export default WalletCategoryView;