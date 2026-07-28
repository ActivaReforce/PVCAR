
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PublishConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const PublishConfirmationDialog: React.FC<PublishConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Publicación</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Seguro quiere publicar? Esta encuesta estará pública para los representantes y no se podrá modificar más.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Publicar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
