import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDarkMode, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await login(email, password);
      if (error) {
        toast({
          title: "Error de autenticación",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Inicio de sesión exitoso",
          description: "Bienvenido a Activa Reforce",
          variant: "default"
        });
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Error inesperado",
        description: "Ha ocurrido un error. Por favor, inténtelo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      {/* Theme Toggle - Positioned absolutely */}
      <div className="absolute top-4 right-4 z-10">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={toggleTheme} 
          className={`border-2 hover:scale-105 transition-all duration-200 ${
            isDarkMode 
              ? 'bg-gray-800/50 text-white border-gray-600 hover:bg-gray-700/50 backdrop-blur-sm' 
              : 'bg-white/50 text-gray-800 border-gray-300 hover:bg-gray-100/50 backdrop-blur-sm'
          }`}
        >
          {isDarkMode ? <Sun className="mr-1 sm:mr-2 h-4 w-4" /> : <Moon className="mr-1 sm:mr-2 h-4 w-4" />}
          <span className="hidden sm:inline">
            {isDarkMode ? "Light Mode" : "Dark Mode"}
          </span>
        </Button>
      </div>

      <div className="w-full max-w-[920px] mx-4">
        {/* Centered Logo */}
        <div className="text-center mb-8">
          <h1 className="font-montserrat uppercase text-2xl tracking-wide">
            <span className="text-black dark:text-black text-7xl font-bold drop-shadow-sm" 
                  style={{
                    textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
                  }}>
              ACTIVA
            </span>{" "}
            <span className="text-7xl font-extrabold drop-shadow-sm"
                  style={{
                    background: 'linear-gradient(135deg, #8B0000 0%, #FF0000 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.2)'
                  }}>
              REFORCE
            </span>
          </h1>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden grid grid-cols-1 sm:grid-cols-2 relative">
          {/* Left Column - Form */}
          <div className="p-8 sm:p-10 relative z-10 flex flex-col justify-center">
            {/* Welcome Section */}
            <div className="mb-8">
              <h2 className="font-bold text-black dark:text-black mb-2 text-3xl text-start">
                Bienvenidos!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm text-start">
                Ingresa tus credenciales para continuar
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Correo
                </label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="Su correo aqui ..." 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="h-12 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:border-[#E00000] focus:ring-[#E00000]" 
                  disabled={isLoading} 
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Contraseña
                </label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="Su contraseña aqui ..." 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="h-12 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:border-[#E00000] focus:ring-[#E00000]" 
                  disabled={isLoading} 
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-[#E00000] hover:bg-[#C60000] text-white font-semibold dark:text-black text-base rounded-md transition-all duration-200" 
                disabled={isLoading}
              >
                {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>

              <div className="text-center">
                <Link to="/forgot-password" className="text-sm text-[#E00000] hover:underline transition-colors">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </form>
          </div>

          {/* Right Column - Illustration with Gradient Overlay */}
          <div className="relative hidden sm:block">
            <img 
              src="/Images/portada8.png" 
              alt="Athletic figure illustration" 
              className="w-full h-full object-cover" 
            />
            {/* Gradient overlay to blend with white background */}
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/10 to-white/70 dark:to-gray-800/70"></div>
            {/* Additional gradient overlay for center blending */}
            <div className="absolute -left-8 top-0 h-full w-16 bg-gradient-to-r from-white dark:from-gray-800 via-white/80 dark:via-gray-800/80 to-transparent"></div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Login;
