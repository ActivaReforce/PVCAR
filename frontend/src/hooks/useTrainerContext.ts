
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TrainerContext {
  trainerId: number | null;
  trainerName: string | null;
  loading: boolean;
}

export const useTrainerContext = () => {
  const [trainerContext, setTrainerContext] = useState<TrainerContext>({
    trainerId: null,
    trainerName: null,
    loading: true
  });
  const { user } = useAuth();

  useEffect(() => {
    const resolveTrainerContext = async () => {
      if (!user) {
        setTrainerContext({ trainerId: null, trainerName: null, loading: false });
        return;
      }

      // Check if user is assistant (role 6) or backup trainer (role 7)
      const isAssistantOrBackup = user.roles?.some(role => role.rol_id === 6 || role.rol_id === 7);
      
      if (!isAssistantOrBackup) {
        setTrainerContext({ trainerId: null, trainerName: null, loading: false });
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

        if (auxiliarError) {
          console.error('Error fetching trainer auxiliary data:', auxiliarError);
          setTrainerContext({ trainerId: null, trainerName: null, loading: false });
          return;
        }

        if (!auxiliarData?.ent_id) {
          setTrainerContext({ trainerId: null, trainerName: null, loading: false });
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
          setTrainerContext({ trainerId: auxiliarData.ent_id, trainerName: null, loading: false });
          return;
        }

        setTrainerContext({
          trainerId: auxiliarData.ent_id,
          trainerName: trainerData?.usu_nombre || null,
          loading: false
        });
      } catch (error) {
        console.error('Error resolving trainer context:', error);
        setTrainerContext({ trainerId: null, trainerName: null, loading: false });
      }
    };

    resolveTrainerContext();
  }, [user]);

  return trainerContext;
};
