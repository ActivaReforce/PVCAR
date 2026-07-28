
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useVisibilityAwareRefetchInterval } from '@/hooks/useVisibilityAwareQuery';

interface ChildDisciplina {
  colacthor_id: number;
  actividad_nombre: string;
  dia_nombre: string;
  horario: string;
}

interface ChildAsistencia {
  asisest_id: number;
  colacthor_id: number;
  asisnino_fecha: string;
}

interface EvaluationDetail {
  evaninopen_id: number;
  eva_id: number;
  eva_titulo: string;
  eva_descripcion: string;
  eva_puntaje_total: number;
  status: 'Pendiente' | 'Completa';
  obtained_score: number | null;
  eva_fecha_creacion: string;
}

interface Child {
  nino_id: number;
  nino_nombre: string;
  colegio: { col_nombre: string } | null;
  disciplinas: ChildDisciplina[];
  evaluacionesCompletas: number;
  evaluacionesTotal: number;
  asistencias: ChildAsistencia[];
  evaluationDetails: EvaluationDetail[];
}

interface ParentDashboardData {
  parentName: string;
  children: Child[];
}

export const useParentDashboardData = () => {
  const { user } = useAuth();
  const refetchInterval = useVisibilityAwareRefetchInterval(120000); // 120s instead of 30s

  return useQuery({
    queryKey: ['parent-dashboard-data', user?.usu_id],
    queryFn: async (): Promise<ParentDashboardData> => {
      if (!user?.usu_id) {
        throw new Error('Usuario no autenticado');
      }

      // 1. Get padre_id from current user
      const { data: padreData, error: padreError } = await supabase
        .from('padre')
        .select('padre_id')
        .eq('usu_id', user.usu_id)
        .single();

      if (padreError || !padreData) {
        throw new Error('No se encontró información del representante');
      }

      // 2. Get all children for this parent with colegio info in one query
      const { data: childrenRelations, error: childrenError } = await supabase
        .from('nino_padre')
        .select(`
          nino_id,
          nino!inner(
            nino_id,
            nino_nombre,
            est_id,
            col_id,
            colegio!inner(col_nombre)
          )
        `)
        .eq('padre_id', padreData.padre_id);

      if (childrenError) {
        throw new Error('Error al cargar los hijos');
      }

      // Filter only active children (est_id = 1)
      const activeChildren = (childrenRelations || [])
        .filter(rel => rel.nino && rel.nino.est_id === 1)
        .map(rel => rel.nino);

      if (activeChildren.length === 0) {
        return {
          parentName: user.usu_nombre,
          children: []
        };
      }

      const childIds = activeChildren.map(c => c.nino_id);

      // 3. BATCH: Get all disciplines for all children in ONE query
      const { data: allDisciplinasData } = await supabase
        .from('nino_asignacion')
        .select(`
          nino_id,
          colacthor_id,
          ninoasig_id,
          colegio_actividad_horario!inner(
            colacthor_id,
            actividad!inner(act_nombre),
            dia(dia_nombre),
            colacthor_hora_inicio,
            colacthor_hora_fin
          )
        `)
        .in('nino_id', childIds)
        .eq('est_id', 1);

      // 4. BATCH: Get all nino_asignacion for evaluation lookups
      const { data: allAsignacionesData } = await supabase
        .from('nino_asignacion')
        .select('ninoasig_id, nino_id')
        .in('nino_id', childIds)
        .eq('est_id', 1);

      const allNinoasigIds = allAsignacionesData?.map(a => a.ninoasig_id) || [];

      // 5. BATCH: Get all evaluations for all children's assignments in ONE query
      let allEvaluacionesData: any[] = [];
      if (allNinoasigIds.length > 0) {
        const { data: evalsData } = await supabase
          .from('evaluacion_nino_pendiente')
          .select(`
            evaninopen_id,
            est_id,
            eva_id,
            ninoasig_id,
            evaluacion!inner(
              eva_titulo,
              eva_descripcion,
              eva_puntaje_total,
              eva_fecha_creacion
            )
          `)
          .in('ninoasig_id', allNinoasigIds)
          .in('est_id', [6, 7]);
        
        allEvaluacionesData = evalsData || [];
      }

      // 6. BATCH: Get all evaluation attempts for completed evaluations in ONE query
      const completedEvalIds = allEvaluacionesData
        .filter(e => e.est_id === 7)
        .map(e => e.evaninopen_id);

      let allIntentosData: any[] = [];
      if (completedEvalIds.length > 0) {
        const { data: intentosData } = await supabase
          .from('evaluacion_intento')
          .select('evaninopen_id, evaint_puntaje_obtenido')
          .in('evaninopen_id', completedEvalIds);
        
        allIntentosData = intentosData || [];
      }

      // 7. BATCH: Get all attendance for all children in ONE query
      const { data: allAsistenciasData } = await supabase
        .from('asistencia_nino')
        .select('nino_id, asisest_id, colacthor_id, asisnino_fecha')
        .in('nino_id', childIds);

      // Group data by child for efficient lookup
      const disciplinasByChild = new Map<number, ChildDisciplina[]>();
      (allDisciplinasData || []).forEach(d => {
        const childDisciplinas = disciplinasByChild.get(d.nino_id) || [];
        childDisciplinas.push({
          colacthor_id: d.colacthor_id,
          actividad_nombre: d.colegio_actividad_horario?.actividad?.act_nombre || '',
          dia_nombre: d.colegio_actividad_horario?.dia?.dia_nombre || '',
          horario: d.colegio_actividad_horario?.colacthor_hora_inicio && d.colegio_actividad_horario?.colacthor_hora_fin
            ? `${d.colegio_actividad_horario.colacthor_hora_inicio}–${d.colegio_actividad_horario.colacthor_hora_fin}`
            : ''
        });
        disciplinasByChild.set(d.nino_id, childDisciplinas);
      });

      // Group ninoasig_ids by child
      const ninoasigByChild = new Map<number, number[]>();
      (allAsignacionesData || []).forEach(a => {
        const ids = ninoasigByChild.get(a.nino_id) || [];
        ids.push(a.ninoasig_id);
        ninoasigByChild.set(a.nino_id, ids);
      });

      // Group evaluations by ninoasig_id
      const evalsByNinoasig = new Map<number, any[]>();
      allEvaluacionesData.forEach(e => {
        const evals = evalsByNinoasig.get(e.ninoasig_id) || [];
        evals.push(e);
        evalsByNinoasig.set(e.ninoasig_id, evals);
      });

      // Group intentos by evaninopen_id and calculate scores
      const scoresByEvaninopen = new Map<number, number>();
      allIntentosData.forEach(intento => {
        const currentScore = scoresByEvaninopen.get(intento.evaninopen_id) || 0;
        scoresByEvaninopen.set(intento.evaninopen_id, currentScore + (intento.evaint_puntaje_obtenido || 0));
      });

      // Group attendance by child
      const asistenciasByChild = new Map<number, ChildAsistencia[]>();
      (allAsistenciasData || []).forEach(a => {
        const asistencias = asistenciasByChild.get(a.nino_id) || [];
        asistencias.push({
          asisest_id: a.asisest_id,
          colacthor_id: a.colacthor_id,
          asisnino_fecha: a.asisnino_fecha
        });
        asistenciasByChild.set(a.nino_id, asistencias);
      });

      // Build children data from grouped results (no loops within loops querying DB)
      const childrenWithDetails: Child[] = activeChildren.map(child => {
        const disciplinas = disciplinasByChild.get(child.nino_id) || [];
        const asistencias = asistenciasByChild.get(child.nino_id) || [];
        
        // Get evaluations for this child
        const childNinoasigIds = ninoasigByChild.get(child.nino_id) || [];
        const childEvaluaciones: any[] = [];
        childNinoasigIds.forEach(ninoasigId => {
          const evals = evalsByNinoasig.get(ninoasigId) || [];
          childEvaluaciones.push(...evals);
        });

        const evaluacionesCompletas = childEvaluaciones.filter(e => e.est_id === 7).length;
        const evaluacionesPendientes = childEvaluaciones.filter(e => e.est_id === 6).length;
        const evaluacionesTotal = evaluacionesCompletas + evaluacionesPendientes;

        // Build evaluation details with pre-computed scores
        const evaluationDetails: EvaluationDetail[] = childEvaluaciones.map(evalData => ({
          evaninopen_id: evalData.evaninopen_id,
          eva_id: evalData.eva_id,
          eva_titulo: evalData.evaluacion?.eva_titulo || '',
          eva_descripcion: evalData.evaluacion?.eva_descripcion || '',
          eva_puntaje_total: evalData.evaluacion?.eva_puntaje_total || 0,
          status: evalData.est_id === 6 ? 'Pendiente' : 'Completa',
          obtained_score: evalData.est_id === 7 ? (scoresByEvaninopen.get(evalData.evaninopen_id) ?? null) : null,
          eva_fecha_creacion: evalData.evaluacion?.eva_fecha_creacion || ''
        }));

        // Sort by creation date ascending (oldest first)
        evaluationDetails.sort((a, b) => 
          new Date(a.eva_fecha_creacion).getTime() - new Date(b.eva_fecha_creacion).getTime()
        );

        return {
          nino_id: child.nino_id,
          nino_nombre: child.nino_nombre,
          colegio: child.colegio,
          disciplinas,
          evaluacionesCompletas,
          evaluacionesTotal,
          asistencias,
          evaluationDetails
        };
      });

      return {
        parentName: user.usu_nombre,
        children: childrenWithDetails
      };
    },
    enabled: !!user?.usu_id,
    refetchInterval, // Visibility-aware 120s polling
    staleTime: 60000, // Data is fresh for 1 minute
  });
};
