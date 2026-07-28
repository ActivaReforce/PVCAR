
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

interface UserDeactivationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName: string;
}

export const UserDeactivationDialog: React.FC<UserDeactivationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Desactivación</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que quieres desactivar este usuario? Esta acción se puede revertir posteriormente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Desactivar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
