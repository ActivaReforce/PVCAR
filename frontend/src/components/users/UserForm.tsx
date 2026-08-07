import { useState } from 'react';
import type { DatosUsuario, Rol, UsuarioDetalle } from '@/api/usuarios';
import BasicUserFields from './BasicUserFields';
import RoleSpecificFields from './RoleSpecificFields';
import UserPhotoSection from './UserPhotoSection';
import FormButtons from './FormButtons';
import UserRoleSelection from './UserRoleSelection';
import { useUserForm } from '@/hooks/useUserForm';
import { useActualizarUsuario, useCrearUsuario, useSubirFotoUsuario } from '@/hooks/useUsuarios';
import { useToast } from '@/hooks/use-toast';

interface UserFormProps {
  user?: UsuarioDetalle | null;
  roles: Rol[];
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Formulario de usuario.
 *
 * Antes esto disparaba hasta seis escrituras sueltas desde el navegador
 * (roles, ficha de entrenador, ficha de representante, transiciones...) y si
 * fallaba una a media faena el usuario se quedaba sin roles. Ahora manda un
 * unico POST o PATCH y el backend lo resuelve en una transaccion.
 *
 * La foto va aparte y antes: se sube a Storage con una URL firmada y lo que
 * viaja en el cuerpo es la ruta.
 */
const UserForm = ({ user, roles, onSuccess, onCancel }: UserFormProps) => {
  const { formData, handleInputChange, isEditMode, hasCoachRole, hasParentRole } = useUserForm(
    user,
    roles,
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCleared, setPhotoCleared] = useState(false);
  const { toast } = useToast();

  const crear = useCrearUsuario();
  const actualizar = useActualizarUsuario();
  const subirFoto = useSubirFotoUsuario();

  const loading = crear.isPending || actualizar.isPending || subirFoto.isPending;

  const handlePhotoChange = (file: File | null) => {
    setPhotoFile(file);
    setPhotoCleared(file === null && Boolean(user?.usu_foto));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.selectedRoles.length === 0) {
      toast({ title: 'Debe seleccionar al menos un rol', variant: 'destructive' });
      return;
    }
    if (!isEditMode && formData.usu_contrasena.length < 8) {
      toast({
        title: 'La contrasena debe tener al menos 8 caracteres',
        variant: 'destructive',
      });
      return;
    }

    let rutaFoto: string | null | undefined;
    if (photoFile) {
      try {
        rutaFoto = await subirFoto.mutateAsync(photoFile);
      } catch {
        return; // el hook ya avisa; no se guarda nada a medias
      }
    } else if (photoCleared) {
      rutaFoto = null;
    }

    const datos: DatosUsuario = {
      usu_nombre: formData.usu_nombre,
      usu_correo: formData.usu_correo,
      usu_telefono: formData.usu_telefono,
      roles: formData.selectedRoles,
      ...(hasCoachRole ? { ent_cedula: formData.ent_cedula } : {}),
      ...(hasParentRole ? { padre_sector_residencia: formData.padre_sector_residencia } : {}),
      ...(rutaFoto !== undefined ? { usu_foto: rutaFoto } : {}),
      ...(formData.usu_contrasena ? { password: formData.usu_contrasena } : {}),
    };

    try {
      if (isEditMode && user) {
        await actualizar.mutateAsync({ id: user.usu_id, datos });
      } else {
        await crear.mutateAsync(datos);
      }
      onSuccess();
    } catch {
      // El mensaje del backend ya se muestra desde el hook. Aqui solo se evita
      // cerrar el formulario para que no se pierda lo escrito.
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BasicUserFields
          formData={formData}
          isEditMode={isEditMode}
          onInputChange={handleInputChange}
        />

        <div className="space-y-4">
          <UserPhotoSection
            initialImageUrl={user?.usu_foto_url}
            onImageChange={handlePhotoChange}
          />

          <UserRoleSelection
            roles={roles}
            selectedRoles={formData.selectedRoles}
            onRoleChange={(seleccion) => handleInputChange('selectedRoles', seleccion)}
          />

          <RoleSpecificFields formData={formData} roles={roles} onInputChange={handleInputChange} />
        </div>
      </div>

      <FormButtons onCancel={onCancel} loading={loading} isEditMode={isEditMode} />
    </form>
  );
};

export default UserForm;
