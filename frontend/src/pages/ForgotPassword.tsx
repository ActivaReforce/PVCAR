import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PantallaAcceso from "@/components/PantallaAcceso";
import { useAuth } from "@/contexts/AuthContext";
import { recordarOrigen } from "@/lib/recuperacion";

/**
 * Solo pide el correo y dispara el enlace de recuperación.
 *
 * Antes esta pantalla pedía correo + contraseña nueva y la escribía directo en
 * la tabla: cualquiera podía cambiarle la contraseña a cualquiera sabiendo su
 * correo. Ahora la contraseña se fija en /reset-password, y solo con el enlace
 * que llega al buzón de esa persona.
 *
 * `?desde=inscripcion`: lo pidió un representante desde el formulario. No
 * conoce el login de la plataforma, así que todo le devuelve a la inscripción.
 */
const ForgotPassword = () => {
  const [params] = useSearchParams();
  const desdeInscripcion = params.get("desde") === "inscripcion";
  const volver = desdeInscripcion
    ? { a: "/inscripcion", texto: "Volver a la inscripción" }
    : { a: "/login", texto: "Volver a iniciar sesión" };

  const [correo, setCorreo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { requestPasswordReset } = useAuth();

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    recordarOrigen(desdeInscripcion ? "inscripcion" : "plataforma");
    // Responde igual exista o no el correo: la pantalla no puede servir para
    // averiguar quién tiene cuenta.
    const ok = await requestPasswordReset(correo.trim());
    setEnviando(false);
    if (ok) setEnviado(true);
    else setError("No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.");
  };

  if (enviado) {
    return (
      <PantallaAcceso titulo="Revisa tu correo">
        <div className="space-y-3 text-center text-sm">
          <MailCheck className="mx-auto h-12 w-12 text-primary" />
          <p>
            Si <strong className="break-all">{correo.trim()}</strong> tiene una cuenta, te enviamos un enlace para
            crear una contraseña nueva. Caduca en una hora.
          </p>
          <p className="text-muted-foreground">
            Si no lo ves en unos minutos, busca también en la carpeta de <strong>spam</strong> o{" "}
            <strong>correo no deseado</strong>.
          </p>
        </div>
        <Button asChild variant="outline" className="h-11 w-full">
          <Link to={volver.a}>{volver.texto}</Link>
        </Button>
      </PantallaAcceso>
    );
  }

  return (
    <PantallaAcceso titulo="Recuperar contraseña">
      <form onSubmit={enviar} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="correo">Correo electrónico</Label>
          <Input
            id="correo"
            type="email"
            autoComplete="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            {desdeInscripcion
              ? "El correo con el que te inscribiste. Te enviaremos un enlace para crear una contraseña nueva."
              : "Te enviaremos un enlace para crear una contraseña nueva."}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" variant="brand" className="h-11 w-full" disabled={enviando || !correo.trim()}>
          {enviando ? "Enviando…" : "Enviar enlace"}
        </Button>
      </form>
      <Button asChild variant="ghost" className="h-11 w-full">
        <Link to={volver.a}>{volver.texto}</Link>
      </Button>
    </PantallaAcceso>
  );
};

export default ForgotPassword;
