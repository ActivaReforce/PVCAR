
/**
 * Local, lightweight interfaces to decouple from Supabase Database types.
 * Keep only the fields we actually use in the UI.
 */

export interface Usuario {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  usu_telefono?: string | null;
  usu_foto?: string | null;
  est_id?: number;
}

export interface Rol {
  rol_id: number;
  rol_nombre: string;
  rol_titulo: string;
}

export interface EntrenadorAuxiliar {
  entaux_id: number;
  ent_id: number;
  usu_id: number;
  rol_id: number;
  est_id: number;
}

export interface AuxiliaryTrainerWithDetails extends EntrenadorAuxiliar {
  usuario: Usuario;
  rol: Rol;
}

export interface AvailableAuxiliary extends Usuario {
  rol: Rol;
}
