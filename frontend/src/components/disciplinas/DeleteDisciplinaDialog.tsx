
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

interface DeleteDisciplinaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  disciplinaName?: string;
}

export const DeleteDisciplinaDialog: React.FC<DeleteDisciplinaDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  disciplinaName
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que quieres eliminar esta disciplina{disciplinaName ? ` "${disciplinaName}"` : ''}? Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
