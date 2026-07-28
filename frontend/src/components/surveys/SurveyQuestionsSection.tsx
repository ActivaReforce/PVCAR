
import React from 'react';
import { QuestionCard } from './QuestionCard';
import { SurveyFormData, QuestionFormData, EncuestaTipoRespuesta } from './SurveyTypes';

interface SurveyQuestionsSectionProps {
  formData: SurveyFormData;
  questionTypes: EncuestaTipoRespuesta[];
  onUpdateQuestion: (index: number, field: keyof QuestionFormData, value: any) => void;
  onDeleteQuestion: (index: number) => void;
  onDuplicateQuestion: (index: number) => void;
  isDisabled?: boolean;
}

export const SurveyQuestionsSection: React.FC<SurveyQuestionsSectionProps> = ({
  formData,
  questionTypes,
  onUpdateQuestion,
  onDeleteQuestion,
  onDuplicateQuestion,
  isDisabled = false
}) => {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Preguntas</h2>
      </div>

      {formData.questions.map((question, index) => (
        <QuestionCard
          key={index}
          question={question}
          questionTypes={questionTypes}
          index={index}
          onUpdate={onUpdateQuestion}
          onDelete={onDeleteQuestion}
          onDuplicate={onDuplicateQuestion}
          isDisabled={isDisabled}
        />
      ))}
    </div>
  );
};
