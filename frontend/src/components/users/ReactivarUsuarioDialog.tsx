import { useState } from 'react';
import { KeyRound, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useReactivarUsuario } from '@/hooks/useUsuarios';
import type { UsuarioListado } from '@/api/usuarios';

interface Props {
  usuario: UsuarioListado | null;
  onClose: () => void;
  onReactivado: () => void;
}

/**
 * Reactivar un usuario.
 *
 * Confirmación simple, pero con un caso que no lo es: **los 23 usuarios
 * inactivos de la carga no tienen cuenta de Supabase Auth**. El backfill del
 * cutover solo creó las de los activos, porque una cuenta que nadie usa es una
 * cuenta de más, y el `CHECK` de la base no admite un usuario activo sin ella.
 *
 * Antes eso era un callejón sin salida: el backend decía "créale una cuenta
 * primero" y no había ninguna pantalla donde hacerlo. Ahora la contraseña se
 * pide aquí y la cuenta se crea en el mismo gesto.
 */
const ReactivarUsuarioDialog = ({ usuario, onClose, onReactivado }: Props) => {
  const [password, setPassword] = useState('');
  const reactivar = useReactivarUsuario();

  const necesitaPassword = usuario ? !usuario.tiene_acceso : false;
  const passwordValida = password.length >= 8;

  const cerrar = () => {
    setPassword('');
    onClose();
  };

  const confirmar = async () => {
    if (!usuario) return;
    try {
      await reactivar.mutateAsync({
        id: usuario.usu_id,
        password: necesitaPassword ? password : undefined,
      });
      setPassword('');
      onReactivado();
    } catch {
      // El hook ya muestra el motivo; el modal se queda abierto.
    }
  };

  return (
    <Dialog open={Boolean(usuario)} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Reactivar usuario
          </DialogTitle>
          <DialogDescription className="break-words">
            <strong>{usuario?.usu_nombre}</strong> volverá a estar activo y podrá entrar al
            sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Si era entrenador, su ficha vuelve a activa. Las disciplinas que tenía asignadas{' '}
            <strong>no</strong> se reabren: se le vuelven a asignar desde Entrenadores.
          </p>

          {necesitaPassword && (
            <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="flex items-start gap-2">
                <KeyRound className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  Este usuario <strong>no tiene cuenta de acceso</strong>. Se le creará ahora con
                  la contraseña que pongas; podrá entrar con su correo{' '}
                  <strong>{usuario?.usu_correo}</strong>.
                </span>
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="password-reactivar">Contraseña (mínimo 8 caracteres)</Label>
                <Input
                  id="password-reactivar"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            variant="brand"
            onClick={confirmar}
            disabled={reactivar.isPending || (necesitaPassword && !passwordValida)}
          >
            {reactivar.isPending ? 'Reactivando…' : 'Reactivar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReactivarUsuarioDialog;
