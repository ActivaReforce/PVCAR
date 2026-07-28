import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { QuestionFormData, QUESTION_TYPES } from './SurveyTypes';
interface SurveyPreviewQuestionProps {
  question: QuestionFormData;
  index: number;
}
export const SurveyPreviewQuestion: React.FC<SurveyPreviewQuestionProps> = ({
  question,
  index
}) => {
  const [value, setValue] = useState<string>('');
  const [selectedScale, setSelectedScale] = useState<string>('');
  const [yesNoValue, setYesNoValue] = useState<string>('');
  const renderQuestionInput = () => {
    switch (question.encutiporesp_id) {
      case QUESTION_TYPES.TEXT_SHORT:
        return <Input value={value} onChange={e => setValue(e.target.value)} placeholder="Tu respuesta..." className="mt-2" />;
      case QUESTION_TYPES.PARAGRAPH:
        return <Textarea value={value} onChange={e => setValue(e.target.value)} placeholder="Tu respuesta..." className="mt-2 min-h-[100px]" />;
      case QUESTION_TYPES.SCALE: {
        const min = question.encupreg_escala_min || 1;
        const max = question.encupreg_escala_max || 5;
        return <div className="mt-2">
            
            <RadioGroup value={selectedScale} onValueChange={setSelectedScale} className="flex justify-between">
              {Array.from({
              length: max - min + 1
            }, (_, i) => {
              const value = min + i;
              return <div key={value} className="flex flex-col items-center space-y-2">
                    <RadioGroupItem value={value.toString()} id={`scale-${index}-${value}`} />
                    <Label htmlFor={`scale-${index}-${value}`} className="text-sm">
                      {value}
                    </Label>
                  </div>;
            })}
            </RadioGroup>
          </div>;
      }
      case QUESTION_TYPES.DATE:
        return <Input type="date" value={value} onChange={e => setValue(e.target.value)} className="mt-2" />;
      case QUESTION_TYPES.TIME:
        return <Input type="time" value={value} onChange={e => setValue(e.target.value)} className="mt-2" />;
      case QUESTION_TYPES.YES_NO:
        return <RadioGroup value={yesNoValue} onValueChange={setYesNoValue} className="mt-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id={`yes-${index}`} />
              <Label htmlFor={`yes-${index}`}>Sí</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id={`no-${index}`} />
              <Label htmlFor={`no-${index}`}>No</Label>
            </div>
          </RadioGroup>;
      default:
        return <Input value={value} onChange={e => setValue(e.target.value)} placeholder="Tu respuesta..." className="mt-2" />;
    }
  };
  return <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">
              {index + 1}. {question.encupreg_pregunta}
            </h3>
            {question.encupreg_nota && <p className="text-sm text-muted-foreground mt-1">
                {question.encupreg_nota}
              </p>}
          </div>
          {renderQuestionInput()}
        </div>
      </CardContent>
    </Card>;
};