import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PantallaAcceso from "@/components/PantallaAcceso";
import { errorDeEnlace, llegoPorRecuperacion, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { olvidarOrigen, origenRecordado } from "@/lib/recuperacion";

/** Cuánto se espera a que Supabase abra la sesión del enlace antes de darlo por malo. */
const ESPERA_ENLACE_MS = 8000;

/**
 * Pantalla del enlace del correo: fija la contraseña nueva.
 *
 * Exige evidencia de que se llegó por un enlace de recuperación (el hash, que
 * se lee al arrancar en integrations/supabase/client.ts, o el evento
 * PASSWORD_RECOVERY). Una sesión normal no basta a propósito: si valiera,
 * cualquiera que encontrara un navegador con la sesión abierta podría cambiar
 * la contraseña sin conocer la anterior. Para eso está Perfil, que sí la pide.
 *
 * Al terminar, quien lo pidió desde /inscripcion vuelve a la inscripción con
 * la sesión ya abierta; quien lo pidió desde la plataforma vuelve al login.
 */
const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [esRecuperacion, setEsRecuperacion] = useState(llegoPorRecuperacion);
  const [haySesion, setHaySesion] = useState<boolean | null>(null);
  const [seAgotoLaEspera, setSeAgotoLaEspera] = useState(false);
  const [origen] = useState(origenRecordado);

  const { updatePassword } = useAuth();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (evento === "PASSWORD_RECOVERY") setEsRecuperacion(true);
      setHaySesion(sesion !== null);
    });
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setHaySesion((actual) => actual ?? session !== null);
      if (llegoPorRecuperacion()) setEsRecuperacion(true);
    });
    const timer = setTimeout(() => setSeAgotoLaEspera(true), ESPERA_ENLACE_MS);
    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const caducado = errorDeEnlace() !== null;
  const listo = esRecuperacion && haySesion === true;
  // Enlace malo o caducado: lo dijo Supabase, se agotó la espera, o hay sesión
  // pero no es de recuperación (alguien entró a esta ruta a mano, ya logueado).
  const enlaceInvalido =
    !listo && !guardado && (caducado || seAgotoLaEspera || (!esRecuperacion && haySesion === true));

  const pedirOtro = origen === "inscripcion" ? "/forgot-password?desde=inscripcion" : "/forgot-password";

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmacion) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setGuardando(true);
    const { error: fallo } = await updatePassword(password);
    if (fallo) {
      setError(`No se pudo guardar: ${fallo.message}`);
      setGuardando(false);
      return;
    }
    // Desde la inscripción sigue con la sesión abierta y vuelve a ella. Si no,
    // se cierra: que entre con la contraseña nueva y compruebe que quedó.
    if (origen !== "inscripcion") await supabase.auth.signOut();
    olvidarOrigen();
    setGuardado(true);
    setGuardando(false);
  };

  if (guardado) {
    return (
      <PantallaAcceso titulo="Contraseña guardada">
        <div className="space-y-3 text-center text-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <p>Tu contraseña nueva quedó guardada.</p>
        </div>
        {origen === "inscripcion" ? (
          <Button asChild variant="brand" className="h-11 w-full">
            <Link to="/inscripcion">Volver a la inscripción</Link>
          </Button>
        ) : origen === "plataforma" ? (
          <Button asChild variant="brand" className="h-11 w-full">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
        ) : (
          // Abrió el correo en otro dispositivo: no sabemos de dónde venía.
          <div className="grid gap-2">
            <Button asChild variant="brand" className="h-11 w-full">
              <Link to="/inscripcion">Ir a la inscripción</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full">
              <Link to="/login">Entrar a la plataforma</Link>
            </Button>
          </div>
        )}
      </PantallaAcceso>
    );
  }

  if (enlaceInvalido) {
    return (
      <PantallaAcceso titulo="El enlace no sirve">
        <div className="space-y-3 text-center text-sm">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-600 dark:text-amber-400" />
          <p>
            {caducado
              ? "Este enlace ya caducó o ya se usó. Cada enlace sirve una sola vez y dura una hora."
              : "Este enlace no es válido."}
          </p>
          <p className="text-muted-foreground">Pide uno nuevo y usa el del correo más reciente.</p>
        </div>
        <Button asChild variant="brand" className="h-11 w-full">
          <Link to={pedirOtro}>Pedir un enlace nuevo</Link>
        </Button>
      </PantallaAcceso>
    );
  }

  if (!listo) {
    return (
      <PantallaAcceso titulo="Contraseña nueva">
        <p className="text-center text-sm text-muted-foreground">Comprobando el enlace…</p>
      </PantallaAcceso>
    );
  }

  return (
    <PantallaAcceso titulo="Contraseña nueva">
      <form onSubmit={guardar} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña nueva</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">Al menos 6 caracteres.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmacion">Repítela</Label>
          <Input
            id="confirmacion"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            className="h-11"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" variant="brand" className="h-11 w-full" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </PantallaAcceso>
  );
};

export default ResetPassword;
