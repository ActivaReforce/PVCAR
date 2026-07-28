
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SurveyStats {
  encu_id: number;
  responses_count: number;
  total_parents: number;
}

export const useSurveyStats = () => {
  const { data: surveyStats = [], isLoading } = useQuery({
    queryKey: ['surveyStats'],
    queryFn: async (): Promise<SurveyStats[]> => {
      // Get all surveys with their response counts
      const { data: surveys, error: surveysError } = await supabase
        .from('encuesta')
        .select('encu_id');

      if (surveysError) throw surveysError;

      // Get total number of active parents (only those with active usuarios)
      // Use PostgREST join syntax with !inner in the select string
      const { count: totalParents, error: parentsError } = await supabase
        .from('padre')
        .select('padre_id, usuario!inner(usu_id, est_id)', { count: 'exact', head: true })
        .eq('usuario.est_id', 1);

      if (parentsError) throw parentsError;

      // Get response counts for each survey
      const statsPromises = surveys.map(async (survey) => {
        const { count: responsesCount, error } = await supabase
          .from('encuesta_respondida')
          .select('*', { count: 'exact', head: true })
          .eq('encu_id', survey.encu_id);

        if (error) throw error;

        return {
          encu_id: survey.encu_id,
          responses_count: responsesCount || 0,
          total_parents: totalParents || 0
        };
      });

      const stats = await Promise.all(statsPromises);
      return stats;
    }
  });

  const getStatsForSurvey = (surveyId: number) => {
    return surveyStats.find(stat => stat.encu_id === surveyId) || {
      encu_id: surveyId,
      responses_count: 0,
      total_parents: 0
    };
  };

  return {
    surveyStats,
    isLoading,
    getStatsForSurvey
  };
};
