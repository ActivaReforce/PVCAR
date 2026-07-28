
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface DisciplinaWithDetails {
  colacthor_id: number;
  colegio: {
    col_nombre: string;
  } | null;
  actividad: {
    act_nombre: string;
  } | null;
  dia: {
    dia_nombre: string;
  } | null;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  colacthor_fecha_creacion: string;
  col_id: number | null;
  act_id: number | null;
  dia_id: number | null;
  est_id: number | null;
}

interface ColegioFilterProps {
  disciplinas: DisciplinaWithDetails[];
  selectedColegios: string[];
  onColegiosChange: (colegios: string[]) => void;
}

const ColegioFilter = ({
  disciplinas,
  selectedColegios,
  onColegiosChange
}: ColegioFilterProps) => {
  const [open, setOpen] = useState(false);

  // Get unique colegios from disciplinas
  const uniqueColegios = Array.from(new Set(disciplinas.map(d => d.colegio?.col_nombre).filter(Boolean))).sort();
  
  const handleColegioToggle = (colegio: string) => {
    if (colegio === "all") {
      if (selectedColegios.includes("all")) {
        onColegiosChange([]);
      } else {
        onColegiosChange(["all"]);
      }
    } else {
      const newSelection = selectedColegios.includes(colegio) ? selectedColegios.filter(c => c !== colegio && c !== "all") : [...selectedColegios.filter(c => c !== "all"), colegio];
      onColegiosChange(newSelection);
    }
  };
  
  const getDisplayText = () => {
    if (selectedColegios.length === 0) return "Seleccionar colegios";
    if (selectedColegios.includes("all")) return "Todos los colegios";
    if (selectedColegios.length === 1) return selectedColegios[0];
    return `${selectedColegios.length} colegios seleccionados`;
  };
  
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full sm:w-64 justify-between">
          {getDisplayText()}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-2 bg-white border border-gray-200 shadow-lg z-50 dark:bg-primary dark:text-black">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded dark:hover:bg-gray-200">
            <Checkbox className="dark:border-gray-400" id="all" checked={selectedColegios.includes("all")} onCheckedChange={() => handleColegioToggle("all")} />
            <label htmlFor="all" className="text-sm font-medium cursor-pointer">
              Todos los colegios
            </label>
          </div>
          <div className="border-t border-gray-200 my-2"></div>
          {uniqueColegios.map(colegio => 
            <div key={colegio} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded dark:hover:bg-gray-200">
              <Checkbox className="dark:border-gray-400" id={colegio} checked={selectedColegios.includes(colegio)} onCheckedChange={() => handleColegioToggle(colegio)} />
              <label htmlFor={colegio} className="text-sm cursor-pointer">
                {colegio}
              </label>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ColegioFilter;
