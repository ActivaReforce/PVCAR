
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MoreHorizontal, Edit, Trash2, Eye, Send, Square } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SurveyWithQuestions } from './SurveyTypes';
import { PublishConfirmationDialog } from './PublishConfirmationDialog';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { FinalizeConfirmationDialog } from './FinalizeConfirmationDialog';

interface SurveyActionMenuProps {
  survey: SurveyWithQuestions;
  onEdit: (surveyId: number) => void;
  onDelete: (surveyId: number) => void;
  onPreview: (survey: SurveyWithQuestions) => void;
  onPublish: (surveyId: number) => void;
  onFinalize: (surveyId: number) => void;
}

export const SurveyActionMenu: React.FC<SurveyActionMenuProps> = ({
  survey,
  onEdit,
  onDelete,
  onPreview,
  onPublish,
  onFinalize
}) => {
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);

  const isPublished = survey.est_id === 5;
  const isFinalized = survey.est_id === 4;
  const canEdit = !isPublished && !isFinalized;

  const handlePublishConfirm = () => {
    onPublish(survey.encu_id);
    setPublishDialogOpen(false);
  };

  const handleDeleteConfirm = () => {
    onDelete(survey.encu_id);
    setDeleteDialogOpen(false);
  };

  const handleFinalizeConfirm = () => {
    onFinalize(survey.encu_id);
    setFinalizeDialogOpen(false);
  };

  const renderMobileActions = () => {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="p-1 sm:hidden"
            aria-label="Más acciones"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </SheetTrigger>

        <SheetContent side="bottom" className="p-4 space-y-2 sm:hidden">
          <div className="text-lg font-semibold mb-4">
            Acciones para {survey.encu_titulo}
          </div>
          
          <Button 
            variant="outline" 
            className="w-full justify-start" 
            onClick={() => onPreview(survey)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Vista previa
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full justify-start" 
            onClick={() => onEdit(survey.encu_id)}
            disabled={!canEdit}
          >
            <Edit className="h-4 w-4 mr-2" />
            {!canEdit ? 'Editar (no disponible)' : 'Editar encuesta'}
          </Button>

          {!isPublished && !isFinalized && (
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => setPublishDialogOpen(true)}
            >
              <Send className="h-4 w-4 mr-2" />
              Publicar
            </Button>
          )}

          {isPublished && (
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => setFinalizeDialogOpen(true)}
            >
              <Square className="h-4 w-4 mr-2" />
              Finalizar
            </Button>
          )}
          
          <Button 
            variant="destructive" 
            className="w-full justify-start" 
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar encuesta
          </Button>
        </SheetContent>
      </Sheet>
    );
  };

  const renderDesktopActions = () => {
    return (
      <div className="hidden sm:flex gap-2 justify-end">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={() => onPreview(survey)}>
              <Eye className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Vista previa</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={() => onEdit(survey.encu_id)} disabled={!canEdit}>
              <Edit className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{!canEdit ? 'No se puede editar' : 'Editar encuesta'}</p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-background">
            {!isPublished && !isFinalized && (
              <>
                <DropdownMenuItem onClick={() => setPublishDialogOpen(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Publicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            
            {isPublished && (
              <>
                <DropdownMenuItem onClick={() => setFinalizeDialogOpen(true)}>
                  <Square className="h-4 w-4 mr-2" />
                  Finalizar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            
            <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-red-600 focus:text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <>
        {renderMobileActions()}
        {renderDesktopActions()}

        <PublishConfirmationDialog
          isOpen={publishDialogOpen}
          onClose={() => setPublishDialogOpen(false)}
          onConfirm={handlePublishConfirm}
        />

        <DeleteConfirmationDialog
          isOpen={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleDeleteConfirm}
        />

        <FinalizeConfirmationDialog
          isOpen={finalizeDialogOpen}
          onClose={() => setFinalizeDialogOpen(false)}
          onConfirm={handleFinalizeConfirm}
        />
      </>
    </TooltipProvider>
  );
};
