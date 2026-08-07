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
      <div className="flex items-center gap-4 min-w-0">
        <Avatar className="h-20 w-20 flex-shrink-0">
          <AvatarImage src={user.usu_foto_url ?? undefined} />
          <AvatarFallback className="text-lg">{iniciales}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h3 className="text-xl font-semibold break-words">{user.usu_nombre}</h3>
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

      {/*
        Cada dato en su celda con min-w-0 y break-words. Sin eso, un correo
        largo no cabe en su columna, no se parte y acaba montandose encima del
        telefono de al lado. Las celdas de una rejilla no encogen por debajo de
        su contenido salvo que se les diga.
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { etiqueta: 'Email', valor: user.usu_correo },
          { etiqueta: 'Teléfono', valor: user.usu_telefono || '—' },
          { etiqueta: 'Fecha de creación', valor: fecha(user.usu_fecha_creacion) },
          { etiqueta: 'Última modificación', valor: fecha(user.usu_fecha_modificacion) },
          ...(esEntrenador ? [{ etiqueta: 'Cédula', valor: user.ent_cedula || '—' }] : []),
          ...(esRepresentante
            ? [{ etiqueta: 'Sector de residencia', valor: user.padre_sector_residencia || '—' }]
            : []),
        ].map(({ etiqueta, valor }) => (
          <div key={etiqueta} className="min-w-0">
            <Label className="font-semibold">{etiqueta}:</Label>
            <p className="mt-1 break-words">{valor}</p>
          </div>
        ))}
      </div>

      <DialogFooter className="mt-6">
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </div>
  );
};

export default UserDetail;
