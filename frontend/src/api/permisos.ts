import { api } from '@/lib/api';

export interface Permiso {
  modulo: string;
  accion: string;
}

export interface RolConPermisos {
  rol_id: number;
  rol_nombre: string;
  rol_titulo: string;
  permisos: Permiso[];
}

export interface MatrizPermisos {
  modulos: string[];
  acciones: string[];
  roles: RolConPermisos[];
}

/**
 * La matriz entera llega en una sola llamada, con los permisos de los 7 roles.
 * Antes eran dos consultas y una recarga cada vez que se cambiaba de rol en el
 * selector; son 97 filas en total, no vale la pena pedirlas por partes.
 */
export const permisosApi = {
  matriz: () => api.get<MatrizPermisos>('/api/v1/permisos'),

  guardar: (rolId: number, permisos: Permiso[]) =>
    api.put<Permiso[]>(`/api/v1/permisos/rol/${rolId}`, { permisos }),
};
