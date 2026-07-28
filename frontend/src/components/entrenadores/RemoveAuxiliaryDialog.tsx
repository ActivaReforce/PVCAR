
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

interface RemoveAuxiliaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  auxiliaryName?: string;
}

export const RemoveAuxiliaryDialog: React.FC<RemoveAuxiliaryDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  auxiliaryName
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Remoción</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que quieres remover a{auxiliaryName ? ` "${auxiliaryName}"` : ' este auxiliar'} del entrenador? Esta acción se puede revertir posteriormente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
