import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle, Moon, Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { resetPassword } = useAuth();
  const { toast } = useToast();
  const { isDarkMode, toggleTheme } = useTheme();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Ingrese su Correo",
        description: "Por favor ingrese su correo electronico",
        variant: "destructive",
      });
      return;
    }
    
    if (!newPassword) {
      toast({
        title: "Ingrese su Contraseña",
        description: "Por favor ingrese su contraseña",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({
        title: "Contraseña muy simple",
        description: "Contraseña debe contener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const success = await resetPassword(email, newPassword);
      
      if (success) {
        setIsSuccess(true);
      }
    } catch (error) {
      console.error("Error al resetear la contraseña:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div 
      className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-[#222222] text-white' : 'bg-gray-100 text-gray-800'} py-4 sm:py-8 px-4 transition-colors duration-300`}
      style={{
        backgroundImage: isDarkMode ? 
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23333333' fill-opacity='0.4'%3E%3Cpath opacity='.5' d='M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" :
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23dddddd' fill-opacity='0.4'%3E%3Cpath opacity='.5' d='M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
      }}
    >
      {/* Theme Toggle in top-right */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={toggleTheme}
          className={`${isDarkMode 
            ? 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600' 
            : 'bg-white text-gray-800 hover:bg-gray-200'}`}
        >
          {isDarkMode ? 
            <Sun className="mr-1 sm:mr-2 h-4 w-4" /> : 
            <Moon className="mr-1 sm:mr-2 h-4 w-4" />
          }
          <span className="hidden sm:inline">{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
        </Button>
      </div>
      
      <div className="w-full max-w-md mx-auto mt-12 sm:mt-20 px-4 flex flex-col items-center">
        <div className="w-full mb-6 sm:mb-8">
          <Link to="/login" className={`flex items-center gap-2 ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors text-sm sm:text-base`}>
            <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span>Volver al Inicio</span>
          </Link>
        </div>
        
        <Card className={`w-full ${isDarkMode ? 'bg-[#2A2A2A] text-white border-gray-700' : 'bg-white'} shadow-md`}>
          <CardHeader className={`${isSuccess ? "pb-4" : "pb-1"}`}>
            <CardTitle className="text-center text-lg sm:text-xl">
              {isSuccess ? "Cambio de contraseña exitoso" : "Resetear Contraseña"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="flex flex-col items-center text-center">
                <CheckCircle className="text-green-500 h-10 w-10 sm:h-12 sm:w-12 mb-4" />
                <p className={`${isDarkMode ? "text-gray-300 mb-4" : "text-gray-600 mb-4"} text-sm sm:text-base`}>
                  Su contraseña fue reseteada exitosamente. Puede iniciar sesion.
                </p>
                <Button 
                  asChild 
                  className="w-full bg-[#FD5757] hover:bg-[#E04747] text-white dark:text-white"
                >
                  <Link to="/login">Ir al Inicio</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    Correo
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full ${isDarkMode 
                      ? 'bg-[#333333] border-[#444444] text-white' 
                      : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                    placeholder="Su correo aqui ..."
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium mb-1">
                    Nueva Contraseña
                  </label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full ${isDarkMode 
                      ? 'bg-[#333333] border-[#444444] text-white' 
                      : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                    placeholder="Su nueva contraseña aqui ..."
                    required
                    minLength={6}
                  />
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Contraseña debe contener al menos 6 caracteres
                  </p>
                </div>
                
                <Button
                  type="submit"
                  className="w-full bg-[#FD5757] hover:bg-[#E04747] text-white dark:text-black"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Reseteando contraseña..." : "Resetear Contraseña"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
