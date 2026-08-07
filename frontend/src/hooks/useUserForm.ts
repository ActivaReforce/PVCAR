import { useEffect, useState } from 'react';
import type { Rol, UsuarioDetalle } from '@/api/usuarios';

/**
 * Estado del formulario de usuario.
 *
 * Ya no consulta nada. Antes este hook disparaba tres consultas sueltas a
 * Supabase al abrir el formulario (roles del usuario, ficha de entrenador y
 * ficha de representante) ademas de la de colegio_coordinador. Todo eso viene
 * ahora en la ficha que devuelve GET /usuarios/:id, en una sola llamada.
 */

export interface DatosFormularioUsuario {
  usu_nombre: string;
  usu_correo: string;
  usu_telefono: string;
  usu_contrasena: string;
  selectedRoles: number[];
  ent_cedula: string;
  padre_sector_residencia: string;
}

/** Ids del catalogo. Nada de comparar por nombre de rol, como hacia el viejo. */
export const ROL = {
  PROPIETARIO: 1,
  COORDINADOR: 2,
  ENTRENADOR: 3,
  REPRESENTANTE: 4,
  ADMIN: 5,
  ASISTENTE: 6,
  RESPALDO_ENTRENADOR: 7,
} as const;

const VACIO: DatosFormularioUsuario = {
  usu_nombre: '',
  usu_correo: '',
  usu_telefono: '',
  usu_contrasena: '',
  selectedRoles: [],
  ent_cedula: '',
  padre_sector_residencia: '',
};

function desdeDetalle(usuario: UsuarioDetalle): DatosFormularioUsuario {
  return {
    usu_nombre: usuario.usu_nombre,
    usu_correo: usuario.usu_correo,
    usu_telefono: usuario.usu_telefono ?? '',
    usu_contrasena: '',
    selectedRoles: usuario.roles.map((r) => r.rol_id),
    ent_cedula: usuario.ent_cedula ?? '',
    padre_sector_residencia: usuario.padre_sector_residencia ?? '',
  };
}

export const useUserForm = (usuario?: UsuarioDetalle | null, _roles: Rol[] = []) => {
  const [formData, setFormData] = useState<DatosFormularioUsuario>(
    usuario ? desdeDetalle(usuario) : VACIO,
  );

  const isEditMode = Boolean(usuario);

  useEffect(() => {
    setFormData(usuario ? desdeDetalle(usuario) : VACIO);
  }, [usuario]);

  const hasCoachRole = formData.selectedRoles.includes(ROL.ENTRENADOR);
  const hasParentRole = formData.selectedRoles.includes(ROL.REPRESENTANTE);

  const handleInputChange = (field: string, value: string | number[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }) as DatosFormularioUsuario);
  };

  return {
    formData,
    setFormData,
    handleInputChange,
    isEditMode,
    hasCoachRole,
    hasParentRole,
  };
};
