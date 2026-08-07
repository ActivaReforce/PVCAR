import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle, Moon, Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Solo pide el correo y dispara el enlace de recuperación.
 *
 * Antes esta pantalla pedía correo + contraseña nueva y la escribía directo en
 * la tabla: cualquiera podía cambiarle la contraseña a cualquiera sabiendo su
 * correo. Ahora la contraseña se fija en /reset-password, y solo con el enlace
 * que llega al buzón de esa persona.
 */
const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const { requestPasswordReset } = useAuth();
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

    setIsSubmitting(true);

    try {
      // Responde igual exista o no el correo: la pantalla no puede servir para
      // averiguar quién tiene cuenta.
      const enviado = await requestPasswordReset(email);

      if (enviado) {
        setIsSuccess(true);
      } else {
        toast({
          title: "No se pudo enviar",
          description: "Revise su conexion e intentelo de nuevo",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al solicitar el enlace de recuperación:", error);
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
              {isSuccess ? "Revise su correo" : "Resetear Contraseña"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="flex flex-col items-center text-center">
                <CheckCircle className="text-green-500 h-10 w-10 sm:h-12 sm:w-12 mb-4" />
                <p className={`${isDarkMode ? "text-gray-300 mb-4" : "text-gray-600 mb-4"} text-sm sm:text-base`}>
                  Si el correo esta registrado, le enviamos un enlace para crear una
                  contraseña nueva. El enlace caduca en una hora.
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
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Le enviaremos un enlace para crear una contraseña nueva
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#FD5757] hover:bg-[#E04747] text-white dark:text-black"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Enviando enlace..." : "Enviar Enlace"}
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
