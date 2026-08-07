import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DialogFooter } from '@/components/ui/dialog';
import type { UsuarioDetalle } from '@/api/usuarios';
import { ROL } from '@/hooks/useUserForm';

interface UserDetailProps {
  user: UsuarioDetalle;
  onClose: () => void;
}

/**
 * Ficha de solo lectura.
 *
 * Ya no consulta nada: la cedula del entrenador y el sector del representante
 * vienen en la misma respuesta de GET /usuarios/:id. Antes eran dos consultas
 * sueltas a Supabase por cada vez que se abria el modal, y una de las dos
 * estaba mal (buscaba padre por padre_id usando el usu_id).
 */
const UserDetail = ({ user, onClose }: UserDetailProps) => {
  const iniciales = user.usu_nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const esEntrenador = user.roles.some((r) => r.rol_id === ROL.ENTRENADOR);
  const esRepresentante = user.roles.some((r) => r.rol_id === ROL.REPRESENTANTE);

  const fecha = (valor: string | null) =>
    valor ? new Date(valor).toLocaleDateString() : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.usu_foto_url ?? undefined} />
          <AvatarFallback className="text-lg">{iniciales}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-xl font-semibold">{user.usu_nombre}</h3>
          <div className="flex flex-wrap gap-1 mt-2">
            {user.roles.length > 0 ? (
              user.roles.map((rol) => (
                <Badge key={rol.rol_id} variant="secondary">
                  {rol.rol_titulo}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">Sin roles</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="font-semibold">Email:</Label>
          <p className="mt-1">{user.usu_correo}</p>
        </div>

        <div>
          <Label className="font-semibold">Teléfono:</Label>
          <p className="mt-1">{user.usu_telefono || '—'}</p>
        </div>

        <div>
          <Label className="font-semibold">Fecha de creación:</Label>
          <p className="mt-1">{fecha(user.usu_fecha_creacion)}</p>
        </div>

        <div>
          <Label className="font-semibold">Última modificación:</Label>
          <p className="mt-1">{fecha(user.usu_fecha_modificacion)}</p>
        </div>

        {esEntrenador && (
          <div>
            <Label className="font-semibold">Cédula:</Label>
            <p className="mt-1">{user.ent_cedula || '—'}</p>
          </div>
        )}

        {esRepresentante && (
          <div>
            <Label className="font-semibold">Sector de Residencia:</Label>
            <p className="mt-1">{user.padre_sector_residencia || '—'}</p>
          </div>
        )}
      </div>

      <DialogFooter className="mt-6">
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </div>
  );
};

export default UserDetail;
