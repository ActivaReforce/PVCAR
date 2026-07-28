
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TrainerEvaluationContext {
  trainerId: number | null;
  trainerName: string | null;
  isAuxiliaryRole: boolean;
  loading: boolean;
}

export const useTrainerEvaluationContext = () => {
  const [context, setContext] = useState<TrainerEvaluationContext>({
    trainerId: null,
    trainerName: null,
    isAuxiliaryRole: false,
    loading: true
  });
  const { user } = useAuth();

  useEffect(() => {
    const resolveContext = async () => {
      if (!user) {
        setContext({ trainerId: null, trainerName: null, isAuxiliaryRole: false, loading: false });
        return;
      }

      // Check if user is assistant (role 6) or backup trainer (role 7)
      const isAuxiliary = user.roles?.some(role => role.rol_id === 6 || role.rol_id === 7);
      
      if (!isAuxiliary) {
        setContext({ trainerId: null, trainerName: null, isAuxiliaryRole: false, loading: false });
        return;
      }

      try {
        // Get trainer association from entrenador_auxiliar
        const { data: auxiliarData, error: auxiliarError } = await supabase
          .from('entrenador_auxiliar')
          .select('ent_id')
          .eq('usu_id', user.usu_id)
          .eq('est_id', 1)
          .maybeSingle();

        if (auxiliarError || !auxiliarData?.ent_id) {
          setContext({ trainerId: null, trainerName: null, isAuxiliaryRole: true, loading: false });
          return;
        }

        // Get trainer's name using ent_id (which equals usu_id)
        const { data: trainerData, error: trainerError } = await supabase
          .from('usuario')
          .select('usu_nombre')
          .eq('usu_id', auxiliarData.ent_id)
          .maybeSingle();

        if (trainerError) {
          console.error('Error fetching trainer data:', trainerError);
        }

        setContext({
          trainerId: auxiliarData.ent_id,
          trainerName: trainerData?.usu_nombre || null,
          isAuxiliaryRole: true,
          loading: false
        });
      } catch (error) {
        console.error('Error resolving trainer context:', error);
        setContext({ trainerId: null, trainerName: null, isAuxiliaryRole: true, loading: false });
      }
    };

    resolveContext();
  }, [user]);

  return context;
};
