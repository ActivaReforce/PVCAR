import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Database } from "@/integrations/supabase/types";
type Rol = Database['public']['Tables']['rol']['Row'];
interface UserRoleSelectionProps {
  roles: Rol[];
  selectedRoles: number[];
  onRoleChange: (selectedRoles: number[]) => void;
  isAssignedAsColegioAdmin?: boolean;
}
const UserRoleSelection = ({
  roles,
  selectedRoles,
  onRoleChange,
  isAssignedAsColegioAdmin = false
}: UserRoleSelectionProps) => {
  const handleRoleToggle = (roleId: number, checked: boolean) => {
    // Prevent removing colegio admin role if user is assigned as one
    if (!checked && roleId === 2 && isAssignedAsColegioAdmin) {
      return; // Don't allow unchecking
    }
    if (checked) {
      onRoleChange([...selectedRoles, roleId]);
    } else {
      onRoleChange(selectedRoles.filter(id => id !== roleId));
    }
  };
  return <div className="space-y-4">
      <Label>Roles del Usuario *</Label>
      <div className="space-y-3 max-h-40 overflow-y-auto border rounded-md p-3">
        {roles.map(role => {
        const isChecked = selectedRoles.includes(role.rol_id);
        const isDisabled = role.rol_id === 2 && isAssignedAsColegioAdmin && isChecked;
        return <div key={role.rol_id} className="flex items-center space-x-2">
              <Checkbox id={`role-${role.rol_id}`} checked={isChecked} disabled={isDisabled} onCheckedChange={checked => handleRoleToggle(role.rol_id, checked as boolean)} />
              <label htmlFor={`role-${role.rol_id}`} className={`text-sm cursor-pointer flex-1 ${isDisabled ? 'text-muted-foreground' : ''}`}>
                <div className="font-medium">{role.rol_titulo}</div>
                {role.rol_descripcion && <div className="text-xs text-muted-foreground">
                    {role.rol_descripcion}
                  </div>}
              </label>
            </div>;
      })}
      </div>
      {selectedRoles.length === 0 && <p className="text-xs text-destructive">
          Debe seleccionar al menos un rol
        </p>}
      {isAssignedAsColegioAdmin}
    </div>;
};
export default UserRoleSelection;