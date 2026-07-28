
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Categoria {
  cat_id: number;
  cat_nombre: string;
  cat_descripcion?: string | null;
}

interface ActivityFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  categorias: Categoria[];
  viewMode: 'categories' | 'all';
  onViewModeChange: (mode: 'categories' | 'all') => void;
}

const ActivityFilters = ({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categorias,
  viewMode,
  onViewModeChange
}: ActivityFiltersProps) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar actividades..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Category Filter */}
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categorias.map((categoria) => (
              <SelectItem key={categoria.cat_id} value={categoria.cat_id.toString()}>
                {categoria.cat_nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View Mode Toggle */}
        <div className="flex border rounded-lg p-1 bg-muted/50">
          <Button
            variant={viewMode === 'categories' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('categories')}
            className="px-3"
          >
            Por Categorías
          </Button>
          <Button
            variant={viewMode === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('all')}
            className="px-3"
          >
            Ver Todo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ActivityFilters;
