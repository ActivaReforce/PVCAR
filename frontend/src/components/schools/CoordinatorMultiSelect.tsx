
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Coordinator {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
}

interface CoordinatorMultiSelectProps {
  selectedCoordinators: number[];
  onCoordinatorsChange: (coordinatorIds: number[]) => void;
  excludeSchoolId?: number; // For edit mode, exclude current school's coordinators from availability check
}

const CoordinatorMultiSelect = ({
  selectedCoordinators,
  onCoordinatorsChange,
  excludeSchoolId
}: CoordinatorMultiSelectProps) => {
  const [availableCoordinators, setAvailableCoordinators] = useState<Coordinator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAvailableCoordinators = async () => {
      try {
        setIsLoading(true);
        
        // Get users with Admin Colegio role (rol_id = 2)
        const { data: adminUsers, error: adminError } = await supabase
          .from('usuario_rol')
          .select(`
            usu_id,
            usuario:usu_id(
              usu_id,
              usu_nombre,
              usu_correo
            )
          `)
          .eq('rol_id', 2);

        if (adminError) throw adminError;

        // Extract unique users from the nested structure
        const uniqueAdminUsers = adminUsers
          ?.map(ur => ur.usuario)
          .filter(Boolean)
          .reduce((acc, user) => {
            if (!acc.find(u => u.usu_id === user.usu_id)) {
              acc.push(user);
            }
            return acc;
          }, [] as Coordinator[]) || [];

        // Show all coordinators - no filtering based on existing assignments
        setAvailableCoordinators(uniqueAdminUsers);
      } catch (error: any) {
        console.error("Error fetching coordinators:", error);
        toast({
          title: "Error",
          description: "Error al cargar los coordinadores disponibles",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailableCoordinators();
  }, [excludeSchoolId, selectedCoordinators, toast]);

  const handleCoordinatorToggle = (coordinatorId: number, checked: boolean) => {
    if (checked) {
      onCoordinatorsChange([...selectedCoordinators, coordinatorId]);
    } else {
      onCoordinatorsChange(selectedCoordinators.filter(id => id !== coordinatorId));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Label>Coordinadores del Colegio</Label>
        <div className="text-sm text-muted-foreground">Cargando coordinadores...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label>Coordinadores del Colegio</Label>
      <div className="space-y-3 max-h-40 overflow-y-auto border rounded-md p-3">
        {availableCoordinators.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No hay coordinadores disponibles
          </div>
        ) : (
          availableCoordinators.map(coordinator => {
            const isChecked = selectedCoordinators.includes(coordinator.usu_id);
            return (
              <div key={coordinator.usu_id} className="flex items-center space-x-2">
                <Checkbox
                  id={`coordinator-${coordinator.usu_id}`}
                  checked={isChecked}
                  onCheckedChange={(checked) => 
                    handleCoordinatorToggle(coordinator.usu_id, checked as boolean)
                  }
                />
                <label 
                  htmlFor={`coordinator-${coordinator.usu_id}`} 
                  className="text-sm cursor-pointer flex-1"
                >
                  <div className="font-medium">{coordinator.usu_nombre}</div>
                  <div className="text-xs text-muted-foreground">
                    {coordinator.usu_correo}
                  </div>
                </label>
              </div>
            );
          })
        )}
      </div>
      {selectedCoordinators.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Puedes seleccionar múltiples coordinadores o ninguno
        </p>
      )}
    </div>
  );
};

export default CoordinatorMultiSelect;
