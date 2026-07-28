
import { useAuth } from '@/contexts/AuthContext';

export const usePermissions = () => {
  const { hasPermission, permissionMap } = useAuth();
  
  return {
    canView: (modulo: string) => hasPermission(modulo, 'ver'),
    canCreate: (modulo: string) => {
      return hasPermission(modulo, 'crear');
    },
    canEdit: (modulo: string) => hasPermission(modulo, 'editar'),
    canDelete: (modulo: string) => hasPermission(modulo, 'eliminar'),
    hasPermission,
  };
};
