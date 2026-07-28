import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVisibilityAwareRefetchInterval } from './useVisibilityAwareQuery';

interface AttendanceStats {
  presente: number;
  ausente: number;
  tarde: number;
  justificado: number;
}

interface DashboardData {
  colegios: number;
  usuarios: number;
  actividades: number;
  disciplinas: number;
  estudiantes: number;
  evaluaciones: number;
  asistenciaEstudiantes: AttendanceStats;
  asistenciaEntrenadores: AttendanceStats;
  encuestasPublicadas: number;
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

export const useDashboardData = () => {
  const refetchInterval = useVisibilityAwareRefetchInterval(60000); // 60s, paused when hidden
  
  return useQuery({
    queryKey: ['dashboard-data'],
    queryFn: async (): Promise<DashboardData> => {
      // Fetch all counts in parallel
      const [
        colegiosResult,
        usuariosResult,
        actividadesResult,
        disciplinasResult,
        estudiantesResult,
        evaluacionesResult,
        asistenciaEstudiantesResult,
        asistenciaEntrenadoresResult,
        encuestasPublicadasResult
      ] = await Promise.all([
        // Colegios count
        supabase.from('colegio').select('*', { count: 'exact', head: true }),
        
        // Usuarios count (active only)
        supabase.from('usuario').select('*', { count: 'exact', head: true }).eq('est_id', 1),
        
        // Actividades count
        supabase.from('actividad').select('*', { count: 'exact', head: true }),
        
        // Disciplinas count (active only)
        supabase.from('colegio_actividad_horario').select('*', { count: 'exact', head: true }).eq('est_id', 1),
        
        // Estudiantes count (active only)
        supabase.from('nino').select('*', { count: 'exact', head: true }).eq('est_id', 1),
        
        // Evaluaciones count (active only)
        supabase.from('evaluacion').select('*', { count: 'exact', head: true }).eq('est_id', 1),
        
        // Asistencia estudiantes with state breakdown
        supabase.from('asistencia_nino').select('asisest_id'),
        
        // Asistencia entrenadores with state breakdown
        supabase.from('asistencia_entrenador').select('asisest_id'),
        
        // Encuestas publicadas count
        supabase.from('encuesta').select('*', { count: 'exact', head: true }).eq('est_id', 5)
      ]);

      // Check for errors
      const results = [
        colegiosResult, usuariosResult, actividadesResult, disciplinasResult,
        estudiantesResult, evaluacionesResult, asistenciaEstudiantesResult,
        asistenciaEntrenadoresResult, encuestasPublicadasResult
      ];

      for (const result of results) {
        if (result.error) {
          console.error('Dashboard data fetch error:', result.error);
          throw result.error;
        }
      }

      // Process attendance data
      const processAttendance = (data: any[]) => {
        const stats: Record<number, number> = {};
        data.forEach(record => {
          const state = record.asisest_id;
          stats[state] = (stats[state] || 0) + 1;
        });
        const total = data.length;
        return calculateAttendancePercentages(stats, total);
      };

      return {
        colegios: colegiosResult.count || 0,
        usuarios: usuariosResult.count || 0,
        actividades: actividadesResult.count || 0,
        disciplinas: disciplinasResult.count || 0,
        estudiantes: estudiantesResult.count || 0,
        evaluaciones: evaluacionesResult.count || 0,
        asistenciaEstudiantes: processAttendance(asistenciaEstudiantesResult.data || []),
        asistenciaEntrenadores: processAttendance(asistenciaEntrenadoresResult.data || []),
        encuestasPublicadas: encuestasPublicadasResult.count || 0,
      };
    },
    refetchInterval, // 60s, paused when tab is hidden
    staleTime: 30000, // Data considered fresh for 30s
  });
};
