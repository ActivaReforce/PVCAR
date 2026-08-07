import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ArrowLeft, CheckCircle, Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Se lee el hash al evaluar el módulo, no dentro del componente: supabase-js
 * consume y limpia el `#access_token=...&type=recovery` de la URL en cuanto
 * termina de inicializarse, y para entonces ya no habría nada que mirar.
 */
const HASH_INICIAL = typeof window !== "undefined" ? window.location.hash : "";
const HASH_ES_RECUPERACION = HASH_INICIAL.includes("type=recovery");

/** Cuánto se espera a que Supabase procese el enlace antes de darlo por malo. */
const ESPERA_ENLACE_MS = 5000;

/**
 * Pantalla del enlace del correo: fija la contraseña nueva.
 *
 * Exige evidencia de que se llegó por un enlace de recuperación (el hash o el
 * evento PASSWORD_RECOVERY). Una sesión normal no basta a propósito: si valiera,
 * cualquiera que encontrara un navegador con la sesión abierta podría cambiar la
 * contraseña sin conocer la anterior. Para eso está Perfil, que sí la pide.
 */
const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [esRecuperacion, setEsRecuperacion] = useState(HASH_ES_RECUPERACION);
  const [haySesion, setHaySesion] = useState<boolean | null>(null);
  const [seAgotoLaEspera, setSeAgotoLaEspera] = useState(false);

  const { updatePassword } = useAuth();
  const { toast } = useToast();
  const { isDarkMode, toggleTheme } = useTheme();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setEsRecuperacion(true);
      }
      setHaySesion(session !== null);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      setHaySesion((actual) => actual ?? session !== null);
    });

    const timer = setTimeout(() => setSeAgotoLaEspera(true), ESPERA_ENLACE_MS);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const listo = esRecuperacion && haySesion === true;
  // Enlace malo o caducado: se agotó la espera, o hay sesión pero no es de
  // recuperación (alguien entró a esta ruta a mano, ya logueado).
  const enlaceInvalido =
    !listo && !isSuccess && (seAgotoLaEspera || (!esRecuperacion && haySesion === true));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Las contraseñas no coinciden",
        description: "Vuelva a escribir la confirmación",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const { error } = await updatePassword(password);

    if (error) {
      toast({
        title: "No se pudo cambiar la contraseña",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Se cierra la sesión de recuperación: que entre con la contraseña nueva.
    // Así se comprueba de una vez que quedó bien guardada.
    await supabase.auth.signOut();
    setIsSuccess(true);
    setIsSubmitting(false);
  };

  const inputClass = `w-full ${
    isDarkMode
      ? "bg-[#333333] border-[#444444] text-white"
      : "bg-gray-50 border-gray-200 text-gray-900"
  }`;

  return (
    <div
      className={`min-h-screen flex flex-col ${isDarkMode ? "bg-[#222222] text-white" : "bg-gray-100 text-gray-800"} py-4 sm:py-8 px-4 transition-colors duration-300`}
    >
      {/* Theme Toggle in top-right */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          className={`${
            isDarkMode
              ? "bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
              : "bg-white text-gray-800 hover:bg-gray-200"
          }`}
        >
          {isDarkMode ? (
            <Sun className="mr-1 sm:mr-2 h-4 w-4" />
          ) : (
            <Moon className="mr-1 sm:mr-2 h-4 w-4" />
          )}
          <span className="hidden sm:inline">{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
        </Button>
      </div>

      <div className="w-full max-w-md mx-auto mt-12 sm:mt-20 px-4 flex flex-col items-center">
        <div className="w-full mb-6 sm:mb-8">
          <Link
            to="/login"
            className={`flex items-center gap-2 ${
              isDarkMode ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-800"
            } transition-colors text-sm sm:text-base`}
          >
            <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span>Volver al Inicio</span>
          </Link>
        </div>

        <Card
          className={`w-full ${isDarkMode ? "bg-[#2A2A2A] text-white border-gray-700" : "bg-white"} shadow-md`}
        >
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-lg sm:text-xl">
              {isSuccess ? "Contraseña actualizada" : "Nueva Contraseña"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="flex flex-col items-center text-center">
                <CheckCircle className="text-green-500 h-10 w-10 sm:h-12 sm:w-12 mb-4" />
                <p
                  className={`${isDarkMode ? "text-gray-300" : "text-gray-600"} mb-4 text-sm sm:text-base`}
                >
                  Su contraseña quedó guardada. Inicie sesion con la nueva.
                </p>
                <Button
                  asChild
                  className="w-full bg-[#FD5757] hover:bg-[#E04747] text-white dark:text-white"
                >
                  <Link to="/login">Ir al Inicio</Link>
                </Button>
              </div>
            ) : enlaceInvalido ? (
              <div className="flex flex-col items-center text-center">
                <AlertTriangle className="text-amber-500 h-10 w-10 sm:h-12 sm:w-12 mb-4" />
                <p
                  className={`${isDarkMode ? "text-gray-300" : "text-gray-600"} mb-4 text-sm sm:text-base`}
                >
                  Este enlace no es valido o ya caduco. Pida uno nuevo.
                </p>
                <Button
                  asChild
                  className="w-full bg-[#FD5757] hover:bg-[#E04747] text-white dark:text-white"
                >
                  <Link to="/forgot-password">Pedir enlace nuevo</Link>
                </Button>
              </div>
            ) : !listo ? (
              <p
                className={`text-center text-sm sm:text-base ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
              >
                Verificando el enlace...
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-1">
                    Nueva Contraseña
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Su nueva contraseña aqui ..."
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <p className={`text-xs mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                    Debe tener al menos 6 caracteres
                  </p>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium mb-1">
                    Confirmar Contraseña
                  </label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Repita la contraseña ..."
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#FD5757] hover:bg-[#E04747] text-white dark:text-black"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Guardando..." : "Guardar Contraseña"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
