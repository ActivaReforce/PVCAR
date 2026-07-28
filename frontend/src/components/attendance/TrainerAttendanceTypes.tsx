
import { Database } from "@/integrations/supabase/types";

export type Entrenador = Database['public']['Tables']['entrenador']['Row'];
export type Usuario = Database['public']['Tables']['usuario']['Row'];
export type AsistenciaEstado = Database['public']['Tables']['asistencia_estado']['Row'];
export type Colegio = Database['public']['Tables']['colegio']['Row'];
export type Dia = Database['public']['Tables']['dia']['Row'];

export interface EntrenadorWithDetails extends Entrenador {
  usuario: Usuario;
}

export interface AuxiliaryWithDetails {
  entaux_id: number;
  usu_id: number;
  ent_id: number;
  rol_id: number;
  est_id: number;
  usuario: Usuario;
  rol: {
    rol_id: number;
    rol_nombre: string;
    rol_titulo: string;
  };
}

export type AttendanceUserType = 'trainer' | 'auxiliary';

export type AttendanceUser = 
  | { type: 'trainer'; data: EntrenadorWithDetails }
  | { type: 'auxiliary'; data: AuxiliaryWithDetails };

export interface AttendanceRowData {
  id: number; // ent_id for trainers, usu_id for auxiliaries
  userType: AttendanceUserType;
  status?: number;
  arrivalTime: string;
  justification: string;
  hasChanges: boolean;
  originalStatus?: number;
  originalArrivalTime: string;
  originalJustification: string;
}
