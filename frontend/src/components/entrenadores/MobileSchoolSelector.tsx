import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MobileSchoolSelectorProps {
  schools: Array<{ col_id: number; col_nombre: string; count?: number }>;
  selectedSchool: number | 'unassigned' | 'all' | null;
  onSchoolChange: (schoolId: number | 'unassigned' | 'all' | null) => void;
  isCoordinator: boolean;
}

const MobileSchoolSelector = ({ 
  schools, 
  selectedSchool, 
  onSchoolChange,
  isCoordinator 
}: MobileSchoolSelectorProps) => {
  const getSelectedLabel = () => {
    if (selectedSchool === 'all') return 'Ver todos';
    if (selectedSchool === 'unassigned') return 'Sin asignar';
    if (selectedSchool === null) return 'Seleccionar colegio';
    
    const school = schools.find(s => s.col_id === selectedSchool);
    return school ? school.col_nombre : 'Seleccionar colegio';
  };

  return (
    <div className="w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-between text-left min-w-0"
          >
            <span className="truncate">{getSelectedLabel()}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full min-w-[calc(100vw-2rem)] bg-background border shadow-lg z-50">
          {!isCoordinator && (
            <>
              <DropdownMenuItem
                onClick={() => onSchoolChange('all')}
                className={selectedSchool === 'all' ? 'bg-muted' : ''}
              >
                <span className="truncate">Ver todos</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSchoolChange('unassigned')}
                className={selectedSchool === 'unassigned' ? 'bg-muted' : ''}
              >
                <span className="truncate">Sin asignar</span>
              </DropdownMenuItem>
            </>
          )}
          {schools.map((school) => (
            <DropdownMenuItem
              key={school.col_id}
              onClick={() => onSchoolChange(school.col_id)}
              className={selectedSchool === school.col_id ? 'bg-muted' : ''}
            >
              <span className="truncate">{school.col_nombre}</span>
              {school.count !== undefined && (
                <span className="ml-auto text-muted-foreground text-sm">
                  {school.count}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default MobileSchoolSelector;