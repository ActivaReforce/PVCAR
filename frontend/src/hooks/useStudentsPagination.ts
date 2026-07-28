import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface PaginatedStudentsResult {
  data: any[];
  count: number;
  error?: any;
}

interface UseStudentsPaginationProps {
  itemsPerPage?: number;
  selectedSchool?: string | null;
  selectedDiscipline?: number | null;
  searchQuery?: string;
  statusFilter?: 'active' | 'inactive' | 'all';
  showUnassigned?: boolean;
}

export const useStudentsPagination = ({
  itemsPerPage = 7,
  selectedSchool,
  selectedDiscipline,
  searchQuery,
  statusFilter = 'active',
  showUnassigned = false
}: UseStudentsPaginationProps = {}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [students, setStudents] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [trainerContext, setTrainerContext] = useState<{
    trainerId: number | null;
    trainerName: string | null;
    resolved: boolean;
  }>({ trainerId: null, trainerName: null, resolved: false });

  const { toast } = useToast();
  const { user } = useAuth();

  const isAuxiliary = user?.roles?.some(role => role.rol_id === 6 || role.rol_id === 7);
  const isTrainer = user?.roles?.some(role => role.rol_id === 3);

  // Store filters in ref to stabilize fetchStudents dependencies
  const filtersRef = useRef({
    selectedSchool,
    selectedDiscipline,
    searchQuery,
    statusFilter,
    showUnassigned
  });

  // Update ref when filters change
  useEffect(() => {
    filtersRef.current = {
      selectedSchool,
      selectedDiscipline,
      searchQuery,
      statusFilter,
      showUnassigned
    };
  }, [selectedSchool, selectedDiscipline, searchQuery, statusFilter, showUnassigned]);

  // AbortController for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // Get trainer's discipline slots
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

  // Fetch paginated students
  const fetchStudents = useCallback(async (page: number = currentPage): Promise<PaginatedStudentsResult> => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setLoading(true);
    try {
      // Check if aborted early
      if (signal.aborted) return { data: [], count: 0 };

      // Get filters from ref
      const filters = filtersRef.current;

      // Resolve trainer context for auxiliary users
      let effectiveTrainerId: number | null = null;
      if (isAuxiliary) {
        effectiveTrainerId = await resolveTrainerContext();
      }

      if (signal.aborted) return { data: [], count: 0 };

      // Get filtering constraints
      const allowedColegioIds = await getAssignedColegios(effectiveTrainerId);
      const trainerDisciplineSlots = await getTrainerDisciplineSlots(effectiveTrainerId);

      if (signal.aborted) return { data: [], count: 0 };

      // For unassigned filter: get student IDs with active assignments (scoped to selected school)
      let assignedStudentIds: number[] = [];
      if (filters.showUnassigned && filters.selectedSchool) {
        // Get school's col_id
        const { data: schoolData } = await supabase
          .from('colegio')
          .select('col_id')
          .eq('col_nombre', filters.selectedSchool)
          .maybeSingle();

        if (schoolData && !signal.aborted) {
          // Get discipline slots for this school
          const { data: schoolDisciplines } = await supabase
            .from('colegio_actividad_horario')
            .select('colacthor_id')
            .eq('col_id', schoolData.col_id)
            .eq('est_id', 1);

          const schoolDisciplineIds = schoolDisciplines?.map(d => d.colacthor_id) || [];

          if (schoolDisciplineIds.length > 0 && !signal.aborted) {
            // Get students assigned to THIS school's disciplines
            const { data: assignedData } = await supabase
              .from('nino_asignacion')
              .select('nino_id')
              .in('colacthor_id', schoolDisciplineIds)
              .eq('est_id', 1);
            
            assignedStudentIds = [...new Set(assignedData?.map(a => a.nino_id) || [])];
          }
        }
      } else if (filters.showUnassigned && !filters.selectedSchool) {
        // Global unassigned (no school selected)
        const { data: assignedData } = await supabase
          .from('nino_asignacion')
          .select('nino_id')
          .eq('est_id', 1);
        
        assignedStudentIds = [...new Set(assignedData?.map(a => a.nino_id) || [])];
      }

      if (signal.aborted) return { data: [], count: 0 };

      // For trainers in "Ver todos" view (no specific discipline selected, not showing unassigned),
      // get the list of student IDs assigned to their disciplines for database-level filtering
      let trainerAllowedStudentIds: number[] | null = null;
      if (trainerDisciplineSlots !== null && trainerDisciplineSlots.length > 0 && !filters.selectedDiscipline && !filters.showUnassigned) {
        const { data: trainerStudentAssignments, error: assignmentError } = await supabase
          .from('nino_asignacion')
          .select('nino_id')
          .in('colacthor_id', trainerDisciplineSlots)
          .eq('est_id', 1);

        if (assignmentError) throw assignmentError;
        if (signal.aborted) return { data: [], count: 0 };

        trainerAllowedStudentIds = [...new Set(trainerStudentAssignments?.map(a => a.nino_id) || [])];
        
        // If trainer has no assigned students, return empty result
        if (trainerAllowedStudentIds.length === 0) {
          return { data: [], count: 0 };
        }
      }

      // Build base query - conditionally add discipline join for specific discipline filtering
      const baseSelect = `
        *,
        colegio!inner(col_nombre),
        categoria_nino_grado(catninograd_nombre),
        nino_padre(
          padre!inner(
            padre_id,
            usu_id,
            padre_sector_residencia,
            usuario!padre_usu_id_fkey(
              usu_id,
              usu_nombre,
              usu_correo,
              usu_telefono,
              usu_foto
            )
          )
        )
      `;

      // `any`: mas abajo la query se reasigna con un select distinto (join a
      // nino_asignacion) y los tipos inferidos de cada select no son compatibles.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase.from('nino').select(baseSelect).order('nino_nombre');

      // For specific discipline filtering, we need to join with nino_asignacion
      // and filter students who are actually assigned to that discipline
      if (filters.selectedDiscipline && !filters.showUnassigned) {
        query = supabase
          .from('nino')
          .select(`
            ${baseSelect},
            nino_asignacion!inner(colacthor_id)
          `)
          .eq('nino_asignacion.colacthor_id', filters.selectedDiscipline)
          .eq('nino_asignacion.est_id', 1)
          .order('nino_nombre');
      }

      // Apply role-based colegio filtering
      if (allowedColegioIds !== null && allowedColegioIds.length > 0) {
        query = query.in('col_id', allowedColegioIds);
      }

      // Apply school filter
      if (filters.selectedSchool) {
        query = query.eq('colegio.col_nombre', filters.selectedSchool);
      }

      // Apply unassigned filter at database level
      if (filters.showUnassigned && assignedStudentIds.length > 0) {
        query = query.not('nino_id', 'in', `(${assignedStudentIds.join(',')})`);
      }

      // Apply trainer's allowed students filter at database level (for "Ver todos" view)
      if (trainerAllowedStudentIds !== null) {
        query = query.in('nino_id', trainerAllowedStudentIds);
      }

      // Apply status filter
      if (filters.statusFilter === 'active') {
        query = query.eq('est_id', 1);
      } else if (filters.statusFilter === 'inactive') {
        query = query.eq('est_id', 2);
      }

      // Apply search filter  
      if (filters.searchQuery?.trim()) {
        query = query.or(`nino_nombre.ilike.%${filters.searchQuery}%`);
      }

      if (signal.aborted) return { data: [], count: 0 };

      // Get total count with same filtering logic
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let countQuery: any = supabase
        .from('nino')
        .select('nino_id, colegio!inner(col_nombre)', { count: 'exact', head: true });

      // Apply same discipline filtering to count query
      if (filters.selectedDiscipline && !filters.showUnassigned) {
        countQuery = supabase
          .from('nino')
          .select('nino_id, colegio!inner(col_nombre), nino_asignacion!inner(colacthor_id)', { count: 'exact', head: true })
          .eq('nino_asignacion.colacthor_id', filters.selectedDiscipline)
          .eq('nino_asignacion.est_id', 1);
      }
      
      // Apply unassigned filter to count query
      if (filters.showUnassigned && assignedStudentIds.length > 0) {
        countQuery = countQuery.not('nino_id', 'in', `(${assignedStudentIds.join(',')})`);
      }

      // Apply trainer's allowed students filter to count query (for "Ver todos" view)
      if (trainerAllowedStudentIds !== null) {
        countQuery = countQuery.in('nino_id', trainerAllowedStudentIds);
      }
      
      if (allowedColegioIds !== null && allowedColegioIds.length > 0) {
        countQuery = countQuery.in('col_id', allowedColegioIds);
      }
      if (filters.selectedSchool) {
        countQuery = countQuery.eq('colegio.col_nombre', filters.selectedSchool);
      }
      if (filters.statusFilter === 'active') {
        countQuery = countQuery.eq('est_id', 1);
      } else if (filters.statusFilter === 'inactive') {
        countQuery = countQuery.eq('est_id', 2);
      }
      
      // Apply search filter to count query
      if (filters.searchQuery?.trim()) {
        countQuery = countQuery.or(`nino_nombre.ilike.%${filters.searchQuery}%`);
      }
      
      if (signal.aborted) return { data: [], count: 0 };

      const { count: totalCount } = await countQuery;

      // Apply pagination
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      const { data: studentsData, error } = await query.range(from, to);

      if (error) throw error;
      if (signal.aborted) return { data: [], count: 0 };

      // Batch fetch discipline counts for all students (PERFORMANCE FIX)
      const studentIds = (studentsData || []).map(s => s.nino_id);

      let disciplineCountsQuery = supabase
        .from('nino_asignacion')
        .select('nino_id')
        .in('nino_id', studentIds)
        .eq('est_id', 1);

      if (trainerDisciplineSlots !== null && trainerDisciplineSlots.length > 0) {
        disciplineCountsQuery = disciplineCountsQuery.in('colacthor_id', trainerDisciplineSlots);
      }

      const { data: allAssignments } = await disciplineCountsQuery;

      if (signal.aborted) return { data: [], count: 0 };

      // Count assignments per student in memory
      const countMap = new Map<number, number>();
      allAssignments?.forEach(a => {
        countMap.set(a.nino_id, (countMap.get(a.nino_id) || 0) + 1);
      });

      const studentsWithCounts = (studentsData || []).map(student => ({
        ...student,
        disciplinas_count: countMap.get(student.nino_id) || 0,
        representantes: student.nino_padre?.map((np: any) => ({ padre: np.padre })) || []
      }));

      return {
        data: studentsWithCounts,
        count: totalCount || 0
      };

    } catch (error: any) {
      // Silently ignore aborted requests
      if (error?.name === 'AbortError' || signal.aborted) {
        return { data: [], count: 0 };
      }
      
      console.error("Error fetching paginated students:", error);
      toast({
        title: "Error",
        description: "Error al cargar estudiantes",
        variant: "destructive",
      });
      return { data: [], count: 0, error };
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [currentPage, itemsPerPage, user, isAuxiliary, getAssignedColegios, getTrainerDisciplineSlots, resolveTrainerContext, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Load students data
  const loadStudents = useCallback(async (page: number = 1) => {
    const result = await fetchStudents(page);
    setStudents(result.data);
    setTotalCount(result.count);
    setCurrentPage(page);
  }, [fetchStudents]);

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalCount);

  const canGoNext = currentPage < totalPages;
  const canGoPrevious = currentPage > 1;

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      loadStudents(page);
    }
  }, [loadStudents, totalPages]);

  return {
    students,
    loading,
    currentPage,
    totalPages,
    totalCount,
    startIndex,
    endIndex,
    canGoNext,
    canGoPrevious,
    trainerContext,
    goToPage,
    loadStudents,
    refreshStudents: () => loadStudents(currentPage)
  };
};