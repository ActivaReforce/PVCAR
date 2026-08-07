import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { pathToModule, MODULE_LABELS, type Module } from '@/constants/modules';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Guardia de las rutas privadas.
 *
 * Antes esto decidia dentro de un useEffect con await: pedia la sesion, y al
 * volver preguntaba `hasPermission(modulo)` con la funcion capturada en el
 * render anterior — cuando los permisos todavia estaban vacios. El resultado
 * era siempre "no tienes permiso" y un navigate('/dashboard'), asi que
 * recargar la pagina en /usuarios te dejaba en el tablero. En /dashboard no se
 * notaba porque redirigir a donde ya estas no hace nada.
 *
 * Ahora decide en el render, con el estado actual: mientras el contexto carga
 * no se decide nada, y la redireccion es declarativa (<Navigate replace>), que
 * ademas no ensucia el historial del navegador.
 */
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, hasPermission } = useAuth();
  const location = useLocation();

  // Hasta que /me conteste no se sabe ni quien es ni que puede ver.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-foreground text-xl">Cargando…</div>
      </div>
    );
  }

  if (!user) {
    // `from` deja volver a la pagina pedida despues de iniciar sesion.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  const modulo = pathToModule(location.pathname);

  if (modulo && !hasPermission(modulo)) {
    // Si lo que falta es el propio tablero, redirigir alli seria un bucle.
    if (modulo === 'dashboard') {
      return (
        <div className="flex items-center justify-center min-h-screen p-6">
          <div className="max-w-md text-center space-y-2">
            <h1 className="text-xl font-semibold">Sin acceso</h1>
            <p className="text-muted-foreground">
              Tu rol no tiene permiso para ver ningún módulo. Pide a un administrador que revise
              tus permisos.
            </p>
          </div>
        </div>
      );
    }
    return <Navigate to="/dashboard" replace state={{ sinPermiso: MODULE_LABELS[modulo as Module] }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
