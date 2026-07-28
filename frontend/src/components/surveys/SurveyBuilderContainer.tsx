
import React from 'react';
import { SurveyFormData } from './SurveyTypes';
import { SurveyGeneralInfo } from './SurveyGeneralInfo';
import { SurveyQuestionsSection } from './SurveyQuestionsSection';
import { SurveyStatusAlert } from './SurveyStatusAlert';
import { AddQuestionButton } from './AddQuestionButton';
import { useSurveyBuilderLogic } from '../../hooks/useSurveyBuilderLogic';

interface SurveyBuilderContainerProps {
  isEditing: boolean;
  surveyId?: string;
  isPublished: boolean;
  formData: SurveyFormData;
  onFormUpdate: (updates: Partial<SurveyFormData>) => void;
  onSave: () => void;
  onPublish: () => void;
  onPreview: () => void;
}

export const SurveyBuilderContainer: React.FC<SurveyBuilderContainerProps> = ({
  isPublished,
  formData,
  onFormUpdate
}) => {
  const {
    questionTypes,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    duplicateQuestion
  } = useSurveyBuilderLogic(formData, onFormUpdate);

  return (
    <div className="space-y-6">
      <SurveyGeneralInfo
        formData={formData}
        onUpdate={onFormUpdate}
        isDisabled={isPublished}
      />

      <div className="space-y-4">
        <SurveyQuestionsSection
          formData={formData}
          questionTypes={questionTypes}
          onUpdateQuestion={updateQuestion}
          onDeleteQuestion={deleteQuestion}
          onDuplicateQuestion={duplicateQuestion}
          isDisabled={isPublished}
        />

        <AddQuestionButton
          onAddQuestion={addQuestion}
          isDisabled={isPublished}
        />
      </div>

      <SurveyStatusAlert isPublished={isPublished} />
    </div>
  );
};
