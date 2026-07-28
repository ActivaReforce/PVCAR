
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SurveyFormData, QuestionFormData, EncuestaTipoRespuesta, QUESTION_TYPES } from '@/components/surveys/SurveyTypes';

export const useSurveyBuilderLogic = (
  formData: SurveyFormData,
  onFormUpdate: (updates: Partial<SurveyFormData>) => void
) => {
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

  const addQuestion = () => {
    const newQuestion: QuestionFormData = {
      encupreg_pregunta: '',
      encupreg_nota: '',
      encutiporesp_id: QUESTION_TYPES.TEXT_SHORT,
      encupreg_orden: formData.questions.length + 1
    };
    onFormUpdate({
      questions: [...formData.questions, newQuestion]
    });
  };

  const updateQuestion = (index: number, field: keyof QuestionFormData, value: any) => {
    onFormUpdate({
      questions: formData.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    });
  };

  const deleteQuestion = (index: number) => {
    onFormUpdate({
      questions: formData.questions.filter((_, i) => i !== index).map((q, i) => ({
        ...q,
        encupreg_orden: i + 1
      }))
    });
  };

  const duplicateQuestion = (index: number) => {
    const questionToDuplicate = formData.questions[index];
    const newQuestion: QuestionFormData = {
      ...questionToDuplicate,
      encupreg_id: undefined,
      encupreg_orden: formData.questions.length + 1
    };
    onFormUpdate({
      questions: [...formData.questions, newQuestion]
    });
  };

  return {
    questionTypes,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    duplicateQuestion
  };
};
