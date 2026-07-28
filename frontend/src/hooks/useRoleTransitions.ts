
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Rol = Database['public']['Tables']['rol']['Row'];

interface FormData {
  ent_cedula: string;
  padre_sector_residencia: string;
}

export const useRoleTransitions = (roles: Rol[]) => {
  const checkActiveAssignments = async (userId: number): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('entrenador_asignacion')
        .select('entasig_id')
        .eq('ent_id', userId)
        .eq('est_id', 1)
        .is('entasig_fecha_fin', null);

      if (error) throw error;
      return (data || []).length > 0;
    } catch (error) {
      console.error("Error checking active assignments:", error);
      return false;
    }
  };

  const deactivateTrainerAndAssignments = async (userId: number) => {
    try {
      const { error: trainerError } = await supabase
        .from('entrenador')
        .update({ 
          est_id: 2,
          ent_fecha_modificacion: new Date().toISOString()
        })
        .eq('ent_id', userId);

      if (trainerError) throw trainerError;

      const { error: assignmentError } = await supabase
        .from('entrenador_asignacion')
        .update({
          est_id: 2,
          entasig_fecha_fin: new Date().toISOString().split('T')[0]
        })
        .eq('ent_id', userId)
        .eq('est_id', 1)
        .is('entasig_fecha_fin', null);

      if (assignmentError) throw assignmentError;
    } catch (error) {
      console.error("Error deactivating trainer and assignments:", error);
      throw error;
    }
  };

  const updateCoachStatusForUser = async (userId: number, isActive: boolean) => {
    try {
      const statusId = isActive ? 1 : 2;
      
      const { error: trainerError } = await supabase
        .from('entrenador')
        .update({ 
          est_id: statusId,
          ent_fecha_modificacion: new Date().toISOString()
        })
        .eq('ent_id', userId);

      if (trainerError) throw trainerError;

      // If deactivating, also deactivate assignments
      if (!isActive) {
        const { error: assignmentError } = await supabase
          .from('entrenador_asignacion')
          .update({
            est_id: 2,
            entasig_fecha_fin: new Date().toISOString().split('T')[0]
          })
          .eq('ent_id', userId)
          .eq('est_id', 1);

        if (assignmentError) throw assignmentError;
      }
    } catch (error) {
      console.error("Error updating coach status:", error);
      throw error;
    }
  };

  const handleRoleTransitions = async (usuarioId: number, newRoleIds: number[], oldRoleIds: number[] = [], formData: FormData) => {
    const wasCoach = oldRoleIds.some(roleId => {
      const role = roles.find(r => r.rol_id === roleId);
      return roleId === 3 || role?.rol_nombre === "entrenador";
    });
    
    const wasParent = oldRoleIds.some(roleId => {
      const role = roles.find(r => r.rol_id === roleId);
      return roleId === 4 || role?.rol_nombre === "padre de familia" || role?.rol_nombre === "padre";
    });

    const isNewCoach = newRoleIds.some(roleId => {
      const role = roles.find(r => r.rol_id === roleId);
      return roleId === 3 || role?.rol_nombre === "entrenador";
    });
    
    const isNewParent = newRoleIds.some(roleId => {
      const role = roles.find(r => r.rol_id === roleId);
      return roleId === 4 || role?.rol_nombre === "padre de familia" || role?.rol_nombre === "padre";
    });

    // Get current user status to maintain consistency
    const { data: userData } = await supabase
      .from('usuario')
      .select('est_id')
      .eq('usu_id', usuarioId)
      .single();
    
    const userIsActive = userData?.est_id === 1;

    try {
      // Handle cleanup of old roles
      if (wasCoach && !isNewCoach) {
        const hasActiveAssignments = await checkActiveAssignments(usuarioId);
        if (hasActiveAssignments) {
          throw new Error("No se puede remover el rol de entrenador. El usuario tiene asignaciones activas.");
        }
        await deactivateTrainerAndAssignments(usuarioId);
      }

      if (wasParent && !isNewParent) {
        const { error } = await supabase
          .from('padre')
          .delete()
          .eq('usu_id', usuarioId);
        
        if (error) throw error;
      }

      // Handle addition to new roles
      if (isNewCoach && !wasCoach) {
        const { data: existingTrainer } = await supabase
          .from('entrenador')
          .select('ent_id, est_id')
          .eq('ent_id', usuarioId)
          .maybeSingle();

        if (existingTrainer && existingTrainer.est_id === 2) {
          // Reactivate existing trainer record based on user status
          const { error } = await supabase
            .from('entrenador')
            .update({
              est_id: userIsActive ? 1 : 2,
              ent_cedula: formData.ent_cedula || null,
              ent_fecha_modificacion: new Date().toISOString(),
            })
            .eq('ent_id', usuarioId);

          if (error) throw error;
        } else if (!existingTrainer) {
          // Create new trainer record with status matching user status
          const { error } = await supabase
            .from('entrenador')
            .insert({
              ent_id: usuarioId,
              ent_cedula: formData.ent_cedula || null,
              est_id: userIsActive ? 1 : 2,
              ent_fecha_creacion: new Date().toISOString(),
            });

          if (error) throw error;
        }
      }

      // Update coach status if user is already a coach and user status changes
      if (isNewCoach && wasCoach) {
        await updateCoachStatusForUser(usuarioId, userIsActive);
      }

      if (isNewParent && !wasParent) {
        const { error } = await supabase
          .from('padre')
          .insert({
            usu_id: usuarioId,
            padre_sector_residencia: formData.padre_sector_residencia || null,
            padre_fecha_creacion: new Date().toISOString(),
          });

        if (error) throw error;
      }

    } catch (error) {
      console.error("Error during role transition:", error);
      throw error;
    }
  };

  return {
    handleRoleTransitions,
  };
};
