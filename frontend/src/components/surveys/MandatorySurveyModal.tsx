
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useMandatorySurveys } from '@/hooks/useMandatorySurveys';
import { QUESTION_TYPES } from './SurveyTypes';

interface SurveyQuestion {
  encupreg_id: number;
  encupreg_pregunta: string;
  encupreg_nota?: string;
  encutiporesp_id: number;
  encupreg_orden: number;
  encupreg_escala_min?: number;
  encupreg_escala_max?: number;
}

interface PendingSurvey {
  encu_id: number;
  encu_titulo: string;
  encu_descripcion?: string;
  questions: SurveyQuestion[];
}

interface MandatorySurveyModalProps {
  survey: PendingSurvey;
  onComplete: () => void;
}

export const MandatorySurveyModal: React.FC<MandatorySurveyModalProps> = ({
  survey,
  onComplete
}) => {
  const { toast } = useToast();
  const { submitSurvey, isSubmitting } = useMandatorySurveys();
  const [answers, setAnswers] = useState<Record<number, any>>({});

  const handleAnswerChange = (questionId: number, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const validateAnswers = () => {
    const unansweredQuestions = survey.questions.filter(q => {
      const answer = answers[q.encupreg_id];
      
      // Handle YES_NO questions specifically - they should have a boolean value
      if (q.encutiporesp_id === QUESTION_TYPES.YES_NO) {
        return answer === undefined || answer === null;
      }
      
      // Handle other question types
      return !answer || 
        (typeof answer === 'string' && answer.trim() === '');
    });

    if (unansweredQuestions.length > 0) {
      toast({
        title: "Respuestas incompletas",
        description: "Por favor responde todas las preguntas antes de enviar.",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateAnswers()) return;

    try {
      const responses = survey.questions.map(question => {
        const answer = answers[question.encupreg_id];
        
        const response: any = {
          encupreg_id: question.encupreg_id,
          encutiporesp_id: question.encutiporesp_id
        };

        switch (question.encutiporesp_id) {
          case QUESTION_TYPES.TEXT_SHORT:
          case QUESTION_TYPES.PARAGRAPH:
            response.encurespu_texto = answer;
            break;
          case QUESTION_TYPES.SCALE:
            response.encurespu_num = parseInt(answer);
            break;
          case QUESTION_TYPES.DATE:
            response.encurespu_fecha = answer;
            break;
          case QUESTION_TYPES.TIME:
            response.encurespu_hora = answer;
            break;
          case QUESTION_TYPES.YES_NO:
            response.encurespu_sino = answer === 'true';
            break;
        }

        return response;
      });

      await submitSurvey({ surveyId: survey.encu_id, responses });
      
      toast({
        title: "Encuesta enviada",
        description: "Gracias por completar la encuesta.",
      });

      onComplete();
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar la encuesta. Inténtalo de nuevo.",
        variant: "destructive"
      });
    }
  };

  const renderQuestion = (question: SurveyQuestion) => {
    const { encupreg_id, encupreg_pregunta, encupreg_nota, encutiporesp_id } = question;

    return (
      <div key={encupreg_id} className="space-y-3 p-4 border rounded-lg bg-slate-50">
        <div>
          <Label className="text-base font-medium">{encupreg_pregunta}</Label>
          {encupreg_nota && (
            <p className="text-sm text-muted-foreground mt-1">{encupreg_nota}</p>
          )}
        </div>

        {encutiporesp_id === QUESTION_TYPES.TEXT_SHORT && (
          <Input
            value={answers[encupreg_id] || ''}
            onChange={(e) => handleAnswerChange(encupreg_id, e.target.value)}
            placeholder="Tu respuesta..."
          />
        )}

        {encutiporesp_id === QUESTION_TYPES.PARAGRAPH && (
          <Textarea
            value={answers[encupreg_id] || ''}
            onChange={(e) => handleAnswerChange(encupreg_id, e.target.value)}
            placeholder="Tu respuesta..."
            rows={4}
          />
        )}

        {encutiporesp_id === QUESTION_TYPES.SCALE && (
          <div className="space-y-2">
            <Label className="text-sm">
              Escala de {question.encupreg_escala_min} a {question.encupreg_escala_max}
            </Label>
            <RadioGroup
              value={answers[encupreg_id]?.toString() || ''}
              onValueChange={(value) => handleAnswerChange(encupreg_id, value)}
              className="flex flex-wrap gap-4"
            >
              {Array.from(
                { length: (question.encupreg_escala_max || 5) - (question.encupreg_escala_min || 1) + 1 },
                (_, i) => {
                  const value = (question.encupreg_escala_min || 1) + i;
                  return (
                    <div key={value} className="flex items-center space-x-2">
                      <RadioGroupItem value={value.toString()} id={`${encupreg_id}-${value}`} />
                      <Label htmlFor={`${encupreg_id}-${value}`}>{value}</Label>
                    </div>
                  );
                }
              )}
            </RadioGroup>
          </div>
        )}

        {encutiporesp_id === QUESTION_TYPES.DATE && (
          <Input
            type="date"
            value={answers[encupreg_id] || ''}
            onChange={(e) => handleAnswerChange(encupreg_id, e.target.value)}
          />
        )}

        {encutiporesp_id === QUESTION_TYPES.TIME && (
          <Input
            type="time"
            value={answers[encupreg_id] || ''}
            onChange={(e) => handleAnswerChange(encupreg_id, e.target.value)}
          />
        )}

        {encutiporesp_id === QUESTION_TYPES.YES_NO && (
          <RadioGroup
            value={answers[encupreg_id]?.toString() || ''}
            onValueChange={(value) => handleAnswerChange(encupreg_id, value)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id={`${encupreg_id}-yes`} />
              <Label htmlFor={`${encupreg_id}-yes`}>Sí</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id={`${encupreg_id}-no`} />
              <Label htmlFor={`${encupreg_id}-no`}>No</Label>
            </div>
          </RadioGroup>
        )}
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {survey.encu_titulo}
          </DialogTitle>
          {survey.encu_descripcion && (
            <p className="text-muted-foreground">{survey.encu_descripcion}</p>
          )}
        </DialogHeader>

        <div className="space-y-6 mt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Esta encuesta es obligatoria. Por favor completa todas las preguntas para continuar.
            </p>
          </div>

          {survey.questions.map(renderQuestion)}

          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
