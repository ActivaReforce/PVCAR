import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useVisibilityAwareRefetchInterval } from './useVisibilityAwareQuery';

export interface AttendanceStats {
  presente: number;
  ausente: number;
  tarde: number;
  justificado: number;
}

export interface ColegioItem {
  col_id: number;
  col_nombre: string;
}

export interface PerColegioCount {
  col_id: number;
  col_nombre: string;
  count: number;
}

export interface CoordinatorDashboardData {
  colegios: ColegioItem[];
  disciplinasPorColegio: PerColegioCount[];
  estudiantesPorColegio: PerColegioCount[];
  evaluacionesAsignadas: number;
  asistenciaEstudiantes: AttendanceStats;
  asistenciaEntrenadores: AttendanceStats;
}

const calculateAttendancePercentages = (stats: Record<number, number>, total: number): AttendanceStats => {
  if (total === 0) {
    return { presente: 0, ausente: 0, tarde: 0, justificado: 0 };
  }
  return {
    presente: Math.round(((stats[1] || 0) / total) * 100),
    ausente: Math.round(((stats[2] || 0) / total) * 100),
    tarde: Math.round(((stats[3] || 0) / total) * 100),
    justificado: Math.round(((stats[4] || 0) / total) * 100),
  };
};

export const useCoordinatorDashboardData = () => {
  const { user } = useAuth();
  const userId = user?.usu_id;
  const refetchInterval = useVisibilityAwareRefetchInterval(60000); // 60s, paused when hidden

  return useQuery({
    queryKey: ['coordinator-dashboard', userId],
    enabled: !!userId,
    queryFn: async (): Promise<CoordinatorDashboardData> => {
      // 1) Find colegios coordinated by the current user
      const { data: coordRows, error: coordError } = await supabase
        .from('colegio_coordinador')
        .select('col_id')
        .eq('usu_id', userId as number);

      if (coordError) {
        console.error('Error fetching coordinator colegios:', coordError);
        throw coordError;
      }

      const colIds = (coordRows || []).map(r => r.col_id).filter((v): v is number => typeof v === 'number');

      if (colIds.length === 0) {
        // No colegios assigned — return zeros and empty lists
        return {
          colegios: [],
          disciplinasPorColegio: [],
          estudiantesPorColegio: [],
          evaluacionesAsignadas: 0,
          asistenciaEstudiantes: { presente: 0, ausente: 0, tarde: 0, justificado: 0 },
          asistenciaEntrenadores: { presente: 0, ausente: 0, tarde: 0, justificado: 0 },
        };
      }

      // 2) Fetch colegios names
      const { data: colegiosData, error: colegiosError } = await supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .in('col_id', colIds);

      if (colegiosError) {
        console.error('Error fetching colegios details:', colegiosError);
        throw colegiosError;
      }

      const colegios: ColegioItem[] = (colegiosData || []).map(c => ({
        col_id: c.col_id as number,
        col_nombre: c.col_nombre as string,
      }));

      // Helper to map col_id -> col_nombre
      const colNameById = new Map<number, string>(colegios.map(c => [c.col_id, c.col_nombre]));

      // 3) Disciplinas (active only) per colegio
      const { data: disciplinasRows, error: disciplinasError } = await supabase
        .from('colegio_actividad_horario')
        .select('col_id')
        .in('col_id', colIds)
        .eq('est_id', 1);

      if (disciplinasError) {
        console.error('Error fetching disciplinas:', disciplinasError);
        throw disciplinasError;
      }

      const disciplinasCountByCol: Record<number, number> = {};
      (disciplinasRows || []).forEach((row: any) => {
        const colId = row.col_id as number;
        disciplinasCountByCol[colId] = (disciplinasCountByCol[colId] || 0) + 1;
      });

      const disciplinasPorColegio: PerColegioCount[] = colIds.map(colId => ({
        col_id: colId,
        col_nombre: colNameById.get(colId) || `Colegio ${colId}`,
        count: disciplinasCountByCol[colId] || 0,
      }));

      // 4) Estudiantes (active only) per colegio
      const { data: estudiantesRows, error: estudiantesError } = await supabase
        .from('nino')
        .select('col_id')
        .in('col_id', colIds)
        .eq('est_id', 1);

      if (estudiantesError) {
        console.error('Error fetching estudiantes:', estudiantesError);
        throw estudiantesError;
      }

      const estudiantesCountByCol: Record<number, number> = {};
      (estudiantesRows || []).forEach((row: any) => {
        const colId = row.col_id as number;
        estudiantesCountByCol[colId] = (estudiantesCountByCol[colId] || 0) + 1;
      });

      const estudiantesPorColegio: PerColegioCount[] = colIds.map(colId => ({
        col_id: colId,
        col_nombre: colNameById.get(colId) || `Colegio ${colId}`,
        count: estudiantesCountByCol[colId] || 0,
      }));

      // 5) Collect ALL colacthor_id that belong to these colegios (no est filter per spec)
      const { data: allDisciplines, error: allDiscError } = await supabase
        .from('colegio_actividad_horario')
        .select('colacthor_id')
        .in('col_id', colIds);

      if (allDiscError) {
        console.error('Error fetching disciplines for colacthor set:', allDiscError);
        throw allDiscError;
      }

      const colacthorIds = (allDisciplines || [])
        .map(r => r.colacthor_id)
        .filter((v): v is number => typeof v === 'number');

      // 6) Evaluaciones Asignadas: est_id = 1 and colacthor_id in coordinator’s set
      let evaluacionesAsignadas = 0;
      if (colacthorIds.length > 0) {
        const { count: evaCount, error: evaError } = await supabase
          .from('evaluacion_asignacion')
          .select('*', { count: 'exact', head: true })
          .in('colacthor_id', colacthorIds)
          .eq('est_id', 1);

        if (evaError) {
          console.error('Error counting evaluaciones_asignacion:', evaError);
          throw evaError;
        }
        evaluacionesAsignadas = evaCount || 0;
      }

      // 7) Asistencia Estudiantes: filter by colacthor_id set
      let asistenciaEstudiantes: AttendanceStats = { presente: 0, ausente: 0, tarde: 0, justificado: 0 };
      if (colacthorIds.length > 0) {
        const { data: asisNinoRows, error: asisNinoError } = await supabase
          .from('asistencia_nino')
          .select('asisest_id, colacthor_id')
          .in('colacthor_id', colacthorIds);

        if (asisNinoError) {
          console.error('Error fetching asistencia_nino:', asisNinoError);
          throw asisNinoError;
        }

        const stats: Record<number, number> = {};
        (asisNinoRows || []).forEach((r: any) => {
          const key = r.asisest_id as number;
          stats[key] = (stats[key] || 0) + 1;
        });
        asistenciaEstudiantes = calculateAttendancePercentages(stats, (asisNinoRows || []).length);
      }

      // 8) Asistencia Entrenadores: ent_id in active assignments to coordinator’s colacthor_ids
      let asistenciaEntrenadores: AttendanceStats = { presente: 0, ausente: 0, tarde: 0, justificado: 0 };
      if (colacthorIds.length > 0) {
        const { data: activeAssignments, error: assignError } = await supabase
          .from('entrenador_asignacion')
          .select('ent_id')
          .in('colacthor_id', colacthorIds)
          .eq('est_id', 1);

        if (assignError) {
          console.error('Error fetching entrenador_asignacion:', assignError);
          throw assignError;
        }

        const entIds = Array.from(
          new Set(
            (activeAssignments || [])
              .map(a => a.ent_id)
              .filter((v): v is number => typeof v === 'number')
          )
        );

        if (entIds.length > 0) {
          const { data: asisEntRows, error: asisEntError } = await supabase
            .from('asistencia_entrenador')
            .select('asisest_id, ent_id')
            .in('ent_id', entIds);

          if (asisEntError) {
            console.error('Error fetching asistencia_entrenador:', asisEntError);
            throw asisEntError;
          }

          const stats: Record<number, number> = {};
          (asisEntRows || []).forEach((r: any) => {
            const key = r.asisest_id as number;
            stats[key] = (stats[key] || 0) + 1;
          });
          asistenciaEntrenadores = calculateAttendancePercentages(stats, (asisEntRows || []).length);
        }
      }

      return {
        colegios,
        disciplinasPorColegio,
        estudiantesPorColegio,
        evaluacionesAsignadas,
        asistenciaEstudiantes,
        asistenciaEntrenadores,
      };
    },
    refetchInterval, // 60s, paused when tab is hidden
    staleTime: 30000, // Data considered fresh for 30s
  });
};
