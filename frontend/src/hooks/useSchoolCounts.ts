import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SchoolWithCounts {
  col_id: number;
  col_nombre: string;
  student_count: number;
}

export const useSchoolCounts = () => {
  const [schoolCounts, setSchoolCounts] = useState<SchoolWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [trainerContext, setTrainerContext] = useState<{
    trainerId: number | null;
    trainerName: string | null;
    resolved: boolean;
  }>({ trainerId: null, trainerName: null, resolved: false });

  const { user } = useAuth();
  const { toast } = useToast();

  const isAuxiliary = user?.roles?.some(role => role.rol_id === 6 || role.rol_id === 7);

  // Resolve trainer context for auxiliary users
  const resolveTrainerContext = useCallback(async () => {
    if (!user || !isAuxiliary) {
      setTrainerContext({ trainerId: null, trainerName: null, resolved: true });
      return null;
    }

    try {
      const { data: auxiliarData, error: auxiliarError } = await supabase
        .from('entrenador_auxiliar')
        .select('ent_id')
        .eq('usu_id', user.usu_id)
        .eq('est_id', 1)
        .maybeSingle();

      if (auxiliarError || !auxiliarData?.ent_id) {
        setTrainerContext({ trainerId: null, trainerName: null, resolved: true });
        return null;
      }

      const { data: trainerData, error: trainerError } = await supabase
        .from('usuario')
        .select('usu_nombre')
        .eq('usu_id', auxiliarData.ent_id)
        .maybeSingle();

      if (trainerError) {
        console.error('Error fetching trainer data:', trainerError);
      }

      const context = {
        trainerId: auxiliarData.ent_id,
        trainerName: trainerData?.usu_nombre || null,
        resolved: true
      };
      
      setTrainerContext(context);
      return context.trainerId;
    } catch (error) {
      console.error('Error resolving trainer context:', error);
      setTrainerContext({ trainerId: null, trainerName: null, resolved: true });
      return null;
    }
  }, [user, isAuxiliary]);

  // Get assigned colegios for filtering
  const getAssignedColegios = useCallback(async (effectiveTrainerId?: number) => {
    if (!user) return null;

    const targetUserId = effectiveTrainerId || user.usu_id;

    if (user.roles?.some(role => role.rol_id === 2)) {
      try {
        const { data, error } = await supabase
          .from('colegio_coordinador')
          .select('col_id')
          .eq('usu_id', user.usu_id);

        if (error) throw error;
        return data?.map(item => item.col_id) || [];
      } catch (error) {
        console.error("Error fetching coordinator colegios:", error);
        return [];
      }
    }

    if (user.roles?.some(role => role.rol_id === 3) || effectiveTrainerId) {
      try {
        const { data: trainerAssignments, error } = await supabase
          .from('entrenador_asignacion')
          .select(`colegio_actividad_horario!inner(col_id)`)
          .eq('ent_id', targetUserId)
          .eq('est_id', 1);

        if (error) throw error;
        
        const colegioIds = trainerAssignments?.map(
          assignment => (assignment.colegio_actividad_horario as any).col_id
        ) || [];
        
        return [...new Set(colegioIds)];
      } catch (error) {
        console.error("Error fetching trainer colegios:", error);
        return [];
      }
    }

    return null;
  }, [user]);

  // Get trainer's discipline slots for filtering student counts
  const getTrainerDisciplineSlots = useCallback(async (effectiveTrainerId?: number) => {
    const targetUserId = effectiveTrainerId || user?.usu_id;
    
    if (!user || (!user.roles?.some(role => role.rol_id === 3) && !effectiveTrainerId)) {
      return null;
    }

    try {
      const { data: trainerAssignments, error } = await supabase
        .from('entrenador_asignacion')
        .select('colacthor_id')
        .eq('ent_id', targetUserId)
        .eq('est_id', 1);

      if (error) throw error;
      return trainerAssignments?.map(assignment => assignment.colacthor_id) || [];
    } catch (error) {
      console.error("Error fetching trainer discipline slots:", error);
      return [];
    }
  }, [user]);

  // Fetch school counts efficiently
  const fetchSchoolCounts = useCallback(async () => {
    setLoading(true);
    try {
      // Resolve trainer context for auxiliary users
      let effectiveTrainerId: number | null = null;
      if (isAuxiliary) {
        effectiveTrainerId = await resolveTrainerContext();
      }

      // Get assigned colegios if applicable
      const allowedColegioIds = await getAssignedColegios(effectiveTrainerId);
      const trainerDisciplineSlots = await getTrainerDisciplineSlots(effectiveTrainerId);

      // Get schools first
      let schoolsQuery = supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .order('col_nombre');

      if (allowedColegioIds !== null && allowedColegioIds.length > 0) {
        schoolsQuery = schoolsQuery.in('col_id', allowedColegioIds);
      }

      const { data: schools, error: schoolsError } = await schoolsQuery;
      if (schoolsError) throw schoolsError;

      // Batch query for trainer filtering (PERFORMANCE FIX)
      if (trainerDisciplineSlots !== null && trainerDisciplineSlots.length > 0) {
        // Get all trainer student IDs once
        const { data: trainerAssignments } = await supabase
          .from('nino_asignacion')
          .select('nino_id')
          .in('colacthor_id', trainerDisciplineSlots)
          .eq('est_id', 1);
        
        const trainerStudentIds = new Set(trainerAssignments?.map(a => a.nino_id) || []);
        
        // Get all active students for all schools in one query
        const { data: allStudents } = await supabase
          .from('nino')
          .select('nino_id, col_id')
          .in('col_id', schools?.map(s => s.col_id) || [])
          .eq('est_id', 1);
        
        // Count per school in memory
        const schoolStudentMap = new Map<number, number>();
        allStudents?.forEach(student => {
          if (trainerStudentIds.has(student.nino_id)) {
            schoolStudentMap.set(student.col_id, (schoolStudentMap.get(student.col_id) || 0) + 1);
          }
        });
        
        const schoolsWithCounts = (schools || []).map(school => ({
          ...school,
          student_count: schoolStudentMap.get(school.col_id) || 0
        }));

        const schoolsWithStudents = schoolsWithCounts.filter(school => school.student_count > 0);
        setSchoolCounts(schoolsWithStudents);
      } else {
        // For non-trainers, batch count all active students
        const { data: allStudents } = await supabase
          .from('nino')
          .select('nino_id, col_id')
          .in('col_id', schools?.map(s => s.col_id) || [])
          .eq('est_id', 1);
        
        const schoolStudentMap = new Map<number, number>();
        allStudents?.forEach(student => {
          schoolStudentMap.set(student.col_id, (schoolStudentMap.get(student.col_id) || 0) + 1);
        });
        
        const schoolsWithCounts = (schools || []).map(school => ({
          ...school,
          student_count: schoolStudentMap.get(school.col_id) || 0
        }));

        const schoolsWithStudents = schoolsWithCounts.filter(school => school.student_count > 0);
        setSchoolCounts(schoolsWithStudents);
      }

    } catch (error) {
      console.error("Error fetching school counts:", error);
      toast({
        title: "Error",
        description: "Error al cargar conteos de colegios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [
    isAuxiliary,
    resolveTrainerContext,
    getAssignedColegios,
    getTrainerDisciplineSlots,
    toast
  ]);

  useEffect(() => {
    if (user) {
      fetchSchoolCounts();
    }
  }, [user, fetchSchoolCounts]);

  return {
    schoolCounts,
    loading,
    trainerContext,
    refreshSchoolCounts: fetchSchoolCounts
  };
};