
import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, Eye, Send } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SurveyActionsProps {
  onSave: () => void;
  onPublish: () => void;
  onPreview: () => void;
  isVisible?: boolean;
}

export const SurveyActions: React.FC<SurveyActionsProps> = ({
  onSave,
  onPublish,
  onPreview,
  isVisible = true
}) => {
  if (!isVisible) return null;

  return (
    <TooltipProvider>
      <div className="flex gap-4 justify-end">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" onClick={onPreview}>
              <Eye className="h-4 w-4 mr-2" />
              Previsualizar
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Vista previa de la encuesta</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" onClick={onSave}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Guardar como borrador</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onPublish}>
              <Send className="h-4 w-4 mr-2" />
              Publicar
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Publicar encuesta</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
