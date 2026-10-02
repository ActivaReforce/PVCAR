
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database } from "@/integrations/supabase/types";

type Rol = Database['public']['Tables']['rol']['Row'];

interface RoleSpecificFieldsProps {
  formData: {
    padre_sector_residencia: string;
    selectedRoles: number[];
  };
  roles: Rol[];
  onInputChange: (field: string, value: string) => void;
}

/**
 * Campos que solo tienen sentido con un rol. La cedula salio de aqui en la
 * Fase 14B: ahora es de cualquier usuario (usuario.usu_cedula, migracion 0014)
 * y vive con los datos basicos.
 */
const RoleSpecificFields = ({ formData, roles, onInputChange }: RoleSpecificFieldsProps) => {
  // Check if user has parent role
  const hasParentRole = formData.selectedRoles.some(roleId => {
    const role = roles.find(r => r.rol_id === roleId);
    return roleId === 4 || role?.rol_nombre === "padre de familia" || role?.rol_nombre === "padre";
  });

  if (!hasParentRole) {
    return null;
  }

  return (
    <div className="space-y-4">
      {hasParentRole && (
        <div>
          <Label htmlFor="padre_sector_residencia">Sector de Residencia</Label>
          <Input
            id="padre_sector_residencia"
            value={formData.padre_sector_residencia}
            onChange={(e) => onInputChange("padre_sector_residencia", e.target.value)}
            placeholder="Ingrese el sector de residencia"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Campo específico para padres de familia
          </p>
        </div>
      )}
    </div>
  );
};

export default RoleSpecificFields;
