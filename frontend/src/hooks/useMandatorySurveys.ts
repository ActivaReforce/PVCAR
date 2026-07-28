
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PendingSurvey {
  encu_id: number;
  encu_titulo: string;
  encu_descripcion?: string;
  questions: Array<{
    encupreg_id: number;
    encupreg_pregunta: string;
    encupreg_nota?: string;
    encutiporesp_id: number;
    encupreg_orden: number;
    encupreg_escala_min?: number;
    encupreg_escala_max?: number;
  }>;
}

interface SurveyResponse {
  encupreg_id: number;
  encutiporesp_id: number;
  encurespu_texto?: string;
  encurespu_num?: number;
  encurespu_fecha?: string;
  encurespu_hora?: string;
  encurespu_sino?: boolean; // Added to support Sí/No responses
}

export const useMandatorySurveys = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get parent_id for the current user
  const { data: parentData } = useQuery({
    queryKey: ['parent', user?.usu_id],
    queryFn: async () => {
      if (!user?.usu_id) return null;
      
      const { data, error } = await supabase
        .from('padre')
        .select('padre_id')
        .eq('usu_id', user.usu_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.usu_id
  });

  // Get pending surveys for the parent
  const { data: pendingSurveys = [], isLoading } = useQuery({
    queryKey: ['pendingSurveys', parentData?.padre_id],
    queryFn: async (): Promise<PendingSurvey[]> => {
      if (!parentData?.padre_id) return [];

      // Get published surveys
      const { data: publishedSurveys, error: surveysError } = await supabase
        .from('encuesta')
        .select(`
          encu_id,
          encu_titulo,
          encu_descripcion,
          encuesta_pregunta(
            encupreg_id,
            encupreg_pregunta,
            encupreg_nota,
            encutiporesp_id,
            encupreg_orden,
            encupreg_escala_min,
            encupreg_escala_max
          )
        `)
        .eq('est_id', 5)
        .order('encu_fecha_creacion', { ascending: false });

      if (surveysError) throw surveysError;

      // Get surveys already answered by this parent
      const { data: answeredSurveys, error: answeredError } = await supabase
        .from('encuesta_respondida')
        .select('encu_id')
        .eq('padre_id', parentData.padre_id);

      if (answeredError) throw answeredError;

      const answeredSurveyIds = new Set(answeredSurveys?.map(s => s.encu_id) || []);

      // Filter out already answered surveys
      const pending = publishedSurveys?.filter(survey => 
        !answeredSurveyIds.has(survey.encu_id)
      ) || [];

      // Transform the data structure
      return pending.map(survey => ({
        encu_id: survey.encu_id,
        encu_titulo: survey.encu_titulo,
        encu_descripcion: survey.encu_descripcion,
        questions: (survey.encuesta_pregunta || [])
          .sort((a, b) => a.encupreg_orden - b.encupreg_orden)
      }));
    },
    enabled: !!parentData?.padre_id
  });

  // Submit survey response
  const submitSurveyMutation = useMutation({
    mutationFn: async ({ surveyId, responses }: { surveyId: number; responses: SurveyResponse[] }) => {
      if (!parentData?.padre_id) throw new Error('Parent ID not found');

      // First, create the survey response record
      const { data: surveyResponse, error: responseError } = await supabase
        .from('encuesta_respondida')
        .insert({
          encu_id: surveyId,
          padre_id: parentData.padre_id
        })
        .select()
        .single();

      if (responseError) throw responseError;

      // Then, insert all individual answers
      const answers = responses.map(response => ({
        encurespo_id: surveyResponse.encurespo_id,
        encupreg_id: response.encupreg_id,
        encurespu_texto: response.encurespu_texto,
        encurespu_num: response.encurespu_num,
        encurespu_fecha: response.encurespu_fecha ? new Date(response.encurespu_fecha).toISOString() : null,
        encurespu_hora: response.encurespu_hora,
        // Include boolean for Sí/No; ensures valid selections are never NULL
        ...(response.encurespu_sino !== undefined ? { encurespu_sino: response.encurespu_sino } : {})
      }));

      const { error: answersError } = await supabase
        .from('encuesta_respuesta')
        .insert(answers);

      if (answersError) throw answersError;

      return surveyResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingSurveys'] });
    }
  });

  return {
    pendingSurveys,
    isLoading,
    submitSurvey: submitSurveyMutation.mutateAsync,
    isSubmitting: submitSurveyMutation.isPending,
    isParent: !!parentData?.padre_id
  };
};
