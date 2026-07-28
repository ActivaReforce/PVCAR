
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface AddQuestionButtonProps {
  onAddQuestion: () => void;
  isDisabled?: boolean;
}

export const AddQuestionButton: React.FC<AddQuestionButtonProps> = ({
  onAddQuestion,
  isDisabled = false
}) => {
  if (isDisabled) return null;

  return (
    <div className="mt-6 mb-4">
      <Button onClick={onAddQuestion} size="lg" className="w-full sm:w-auto">
        <Plus className="h-4 w-4 mr-2" />
        Agregar Pregunta
      </Button>
    </div>
  );
};
