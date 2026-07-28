
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";

interface UsuariosHeaderProps {
  viewMode: 'cards' | 'table';
  onCreateUser: () => void;
  onBackToCards: () => void;
}

const UsuariosHeader = ({ viewMode, onCreateUser, onBackToCards }: UsuariosHeaderProps) => {
  const { canCreate } = usePermissions();
  const isMobile = useIsMobile();

  if (isMobile && viewMode === 'table') {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h1>
        
        <Button 
          variant="outline" 
          onClick={onBackToCards}
          className="w-full"
        >
          Volver a Tarjetas
        </Button>
        
        {canCreate('usuarios') && (
          <Button 
            onClick={onCreateUser} 
            className="bg-[#FD5757] hover:bg-[#E04747] w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Usuario
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestión de Usuarios</h1>
        {viewMode === 'table' && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={onBackToCards}
            className="text-sm"
          >
            ← Volver a tarjetas
          </Button>
        )}
      </div>
      {canCreate('usuarios') && (
        <Button 
          onClick={onCreateUser} 
          className="bg-[#FD5757] hover:bg-[#E04747] w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      )}
    </div>
  );
};

export default UsuariosHeader;
