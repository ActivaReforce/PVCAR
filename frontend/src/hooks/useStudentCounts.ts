import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface StudentCounts {
  active: number;
  inactive: number;
  total: number;
  unassigned: number;
}

interface UseStudentCountsProps {
  selectedSchool?: string | null;
  selectedDiscipline?: number | null;
  searchQuery?: string;
  showUnassigned?: boolean;
}

export const useStudentCounts = ({
  selectedSchool,
  selectedDiscipline,
  searchQuery,
  showUnassigned = false
}: UseStudentCountsProps = {}) => {
  const [counts, setCounts] = useState<StudentCounts>({
    active: 0,
    inactive: 0,
    total: 0,
    unassigned: 0
  });
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const isAuxiliary = user?.roles?.some(role => role.rol_id === 6 || role.rol_id === 7);
  const isTrainer = user?.roles?.some(role => role.rol_id === 3);

  // Get trainer context for auxiliary users
  const resolveTrainerContext = useCallback(async () => {
    if (!user || !isAuxiliary) {
      return null;
    }

    try {
      const { data: auxiliarData, error: auxiliarError } = await supabase
        .from('entrenador_auxiliar')
        .select('ent_id')
        .eq('usu_id', user.usu_id)
        .eq('est_id', 1)
        .maybeSingle();

      if (auxiliarError) throw auxiliarError;
      return auxiliarData?.ent_id || null;
    } catch (error) {
      console.error("Error resolving trainer context:", error);
      return null;
    }
  }, [user, isAuxiliary]);

  // Get assigned colegios for role-based filtering
  const getAssignedColegios = useCallback(async (effectiveTrainerId: number | null) => {
    if (!user) return null;

    const isCoordinator = user.roles?.some(role => role.rol_id === 2);
    
    if (isCoordinator) {
      // Get coordinator's assigned colegios
      const { data: coordinatorColegios, error: coordinatorError } = await supabase
        .from('colegio_coordinador')
        .select('col_id')
        .eq('usu_id', user.usu_id);

      if (coordinatorError) throw coordinatorError;
      return coordinatorColegios?.map(c => c.col_id) || [];
    } else if (isTrainer || (isAuxiliary && effectiveTrainerId)) {
      const trainerId = effectiveTrainerId || user.usu_id;
      
      // Get trainer's assigned colegios through entrenador_asignacion
      const { data: trainerAssignments, error: trainerError } = await supabase
        .from('entrenador_asignacion')
        .select(`
          colegio_actividad_horario!inner(col_id)
        `)
        .eq('ent_id', trainerId)
        .eq('est_id', 1);

      if (trainerError) throw trainerError;
      
      const uniqueColegioIds = [...new Set(
        trainerAssignments?.map(assignment => 
          assignment.colegio_actividad_horario.col_id
        ) || []
      )];
      
      return uniqueColegioIds;
    }

    return null; // Admin has access to all
  }, [user, isTrainer, isAuxiliary]);

  // Get trainer's discipline slots for filtering
  const getTrainerDisciplineSlots = useCallback(async (effectiveTrainerId: number | null) => {
    if (!user || (!isTrainer && !isAuxiliary)) return null;

    const trainerId = effectiveTrainerId || user.usu_id;
    
    const { data: trainerAssignments, error: trainerError } = await supabase
      .from('entrenador_asignacion')
      .select('colacthor_id')
      .eq('ent_id', trainerId)
      .eq('est_id', 1);

    if (trainerError) throw trainerError;
    return trainerAssignments?.map(assignment => assignment.colacthor_id) || [];
  }, [user, isTrainer, isAuxiliary]);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    try {
      // Resolve trainer context
      const effectiveTrainerId = await resolveTrainerContext();
      const allowedColegioIds = await getAssignedColegios(effectiveTrainerId);
      const trainerDisciplineSlots = await getTrainerDisciplineSlots(effectiveTrainerId);

      // Build base query for students.
      // `any`: mas abajo estas queries se reasignan con un select distinto (join a
      // nino_asignacion) y los tipos inferidos de cada select no son compatibles entre si.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let baseQuery: any = supabase
        .from('nino')
        .select('nino_id, est_id', { count: 'exact', head: true });

      let schoolColId: number | null = null;

      // If specific school selected, get its ID and filter by it
      if (selectedSchool) {
        const { data: schoolData, error: schoolError } = await supabase
          .from('colegio')
          .select('col_id')
          .eq('col_nombre', selectedSchool)
          .single();

        if (schoolError) throw schoolError;
        schoolColId = schoolData.col_id;
        baseQuery = baseQuery.eq('col_id', schoolColId);
      }

      // Apply role-based colegio filtering
      if (allowedColegioIds !== null && allowedColegioIds.length > 0) {
        baseQuery = baseQuery.in('col_id', allowedColegioIds);
      }

      // Apply search filter if provided
      if (searchQuery && searchQuery.trim()) {
        baseQuery = baseQuery.or(`nino_nombre.ilike.%${searchQuery}%`);
      }

      // For specific discipline filtering, we need to join with nino_asignacion
      if (selectedDiscipline && !showUnassigned) {
        baseQuery = supabase
          .from('nino')
          .select('nino_id, est_id, nino_asignacion!inner(colacthor_id)', { count: 'exact', head: true })
          .eq('nino_asignacion.colacthor_id', selectedDiscipline)
          .eq('nino_asignacion.est_id', 1);

        // If specific school selected, filter by school
        if (schoolColId) {
          baseQuery = baseQuery.eq('col_id', schoolColId);
        }

        // Apply role filtering again
        if (allowedColegioIds !== null && allowedColegioIds.length > 0) {
          baseQuery = baseQuery.in('col_id', allowedColegioIds);
        }

        // Apply search filter if provided
        if (searchQuery && searchQuery.trim()) {
          baseQuery = baseQuery.or(`nino_nombre.ilike.%${searchQuery}%`);
        }
      }

      // Get counts for each status - need to rebuild queries
      /* eslint-disable @typescript-eslint/no-explicit-any */
      let activeQuery: any = supabase
        .from('nino')
        .select('nino_id, est_id', { count: 'exact', head: true })
        .eq('est_id', 1);

      let inactiveQuery: any = supabase
        .from('nino')
        .select('nino_id, est_id', { count: 'exact', head: true })
        .eq('est_id', 2);

      let totalQuery: any = supabase
        .from('nino')
        .select('nino_id, est_id', { count: 'exact', head: true })
        .in('est_id', [1, 2]);
      /* eslint-enable @typescript-eslint/no-explicit-any */

      // Apply the same filters to all status queries
      if (schoolColId) {
        activeQuery = activeQuery.eq('col_id', schoolColId);
        inactiveQuery = inactiveQuery.eq('col_id', schoolColId);
        totalQuery = totalQuery.eq('col_id', schoolColId);
      }

      if (allowedColegioIds !== null && allowedColegioIds.length > 0) {
        activeQuery = activeQuery.in('col_id', allowedColegioIds);
        inactiveQuery = inactiveQuery.in('col_id', allowedColegioIds);
        totalQuery = totalQuery.in('col_id', allowedColegioIds);
      }

      if (searchQuery && searchQuery.trim()) {
        activeQuery = activeQuery.or(`nino_nombre.ilike.%${searchQuery}%`);
        inactiveQuery = inactiveQuery.or(`nino_nombre.ilike.%${searchQuery}%`);
        totalQuery = totalQuery.or(`nino_nombre.ilike.%${searchQuery}%`);
      }

      // For specific discipline filtering, rebuild queries with joins
      if (selectedDiscipline && !showUnassigned) {
        activeQuery = supabase
          .from('nino')
          .select('nino_id, est_id, nino_asignacion!inner(colacthor_id)', { count: 'exact', head: true })
          .eq('nino_asignacion.colacthor_id', selectedDiscipline)
          .eq('nino_asignacion.est_id', 1)
          .eq('est_id', 1);

        inactiveQuery = supabase
          .from('nino')
          .select('nino_id, est_id, nino_asignacion!inner(colacthor_id)', { count: 'exact', head: true })
          .eq('nino_asignacion.colacthor_id', selectedDiscipline)
          .eq('nino_asignacion.est_id', 1)
          .eq('est_id', 2);

        totalQuery = supabase
          .from('nino')
          .select('nino_id, est_id, nino_asignacion!inner(colacthor_id)', { count: 'exact', head: true })
          .eq('nino_asignacion.colacthor_id', selectedDiscipline)
          .eq('nino_asignacion.est_id', 1)
          .in('est_id', [1, 2]);

        // Apply filters again for discipline queries
        if (schoolColId) {
          activeQuery = activeQuery.eq('col_id', schoolColId);
          inactiveQuery = inactiveQuery.eq('col_id', schoolColId);
          totalQuery = totalQuery.eq('col_id', schoolColId);
        }

        if (allowedColegioIds !== null && allowedColegioIds.length > 0) {
          activeQuery = activeQuery.in('col_id', allowedColegioIds);
          inactiveQuery = inactiveQuery.in('col_id', allowedColegioIds);
          totalQuery = totalQuery.in('col_id', allowedColegioIds);
        }

        if (searchQuery && searchQuery.trim()) {
          activeQuery = activeQuery.or(`nino_nombre.ilike.%${searchQuery}%`);
          inactiveQuery = inactiveQuery.or(`nino_nombre.ilike.%${searchQuery}%`);
          totalQuery = totalQuery.or(`nino_nombre.ilike.%${searchQuery}%`);
        }
      }

      const [activeResult, inactiveResult, totalResult] = await Promise.all([
        activeQuery,
        inactiveQuery,
        totalQuery
      ]);

      if (activeResult.error) throw activeResult.error;
      if (inactiveResult.error) throw inactiveResult.error;
      if (totalResult.error) throw totalResult.error;

      // Get unassigned count (only for active students without specific discipline filter)
      let unassignedCount = 0;
      if (!selectedDiscipline) {
        // Query for all active students in scope
        let studentsQuery = supabase
          .from('nino')
          .select('nino_id')
          .eq('est_id', 1);

        // Apply school filter if specific school selected
        if (schoolColId) {
          studentsQuery = studentsQuery.eq('col_id', schoolColId);
        }

        // Apply role-based filtering
        if (allowedColegioIds !== null && allowedColegioIds.length > 0) {
          studentsQuery = studentsQuery.in('col_id', allowedColegioIds);
        }

        // Apply search filter if provided
        if (searchQuery && searchQuery.trim()) {
          studentsQuery = studentsQuery.or(`nino_nombre.ilike.%${searchQuery}%`);
        }

        const { data: allActiveStudents } = await studentsQuery;

        if (allActiveStudents) {
          // Batch fetch all assignments (PERFORMANCE FIX)
          const allStudentIds = allActiveStudents.map(s => s.nino_id);

          let assignedQuery = supabase
            .from('nino_asignacion')
            .select('nino_id')
            .in('nino_id', allStudentIds)
            .eq('est_id', 1);

          if (trainerDisciplineSlots !== null && trainerDisciplineSlots.length > 0) {
            assignedQuery = assignedQuery.in('colacthor_id', trainerDisciplineSlots);
          }

          const { data: assignedData } = await assignedQuery;
          const assignedIds = new Set(assignedData?.map(a => a.nino_id) || []);
          unassignedCount = allStudentIds.filter(id => !assignedIds.has(id)).length;
        }
      }

      setCounts({
        active: activeResult.count || 0,
        inactive: inactiveResult.count || 0,
        total: totalResult.count || 0,
        unassigned: unassignedCount
      });

    } catch (error) {
      console.error("Error fetching student counts:", error);
      toast({
        title: "Error",
        description: "Error al cargar los conteos de estudiantes",
        variant: "destructive",
      });
      setCounts({ active: 0, inactive: 0, total: 0, unassigned: 0 });
    } finally {
      setLoading(false);
    }
  }, [
    selectedSchool,
    selectedDiscipline,
    searchQuery,
    showUnassigned,
    resolveTrainerContext,
    getAssignedColegios,
    getTrainerDisciplineSlots,
    toast
  ]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return {
    counts,
    loading,
    refetch: fetchCounts
  };
};