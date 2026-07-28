
import { SurveyFormData, QUESTION_TYPES } from './SurveyTypes';

export interface ValidationError {
  title: string;
  description: string;
}

export const validateSurveyForm = (formData: SurveyFormData): ValidationError | null => {
  if (!formData.encu_titulo.trim()) {
    return {
      title: "Error de validación",
      description: "El título es obligatorio"
    };
  }

  if (formData.questions.length === 0) {
    return {
      title: "Error de validación",
      description: "Debe agregar al menos una pregunta"
    };
  }

  for (let i = 0; i < formData.questions.length; i++) {
    const question = formData.questions[i];
    
    if (!question.encupreg_pregunta.trim()) {
      return {
        title: "Error de validación",
        description: `La pregunta ${i + 1} no puede estar vacía`
      };
    }

    if (question.encutiporesp_id === QUESTION_TYPES.SCALE) {
      if (!question.encupreg_escala_min || !question.encupreg_escala_max) {
        return {
          title: "Error de validación",
          description: `La pregunta ${i + 1} de tipo escala debe tener valores mínimo y máximo`
        };
      }

      if (question.encupreg_escala_min >= question.encupreg_escala_max) {
        return {
          title: "Error de validación",
          description: `En la pregunta ${i + 1}, el valor mínimo debe ser menor que el máximo`
        };
      }
    }
  }

  return null;
};
