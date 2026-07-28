import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import DebouncedSearchInput from "@/components/ui/debounced-search-input";

interface EstudiantesHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onCreateNew: () => void;
  showSearch: boolean;
  // Keep backward compatibility with the new prop name if needed
  onCreateEstudiante?: () => void;
}

const EstudiantesHeader = ({ 
  searchQuery, 
  onSearchChange, 
  onCreateNew, 
  showSearch,
  onCreateEstudiante 
}: EstudiantesHeaderProps) => {
  const { canCreate } = usePermissions();

  // Use onCreateNew (legacy) if provided, otherwise fallback to onCreateEstudiante
  const handleCreate = onCreateNew || onCreateEstudiante || (() => {});

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="hidden sm:block">
        <h1 className="text-2xl sm:text-3xl font-bold">Gestión de Alumnos</h1>
        <p className="text-muted-foreground mt-1">
          Administra la información de los alumnos del sistema
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        {showSearch && (
          <DebouncedSearchInput
            placeholder="Buscar alumnos..."
            value={searchQuery}
            onChange={onSearchChange}
            className="w-full sm:max-w-md"
            debounceMs={300}
          />
        )}
        
        {canCreate('estudiantes') && (
          <Button 
            onClick={handleCreate}
            className="bg-[#FD5757] hover:bg-[#E04747] text-white font-semibold px-4 sm:px-6 py-2 shadow-lg w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" /> Nuevo Alumno
          </Button>
        )}
      </div>
    </div>
  );
};

export default EstudiantesHeader;
