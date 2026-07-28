import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useVisibilityAwareRefetchInterval } from './useVisibilityAwareQuery';

interface AttendanceStats {
  presente: number;
  ausente: number;
  tarde: number;
  justificado: number;
}

interface TrainerDashboardData {
  colegios: string[];
  disciplinas: string[];
  estudiantes: number;
  evaluaciones: number;
  asistenciaEstudiantes: AttendanceStats;
  misAsistencias: AttendanceStats;
}

interface TrainerDashboardResult {
  data: TrainerDashboardData;
  trainerName?: string;
  roleTitle?: string;
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

export const useTrainerDashboardData = () => {
  const { user } = useAuth();
  const refetchInterval = useVisibilityAwareRefetchInterval(60000); // 60s, paused when hidden

  return useQuery({
    queryKey: ['trainer-dashboard-data', user?.usu_id],
    queryFn: async (): Promise<TrainerDashboardResult> => {
      console.log('useTrainerDashboardData - Starting query for user:', user?.usu_id);
      
      if (!user?.usu_id) {
        throw new Error('Usuario no autenticado');
      }

      const isTrainer = user.roles?.some(role => role.rol_id === 3);
      const isAssistant = user.roles?.some(role => role.rol_id === 6);
      const isBackup = user.roles?.some(role => role.rol_id === 7);

      console.log('useTrainerDashboardData - Role checks:', { isTrainer, isAssistant, isBackup });

      let targetEntrenadorId = user.usu_id;
      let trainerName: string | undefined;
      let roleTitle: string | undefined;

      // If user is assistant or backup, find the trainer they belong to
      if (isAssistant || isBackup) {
        console.log('useTrainerDashboardData - Looking for auxiliary trainer record');
        
        const { data: auxiliarData, error: auxiliarError } = await supabase
          .from('entrenador_auxiliar')
          .select(`
            ent_id,
            usuario!entrenador_auxiliar_usu_id_fkey (usu_nombre),
            rol!entrenador_auxiliar_rol_id_fkey (rol_titulo)
          `)
          .eq('usu_id', user.usu_id)
          .eq('est_id', 1)
          .maybeSingle();

        console.log('useTrainerDashboardData - Auxiliary data:', auxiliarData, auxiliarError);

        if (auxiliarError) throw auxiliarError;

        if (auxiliarData) {
          targetEntrenadorId = auxiliarData.ent_id;
          roleTitle = (auxiliarData.rol as any)?.rol_titulo;

          // Get trainer's name
          const { data: trainerData, error: trainerError } = await supabase
            .from('usuario')
            .select('usu_nombre')
            .eq('usu_id', auxiliarData.ent_id)
            .maybeSingle();

          if (trainerError) throw trainerError;
          trainerName = trainerData?.usu_nombre;
          
          console.log('useTrainerDashboardData - Found trainer:', trainerName, 'for auxiliary user');
        }
      }

      console.log('useTrainerDashboardData - Target trainer ID:', targetEntrenadorId);

      // Get trainer assignments (disciplines)
      const { data: asignacionesData, error: asignacionesError } = await supabase
        .from('entrenador_asignacion')
        .select(`
          colacthor_id,
          colegio_actividad_horario!inner (
            colegio!inner (col_nombre),
            actividad!inner (act_nombre)
          )
        `)
        .eq('ent_id', targetEntrenadorId)
        .eq('est_id', 1);

      console.log('useTrainerDashboardData - Assignments data:', asignacionesData, asignacionesError);

      if (asignacionesError) throw asignacionesError;

      // Extract colegios and disciplinas
      const colegiosSet = new Set<string>();
      const disciplinasSet = new Set<string>();
      const colacthorIds: number[] = [];

      (asignacionesData || []).forEach(asignacion => {
        const cah = asignacion.colegio_actividad_horario as any;
        if (cah?.colegio?.col_nombre) {
          colegiosSet.add(cah.colegio.col_nombre);
        }
        if (cah?.actividad?.act_nombre) {
          disciplinasSet.add(cah.actividad.act_nombre);
        }
        colacthorIds.push(asignacion.colacthor_id);
      });

      const colegios = Array.from(colegiosSet);
      const disciplinas = Array.from(disciplinasSet);

      console.log('useTrainerDashboardData - Extracted data:', { colegios, disciplinas, colacthorIds });

      // Count students
      let estudiantes = 0;
      if (colacthorIds.length > 0) {
        const { count: estudiantesCount, error: estudiantesError } = await supabase
          .from('nino_asignacion')
          .select('*', { count: 'exact', head: true })
          .in('colacthor_id', colacthorIds)
          .eq('est_id', 1);

        if (estudiantesError) throw estudiantesError;
        estudiantes = estudiantesCount || 0;
      }

      console.log('useTrainerDashboardData - Students count:', estudiantes);

      // Count evaluations
      let evaluaciones = 0;
      if (colacthorIds.length > 0) {
        const { count: evaluacionesCount, error: evaluacionesError } = await supabase
          .from('evaluacion_asignacion')
          .select('*', { count: 'exact', head: true })
          .in('colacthor_id', colacthorIds)
          .eq('est_id', 1);

        if (evaluacionesError) throw evaluacionesError;
        evaluaciones = evaluacionesCount || 0;
      }

      console.log('useTrainerDashboardData - Evaluations count:', evaluaciones);

      // Get student attendance
      let asistenciaEstudiantes: AttendanceStats = { presente: 0, ausente: 0, tarde: 0, justificado: 0 };
      if (colacthorIds.length > 0) {
        const { data: asistenciaEstudiantesData, error: asistenciaEstudiantesError } = await supabase
          .from('asistencia_nino')
          .select('asisest_id')
          .in('colacthor_id', colacthorIds);

        if (asistenciaEstudiantesError) throw asistenciaEstudiantesError;

        const estudiantesStats: Record<number, number> = {};
        (asistenciaEstudiantesData || []).forEach(record => {
          const state = record.asisest_id;
          estudiantesStats[state] = (estudiantesStats[state] || 0) + 1;
        });
        const totalEstudiantes = asistenciaEstudiantesData?.length || 0;
        asistenciaEstudiantes = calculateAttendancePercentages(estudiantesStats, totalEstudiantes);
      }

      console.log('useTrainerDashboardData - Student attendance:', asistenciaEstudiantes);

      // Get trainer attendance
      const { data: misAsistenciasData, error: misAsistenciasError } = await supabase
        .from('asistencia_entrenador')
        .select('asisest_id')
        .eq('ent_id', targetEntrenadorId);

      if (misAsistenciasError) throw misAsistenciasError;

      const trainerStats: Record<number, number> = {};
      (misAsistenciasData || []).forEach(record => {
        const state = record.asisest_id;
        trainerStats[state] = (trainerStats[state] || 0) + 1;
      });
      const totalTrainer = misAsistenciasData?.length || 0;
      const misAsistencias = calculateAttendancePercentages(trainerStats, totalTrainer);

      console.log('useTrainerDashboardData - Trainer attendance:', misAsistencias);

      const result = {
        data: {
          colegios,
          disciplinas,
          estudiantes,
          evaluaciones,
          asistenciaEstudiantes,
          misAsistencias,
        },
        trainerName,
        roleTitle,
      };

      console.log('useTrainerDashboardData - Final result:', result);

      return result;
    },
    enabled: !!user?.usu_id,
    refetchInterval, // 60s, paused when tab is hidden
    staleTime: 30000, // Data considered fresh for 30s
  });
};
