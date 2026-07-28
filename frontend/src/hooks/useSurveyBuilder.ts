
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SurveyFormData, SurveyWithQuestions, EncuestaTipoRespuesta, SURVEY_STATUS } from '@/components/surveys/SurveyTypes';

export const useSurveyBuilder = () => {
  const [survey, setSurvey] = useState<SurveyWithQuestions | null>(null);
  const queryClient = useQueryClient();

  // Fetch question types
  const { data: questionTypes = [] } = useQuery({
    queryKey: ['questionTypes'],
    queryFn: async (): Promise<EncuestaTipoRespuesta[]> => {
      const { data, error } = await supabase
        .from('encuesta_tipo_respuesta')
        .select('*')
        .order('encutiporesp_id');
      
      if (error) throw error;
      return data;
    }
  });

  // Load a survey for editing
  const loadSurvey = useCallback(async (surveyId: number): Promise<SurveyWithQuestions | null> => {
    try {
      // Get survey details
      const { data: surveyData, error: surveyError } = await supabase
        .from('encuesta')
        .select('*')
        .eq('encu_id', surveyId)
        .single();

      if (surveyError) throw surveyError;

      // Get survey questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('encuesta_pregunta')
        .select('*')
        .eq('encu_id', surveyId)
        .order('encupreg_orden');

      if (questionsError) throw questionsError;

      const surveyWithQuestions: SurveyWithQuestions = {
        ...surveyData,
        questions: questionsData
      };

      setSurvey(surveyWithQuestions);
      return surveyWithQuestions;
    } catch (error) {
      console.error('Error loading survey:', error);
      return null;
    }
  }, []);

  // Save survey mutation
  const saveMutation = useMutation({
    mutationFn: async ({ formData, surveyId, userId }: { formData: SurveyFormData, surveyId?: number, userId: number }) => {
      if (surveyId) {
        // Update existing survey
        const { error: surveyError } = await supabase
          .from('encuesta')
          .update({
            encu_titulo: formData.encu_titulo,
            encu_descripcion: formData.encu_descripcion || null,
            encu_fecha_modificacion: new Date().toISOString()
          })
          .eq('encu_id', surveyId);

        if (surveyError) throw surveyError;

        // Delete existing questions
        const { error: deleteError } = await supabase
          .from('encuesta_pregunta')
          .delete()
          .eq('encu_id', surveyId);

        if (deleteError) throw deleteError;

        // Insert updated questions
        if (formData.questions.length > 0) {
          const questionsToInsert = formData.questions.map((q, index) => ({
            encu_id: surveyId,
            encupreg_pregunta: q.encupreg_pregunta,
            encupreg_nota: q.encupreg_nota || null,
            encutiporesp_id: q.encutiporesp_id,
            encupreg_orden: index + 1,
            encupreg_escala_min: q.encupreg_escala_min || null,
            encupreg_escala_max: q.encupreg_escala_max || null
          }));

          const { error: questionsError } = await supabase
            .from('encuesta_pregunta')
            .insert(questionsToInsert);

          if (questionsError) throw questionsError;
        }

        return surveyId;
      } else {
        // Create new survey
        const { data: newSurvey, error: surveyError } = await supabase
          .from('encuesta')
          .insert({
            encu_titulo: formData.encu_titulo,
            encu_descripcion: formData.encu_descripcion || null,
            encu_creador: userId, // Use the authenticated user's ID
            est_id: SURVEY_STATUS.DRAFT
          })
          .select()
          .single();

        if (surveyError) throw surveyError;

        // Insert questions
        if (formData.questions.length > 0) {
          const questionsToInsert = formData.questions.map((q, index) => ({
            encu_id: newSurvey.encu_id,
            encupreg_pregunta: q.encupreg_pregunta,
            encupreg_nota: q.encupreg_nota || null,
            encutiporesp_id: q.encutiporesp_id,
            encupreg_orden: index + 1,
            encupreg_escala_min: q.encupreg_escala_min || null,
            encupreg_escala_max: q.encupreg_escala_max || null
          }));

          const { error: questionsError } = await supabase
            .from('encuesta_pregunta')
            .insert(questionsToInsert);

          if (questionsError) throw questionsError;
        }

        return newSurvey.encu_id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
    }
  });

  // Publish survey mutation
  const publishMutation = useMutation({
    mutationFn: async ({ formData, surveyId, userId }: { formData: SurveyFormData, surveyId?: number, userId: number }) => {
      let finalSurveyId = surveyId;

      if (!surveyId) {
        // First save the survey
        finalSurveyId = await saveMutation.mutateAsync({ formData, userId });
      } else {
        // Update existing survey
        await saveMutation.mutateAsync({ formData, surveyId, userId });
      }

      // Then publish it
      const { error } = await supabase
        .from('encuesta')
        .update({
          est_id: SURVEY_STATUS.PUBLISHED,
          encu_fecha_modificacion: new Date().toISOString()
        })
        .eq('encu_id', finalSurveyId);

      if (error) throw error;

      return finalSurveyId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
    }
  });

  const saveSurvey = async (formData: SurveyFormData, surveyId?: number, userId?: number) => {
    if (!userId) {
      throw new Error('User ID is required to save surveys');
    }
    return saveMutation.mutateAsync({ formData, surveyId, userId });
  };

  const publishSurvey = async (formData: SurveyFormData, surveyId?: number, userId?: number) => {
    if (!userId) {
      throw new Error('User ID is required to publish surveys');
    }
    return publishMutation.mutateAsync({ formData, surveyId, userId });
  };

  return {
    survey,
    questionTypes,
    isLoading: saveMutation.isPending || publishMutation.isPending,
    saveSurvey,
    publishSurvey,
    loadSurvey
  };
};
