import React from 'react';
import { MoreHorizontal, Eye, Edit2, Trash2, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UsuarioListado } from '@/api/usuarios';

interface UserActionMenuProps {
  user: UsuarioListado;
  onView: (user: UsuarioListado) => void;
  onEdit: (user: UsuarioListado) => void;
  onDelete: (user: UsuarioListado) => void;
  onReactivate: (user: UsuarioListado) => void;
  onPermanentDelete: (user: UsuarioListado) => void;
  canEdit: boolean;
  canDelete: boolean;
}

const UserActionMenu = ({
  user,
  onView,
  onEdit,
  onDelete,
  onReactivate,
  onPermanentDelete,
  canEdit,
  canDelete
}: UserActionMenuProps) => {
  const isActive = user.est_id === 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Abrir menú</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onView(user)}>
          <Eye className="mr-2 h-4 w-4" />
          Ver detalles
        </DropdownMenuItem>
        
        {canEdit && (
          <DropdownMenuItem onClick={() => onEdit(user)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
        )}
        
        {canDelete && isActive && (
          <DropdownMenuItem 
            onClick={() => onDelete(user)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Desactivar
          </DropdownMenuItem>
        )}
        
        {canDelete && !isActive && (
          <>
            <DropdownMenuItem onClick={() => onReactivate(user)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reactivar
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onPermanentDelete(user)}
              className="text-destructive focus:text-destructive"
            >
              <X className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserActionMenu;