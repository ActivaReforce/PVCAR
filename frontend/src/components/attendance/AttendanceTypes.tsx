
import { Database } from "@/integrations/supabase/types";

export type Colegio = Database['public']['Tables']['colegio']['Row'];
export type Dia = Database['public']['Tables']['dia']['Row'];
export type ColegioActividadHorario = Database['public']['Tables']['colegio_actividad_horario']['Row'];
export type Actividad = Database['public']['Tables']['actividad']['Row'];
export type Nino = Database['public']['Tables']['nino']['Row'];
export type AsistenciaEstado = Database['public']['Tables']['asistencia_estado']['Row'];

export interface DisciplineWithDetails extends ColegioActividadHorario {
  actividad: Actividad;
  dia: Dia;
}

export interface ChildWithAttendance {
  nino: Nino;
  attendance?: {
    asisnino_id: number;
    asisest_id: number;
    asisnino_hora_tarde?: string;
    asisnino_razon_justificado?: string;
    usu_registrador: number;
    asisnino_fecha_registrado: string;
  };
}
