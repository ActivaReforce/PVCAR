
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SurveyWithQuestions } from '@/components/surveys/SurveyTypes';

export const useSurveys = () => {
  const queryClient = useQueryClient();

  // Fetch all surveys
  const { data: surveys = [], isLoading, error } = useQuery({
    queryKey: ['surveys'],
    queryFn: async (): Promise<SurveyWithQuestions[]> => {
      const { data, error } = await supabase
        .from('encuesta')
        .select(`
          *,
          questions:encuesta_pregunta(*)
        `)
        .order('encu_fecha_creacion', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Delete survey mutation
  const deleteMutation = useMutation({
    mutationFn: async (surveyId: number) => {
      // First delete all questions
      const { error: questionsError } = await supabase
        .from('encuesta_pregunta')
        .delete()
        .eq('encu_id', surveyId);

      if (questionsError) throw questionsError;

      // Then delete the survey
      const { error: surveyError } = await supabase
        .from('encuesta')
        .delete()
        .eq('encu_id', surveyId);

      if (surveyError) throw surveyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
    }
  });

  const deleteSurvey = async (surveyId: number) => {
    return deleteMutation.mutateAsync(surveyId);
  };

  return {
    surveys,
    isLoading,
    error,
    deleteSurvey,
    isDeleting: deleteMutation.isPending
  };
};
