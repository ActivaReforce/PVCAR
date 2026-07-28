
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import ColegioFilter from "./ColegioFilter";

interface DisciplinaWithDetails {
  colacthor_id: number;
  colegio: { col_nombre: string } | null;
  actividad: { act_nombre: string } | null;
  dia: { dia_nombre: string } | null;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  colacthor_fecha_creacion: string;
  col_id: number | null;
  act_id: number | null;
  dia_id: number | null;
  est_id: number | null;
}

interface DisciplinasFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  disciplinas: DisciplinaWithDetails[];
  selectedColegios: string[];
  onColegiosChange: (colegios: string[]) => void;
  children: React.ReactNode;
}

const DisciplinasFilters = ({
  searchTerm,
  onSearchChange,
  disciplinas,
  selectedColegios,
  onColegiosChange,
  children
}: DisciplinasFiltersProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por colegio, actividad o día..." 
              value={searchTerm} 
              onChange={(e) => onSearchChange(e.target.value)} 
              className="pl-10 w-full" 
            />
          </div>
          <div className="w-full sm:w-auto">
            <ColegioFilter
              disciplinas={disciplinas}
              selectedColegios={selectedColegios}
              onColegiosChange={onColegiosChange}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
};

export default DisciplinasFilters;
