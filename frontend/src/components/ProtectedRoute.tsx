
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { pathToModule } from "@/constants/modules";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { checkSession, loading, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      const isAuthenticated = await checkSession();
      
      if (!isAuthenticated) {
        navigate("/login");
        setIsChecking(false);
        return;
      }

      // Route-level permission guard based on path → module mapping
      const module = pathToModule(location.pathname);
      if (module && !hasPermission(module)) {
        // If user lacks permission for this module, redirect to dashboard
        navigate("/dashboard");
        setIsChecking(false);
        return;
      }
      
      setIsChecking(false);
    };
    
    verifyAuth();
  }, [checkSession, navigate, location.pathname, hasPermission]);

  if (loading || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#222222]">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
