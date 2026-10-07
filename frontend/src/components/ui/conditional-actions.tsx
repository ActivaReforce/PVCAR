import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface ConditionalActionProps {
  module: string;
  action: 'crear' | 'editar' | 'eliminar';
  children: React.ReactNode;
}

/**
 * Pinta a sus hijos solo si el usuario tiene el permiso.
 *
 * Es una comodidad de la interfaz, **no una medida de seguridad**: quien
 * decide de verdad es el backend. Aquí solo sirve para no enseñar un botón que
 * va a dar 403.
 *
 * Para las acciones de una tarjeta o una fila está `MenuAcciones`, que ya
 * filtra por permiso y además esconde el menú entero si no queda ninguna.
 */
export const ConditionalAction = ({ module, action, children }: ConditionalActionProps) => {
  const { hasPermission } = usePermissions();

  if (!hasPermission(module, action)) {
    return null;
  }

  return <>{children}</>;
};
