
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useSurveyActions = () => {
  const queryClient = useQueryClient();

  // Finalize survey mutation
  const finalizeMutation = useMutation({
    mutationFn: async (surveyId: number) => {
      const { error } = await supabase
        .from('encuesta')
        .update({
          est_id: 4, // Finalizado status
          encu_fecha_modificacion: new Date().toISOString()
        })
        .eq('encu_id', surveyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      toast({
        title: "Encuesta finalizada",
        description: "La encuesta ha sido finalizada exitosamente"
      });
    },
    onError: (error) => {
      console.error('Error finalizing survey:', error);
      toast({
        title: "Error",
        description: "No se pudo finalizar la encuesta",
        variant: "destructive"
      });
    }
  });

  const finalizeSurvey = async (surveyId: number) => {
    return finalizeMutation.mutateAsync(surveyId);
  };

  return {
    finalizeSurvey,
    isFinalizingLoading: finalizeMutation.isPending
  };
};
