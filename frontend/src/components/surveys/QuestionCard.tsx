
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trash2, Copy } from 'lucide-react';
import { QuestionFormData, EncuestaTipoRespuesta, QUESTION_TYPES, QUESTION_TYPE_LABELS } from './SurveyTypes';

interface QuestionCardProps {
  question: QuestionFormData;
  questionTypes: EncuestaTipoRespuesta[];
  index: number;
  onUpdate: (index: number, field: keyof QuestionFormData, value: any) => void;
  onDelete: (index: number) => void;
  onDuplicate: (index: number) => void;
  isDisabled?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionTypes,
  index,
  onUpdate,
  onDelete,
  onDuplicate,
  isDisabled = false
}) => {
  const isScaleType = question.encutiporesp_id === QUESTION_TYPES.SCALE;

  return (
    <TooltipProvider>
      <Card className="mb-4 bg-slate-50/50 border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">
              Pregunta {index + 1}
            </span>
            {!isDisabled && (
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onDuplicate(index)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Duplicar pregunta</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Eliminar pregunta</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor={`question-${index}`}>Pregunta *</Label>
            <Textarea
              id={`question-${index}`}
              value={question.encupreg_pregunta}
              onChange={(e) => onUpdate(index, 'encupreg_pregunta', e.target.value)}
              placeholder="Escribe tu pregunta aquí..."
              required
              disabled={isDisabled}
              className="min-h-[80px]"
            />
          </div>

          <div>
            <Label htmlFor={`note-${index}`}>Nota (opcional)</Label>
            <Input
              id={`note-${index}`}
              value={question.encupreg_nota || ''}
              onChange={(e) => onUpdate(index, 'encupreg_nota', e.target.value)}
              placeholder="Texto de ayuda o aclaración..."
              disabled={isDisabled}
            />
          </div>

          <div>
            <Label htmlFor={`type-${index}`}>Tipo de Respuesta *</Label>
            <Select
              value={question.encutiporesp_id.toString()}
              onValueChange={(value) => onUpdate(index, 'encutiporesp_id', parseInt(value))}
              disabled={isDisabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo de respuesta" />
              </SelectTrigger>
              <SelectContent>
                {questionTypes.map((type) => (
                  <SelectItem key={type.encutiporesp_id} value={type.encutiporesp_id.toString()}>
                    {QUESTION_TYPE_LABELS[type.encutiporesp_id as keyof typeof QUESTION_TYPE_LABELS] || type.encutiporesp_nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isScaleType && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`scale-min-${index}`}>Valor Mínimo *</Label>
                <Input
                  id={`scale-min-${index}`}
                  type="number"
                  value={question.encupreg_escala_min || ''}
                  onChange={(e) => onUpdate(index, 'encupreg_escala_min', parseInt(e.target.value) || undefined)}
                  placeholder="Ej. 1"
                  required
                  disabled={isDisabled}
                />
              </div>
              <div>
                <Label htmlFor={`scale-max-${index}`}>Valor Máximo *</Label>
                <Input
                  id={`scale-max-${index}`}
                  type="number"
                  value={question.encupreg_escala_max || ''}
                  onChange={(e) => onUpdate(index, 'encupreg_escala_max', parseInt(e.target.value) || undefined)}
                  placeholder="Ej. 5"
                  required
                  disabled={isDisabled}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
