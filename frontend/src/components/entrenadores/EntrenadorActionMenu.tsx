import { MoreHorizontal, Eye, Link, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EntrenadorWithDetails } from "./EntrenadorTypes";

interface EntrenadorActionMenuProps {
  entrenador: EntrenadorWithDetails;
  onView: (entrenador: EntrenadorWithDetails) => void;
  onAtar: (entrenador: EntrenadorWithDetails) => void;
  onAgregarAuxiliar: (entrenador: EntrenadorWithDetails) => void;
}

const EntrenadorActionMenu = ({
  entrenador,
  onView,
  onAtar,
  onAgregarAuxiliar,
}: EntrenadorActionMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Abrir menú</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border shadow-lg">
        <DropdownMenuItem onClick={() => onView(entrenador)}>
          <Eye className="mr-2 h-4 w-4" />
          Ver detalles
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAtar(entrenador)}>
          <Link className="mr-2 h-4 w-4" />
          Asignar disciplinas
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAgregarAuxiliar(entrenador)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Agregar auxiliar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default EntrenadorActionMenu;