
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, Save, Send } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SurveyHeaderProps {
  isEditing: boolean;
  onBack: () => void;
  onPreview?: () => void;
  onSave?: () => void;
  onPublish?: () => void;
  showActions?: boolean;
}

export const SurveyHeader: React.FC<SurveyHeaderProps> = ({
  isEditing,
  onBack,
  onPreview,
  onSave,
  onPublish,
  showActions = false
}) => {
  return (
    <div className="space-y-4 mb-6">
      {/* Top section with back button and title */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold">
          {isEditing ? 'Editar Encuesta' : 'Nueva Encuesta'}
        </h1>
      </div>

      {/* Action buttons section - mobile responsive */}
      {showActions && onPreview && onSave && onPublish && (
        <TooltipProvider>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={onPreview} className="w-full sm:w-auto">
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
                <Button variant="outline" onClick={onSave} className="w-full sm:w-auto">
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
                <Button onClick={onPublish} className="w-full sm:w-auto">
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
      )}
    </div>
  );
};
