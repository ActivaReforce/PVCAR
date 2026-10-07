
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
  onConfirm,
  userName,
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar baja</AlertDialogTitle>
          {/* El nombre llegaba por props y no se pintaba: se confirmaba a
              ciegas sobre "este usuario". */}
          <AlertDialogDescription className="break-words">
            Vas a dar de baja a <strong>{userName}</strong>. Dejará de poder entrar al sistema y
            sus asignaciones de entrenador se cerrarán. Se puede reactivar después.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Dar de baja</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
