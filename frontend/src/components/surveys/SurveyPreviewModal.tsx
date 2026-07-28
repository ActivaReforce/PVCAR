
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SurveyFormData } from './SurveyTypes';
import { SurveyPreviewQuestion } from './SurveyPreviewQuestion';

interface SurveyPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: SurveyFormData;
}

export const SurveyPreviewModal: React.FC<SurveyPreviewModalProps> = ({
  isOpen,
  onClose,
  formData
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Vista Previa de la Encuesta</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-2xl font-bold">{formData.encu_titulo}</h2>
              {formData.encu_descripcion && (
                <p className="text-muted-foreground mt-2">
                  {formData.encu_descripcion}
                </p>
              )}
            </div>

            <div className="space-y-4">
              {formData.questions.map((question, index) => (
                <SurveyPreviewQuestion
                  key={index}
                  question={question}
                  index={index}
                />
              ))}
            </div>

            <div className="flex justify-center pt-4">
              <Button size="lg">
                Enviar Respuestas
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
