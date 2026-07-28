
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

interface RemoveDisciplineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  disciplineName?: string;
}

export const RemoveDisciplineDialog: React.FC<RemoveDisciplineDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  disciplineName
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Desvinculación</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Está seguro de desvincular la disciplina{disciplineName ? ` "${disciplineName}"` : ''}? Esta acción se puede revertir posteriormente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Desvincular
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
