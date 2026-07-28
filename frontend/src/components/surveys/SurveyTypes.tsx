
import { Database } from "@/integrations/supabase/types";

export type Encuesta = Database['public']['Tables']['encuesta']['Row'];
export type EncuestaPregunta = Database['public']['Tables']['encuesta_pregunta']['Row'];
export type EncuestaTipoRespuesta = Database['public']['Tables']['encuesta_tipo_respuesta']['Row'];
export type Estado = Database['public']['Tables']['estado']['Row'];

// Evaluation types for consistency
export interface EvaluationParameter {
  evaparam_nombre: string;
  evaparam_nota: string;
  evaparam_intentos: number;
  evatipometo_id: number;
  evaparam_escala_min?: number;
  evaparam_escala_max?: number;
  evaparam_puntaje?: number;
}

export interface SurveyWithQuestions extends Encuesta {
  questions?: EncuestaPregunta[];
}

export interface SurveyFormData {
  encu_titulo: string;
  encu_descripcion?: string;
  questions: QuestionFormData[];
}

export interface QuestionFormData {
  encupreg_id?: number;
  encupreg_pregunta: string;
  encupreg_nota?: string;
  encutiporesp_id: number;
  encupreg_orden: number;
  encupreg_escala_min?: number;
  encupreg_escala_max?: number;
}

export const SURVEY_STATUS = {
  DRAFT: 3,
  FINISHED: 4,
  PUBLISHED: 5
} as const;

export const QUESTION_TYPES = {
  TEXT_SHORT: 1,
  PARAGRAPH: 2,
  SCALE: 3,
  DATE: 4,
  TIME: 5,
  YES_NO: 6
} as const;

export const QUESTION_TYPE_LABELS = {
  1: 'Texto Corto',
  2: 'Párrafo',
  3: 'Escala Numérica',
  4: 'Fecha',
  5: 'Hora',
  6: 'Sí / No'
} as const;
