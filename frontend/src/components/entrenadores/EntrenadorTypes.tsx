
import { Database } from "@/integrations/supabase/types";

export type Usuario = Database['public']['Tables']['usuario']['Row'];
export type Entrenador = Database['public']['Tables']['entrenador']['Row'];

export interface EntrenadorWithDetails extends Entrenador {
  usuario: Usuario;
  colegios: string[];
  disciplinas_count: number;
  auxiliares_count: number;
  disciplinas: Array<{
    colegio_nombre: string;
    actividad_nombre: string;
    dia_nombre: string;
    hora_inicio: string | null;
    hora_fin: string | null;
  }>;
}
