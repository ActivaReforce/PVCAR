
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface ConditionalActionProps {
  module: string;
  action: 'crear' | 'editar' | 'eliminar';
  children: React.ReactNode;
}

export const ConditionalAction = ({ module, action, children }: ConditionalActionProps) => {
  const { hasPermission } = usePermissions();
  const permission = hasPermission(module, action);

  if (!permission) {
    return null;
  }

  return <>{children}</>;
};

interface ConditionalActionsProps {
  module: string;
  onEdit?: () => void;
  onDelete?: () => void;
  editButton?: React.ReactNode;
  deleteButton?: React.ReactNode;
  children?: React.ReactNode;
}

export const ConditionalActions = ({ 
  module, 
  onEdit, 
  onDelete, 
  editButton, 
  deleteButton,
  children 
}: ConditionalActionsProps) => {
  const { canEdit, canDelete } = usePermissions();
  
  return (
    <div className="flex items-center gap-2">
      {children}
      {canEdit(module) && (editButton || (onEdit && (
        <button onClick={onEdit} className="text-blue-600 hover:text-blue-800">
          Editar
        </button>
      )))}
      {canDelete(module) && (deleteButton || (onDelete && (
        <button onClick={onDelete} className="text-red-600 hover:text-red-800">
          Eliminar
        </button>
      )))}
    </div>
  );
};
