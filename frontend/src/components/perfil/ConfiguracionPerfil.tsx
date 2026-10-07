import { useEffect, useRef, useState } from "react";
import { Camera, KeyRound, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { subirFoto } from "@/hooks/useUsuarios";
import { perfilApi } from "@/api/perfil";
import type { UsuarioDetalle } from "@/api/usuarios";

const iniciales = (nombre: string) =>
  nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";

/**
 * Configuración del perfil (2026-10-07): foto, nombre y teléfono, y aquí
 * dentro el cambio de contraseña. El correo y la cédula se ven pero no se
 * editan: son el acceso y la identidad, y los cambia la administración. No
 * hay nada que eliminar.
 */
const ConfiguracionPerfil = ({
  abierto,
  perfil,
  onCerrar,
}: {
  abierto: boolean;
  perfil: UsuarioDetalle;
  onCerrar: () => void;
}) => {
  const { changePassword, reloadPermissions } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const archivo = useRef<HTMLInputElement>(null);

  const [nombre, setNombre] = useState(perfil.usu_nombre);
  const [telefono, setTelefono] = useState(perfil.usu_telefono ?? "");
  const [foto, setFoto] = useState<{ ruta: string; vista: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [clave, setClave] = useState({ actual: "", nueva: "", repetida: "" });
  const [guardandoClave, setGuardandoClave] = useState(false);
  const [errorClave, setErrorClave] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setNombre(perfil.usu_nombre);
    setTelefono(perfil.usu_telefono ?? "");
    setFoto(null);
    setCambiandoClave(false);
    setClave({ actual: "", nueva: "", repetida: "" });
    setErrorClave(null);
  }, [abierto, perfil]);

  const elegirFoto = async (f: File | undefined) => {
    if (!f) return;
    setSubiendo(true);
    try {
      const ruta = await subirFoto(f, perfilApi.urlDeSubida);
      setFoto({ ruta, vista: URL.createObjectURL(f) });
    } catch (e) {
      toast({ title: "No se pudo subir la foto", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubiendo(false);
    }
  };

  const cambios = {
    ...(nombre.trim() !== perfil.usu_nombre ? { usu_nombre: nombre.trim() } : {}),
    ...(telefono.trim() !== (perfil.usu_telefono ?? "") ? { usu_telefono: telefono.trim() } : {}),
    ...(foto ? { usu_foto: foto.ruta } : {}),
  };
  const hayCambios = Object.keys(cambios).length > 0;

  const guardar = async () => {
    if (nombre.trim().length < 3) {
      toast({ title: "El nombre debe tener al menos 3 caracteres", variant: "destructive" });
      return;
    }
    setGuardando(true);
    try {
      await perfilApi.actualizar(cambios);
      await queryClient.invalidateQueries({ queryKey: ["perfil"] });
      // El nombre también sale en el menú: se vuelve a pedir /me.
      await reloadPermissions();
      toast({ title: "Perfil actualizado" });
      onCerrar();
    } catch (e) {
      toast({ title: "No se pudo guardar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  };

  const guardarClave = async () => {
    setErrorClave(null);
    if (!clave.actual || !clave.nueva || !clave.repetida) return setErrorClave("Completa los tres campos.");
    if (clave.nueva.length < 6) return setErrorClave("La contraseña nueva debe tener al menos 6 caracteres.");
    if (clave.nueva !== clave.repetida) return setErrorClave("La contraseña nueva y su repetición no coinciden.");
    setGuardandoClave(true);
    const { error } = await changePassword(clave.actual, clave.nueva);
    setGuardandoClave(false);
    if (error) return setErrorClave(error.message);
    toast({ title: "Contraseña actualizada" });
    setCambiandoClave(false);
    setClave({ actual: "", nueva: "", repetida: "" });
  };

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configuración del perfil</DialogTitle>
          <DialogDescription>Tus datos de contacto y tu contraseña.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 border">
            <AvatarImage src={foto?.vista ?? perfil.usu_foto_url ?? undefined} alt="" />
            <AvatarFallback className="text-xl">{iniciales(nombre)}</AvatarFallback>
          </Avatar>
          <div>
            <input
              ref={archivo}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void elegirFoto(e.target.files?.[0])}
            />
            <Button variant="outline" className="h-11 sm:h-10" onClick={() => archivo.current?.click()} disabled={subiendo}>
              <Camera className="mr-2 h-4 w-4" />
              {subiendo ? "Subiendo…" : "Cambiar foto"}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG o WEBP.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="perfil-nombre">Nombre</Label>
            <Input id="perfil-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-11 sm:h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="perfil-telefono">Teléfono</Label>
            <Input
              id="perfil-telefono"
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="h-11 sm:h-10"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="perfil-correo" className="flex items-center gap-1">
                Correo <Lock className="h-3 w-3 text-muted-foreground" />
              </Label>
              <Input id="perfil-correo" value={perfil.usu_correo} disabled className="h-11 sm:h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="perfil-cedula" className="flex items-center gap-1">
                Cédula <Lock className="h-3 w-3 text-muted-foreground" />
              </Label>
              <Input id="perfil-cedula" value={perfil.usu_cedula ?? "—"} disabled className="h-11 sm:h-10" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            El correo es con el que entras y la cédula tu identificación: si hay que cambiarlos, pídelo a la
            administración.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="h-11 sm:h-10" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button variant="brand" className="h-11 sm:h-10" onClick={guardar} disabled={!hayCambios || guardando || subiendo}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          {!cambiandoClave ? (
            <Button variant="outline" className="h-11 w-full sm:h-10 sm:w-auto" onClick={() => setCambiandoClave(true)}>
              <KeyRound className="mr-2 h-4 w-4" />
              Cambiar contraseña
            </Button>
          ) : (
            <>
              <p className="font-medium">Cambiar contraseña</p>
              {(
                [
                  ["actual", "Contraseña actual", "current-password"],
                  ["nueva", "Contraseña nueva", "new-password"],
                  ["repetida", "Repite la contraseña nueva", "new-password"],
                ] as const
              ).map(([campo, etiqueta, auto]) => (
                <div key={campo} className="space-y-1.5">
                  <Label htmlFor={`clave-${campo}`}>{etiqueta}</Label>
                  <Input
                    id={`clave-${campo}`}
                    type="password"
                    autoComplete={auto}
                    value={clave[campo]}
                    onChange={(e) => setClave((c) => ({ ...c, [campo]: e.target.value }))}
                    className="h-11 sm:h-10"
                  />
                </div>
              ))}
              {errorClave && (
                <p role="alert" className="text-sm text-destructive">
                  {errorClave}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" className="h-11 sm:h-10" onClick={() => setCambiandoClave(false)}>
                  Cancelar
                </Button>
                <Button variant="brand" className="h-11 sm:h-10" onClick={guardarClave} disabled={guardandoClave}>
                  {guardandoClave ? "Guardando…" : "Guardar contraseña"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfiguracionPerfil;
