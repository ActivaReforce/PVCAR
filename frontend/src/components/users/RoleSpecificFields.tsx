
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database } from "@/integrations/supabase/types";

type Rol = Database['public']['Tables']['rol']['Row'];

interface RoleSpecificFieldsProps {
  formData: {
    ent_cedula: string;
    padre_sector_residencia: string;
    selectedRoles: number[];
  };
  roles: Rol[];
  onInputChange: (field: string, value: string) => void;
}

const RoleSpecificFields = ({ formData, roles, onInputChange }: RoleSpecificFieldsProps) => {
  // Check if user has coach role
  const hasCoachRole = formData.selectedRoles.some(roleId => {
    const role = roles.find(r => r.rol_id === roleId);
    return roleId === 3 || role?.rol_nombre === "entrenador";
  });

  // Check if user has parent role
  const hasParentRole = formData.selectedRoles.some(roleId => {
    const role = roles.find(r => r.rol_id === roleId);
    return roleId === 4 || role?.rol_nombre === "padre de familia" || role?.rol_nombre === "padre";
  });

  if (!hasCoachRole && !hasParentRole) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Coach-specific fields */}
      {hasCoachRole && (
        <div>
          <Label htmlFor="ent_cedula">Cédula del Entrenador</Label>
          <Input
            id="ent_cedula"
            value={formData.ent_cedula}
            onChange={(e) => onInputChange("ent_cedula", e.target.value)}
            placeholder="Ingrese la cédula"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Campo específico para entrenadores
          </p>
        </div>
      )}

      {/* Parent-specific fields */}
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
