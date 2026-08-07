import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

interface UsuariosHeaderProps {
  onCreateUser: () => void;
}

/**
 * Cabecera. Ya no hay modo tarjetas ni boton de volver: la pantalla abre
 * directamente en la lista, con Activos y todos los roles.
 */
const UsuariosHeader = ({ onCreateUser }: UsuariosHeaderProps) => {
  const { canCreate } = usePermissions();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestión de Usuarios</h1>
      {canCreate('usuarios') && (
        <Button onClick={onCreateUser} className="bg-[#FD5757] hover:bg-[#E04747] w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      )}
    </div>
  );
};

export default UsuariosHeader;
