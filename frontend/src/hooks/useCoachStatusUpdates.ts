
import { supabase } from "@/integrations/supabase/client";

export const useCoachStatusUpdates = () => {
  const updateCoachStatus = async (userId: number, newStatus: number, userRoles: number[]) => {
    const isCoach = userRoles.includes(3); // role_id = 3 is coach
    
    if (!isCoach) {
      return; // No coach-specific updates needed
    }

    try {
      // Update entrenador table status
      const { error: trainerError } = await supabase
        .from('entrenador')
        .update({ 
          est_id: newStatus,
          ent_fecha_modificacion: new Date().toISOString()
        })
        .eq('ent_id', userId);

      if (trainerError) {
        console.error("Error updating trainer status:", trainerError);
        throw trainerError;
      }

      // If deactivating (newStatus = 2), also deactivate all active assignments
      if (newStatus === 2) {
        const { error: assignmentError } = await supabase
          .from('entrenador_asignacion')
          .update({
            est_id: 2,
            entasig_fecha_fin: new Date().toISOString().split('T')[0]
          })
          .eq('ent_id', userId)
          .eq('est_id', 1); // Only update currently active assignments

        if (assignmentError) {
          console.error("Error deactivating trainer assignments:", assignmentError);
          throw assignmentError;
        }
      }
      // Note: When reactivating (newStatus = 1), we don't auto-reopen assignments
      
    } catch (error) {
      console.error("Error in coach status update:", error);
      throw error;
    }
  };

  return {
    updateCoachStatus,
  };
};
