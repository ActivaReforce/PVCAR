import { useState, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

type Nino = Database['public']['Tables']['nino']['Row'];
type Padre = Database['public']['Tables']['padre']['Row'] & {
  usuario: Database['public']['Tables']['usuario']['Row'];
};
type Colegio = Database['public']['Tables']['colegio']['Row'];

export interface EstudianteWithDetails extends Nino {
  colegio: { col_nombre: string } | null;
  categoria_nino_grado?: { catninograd_nombre: string } | null;
  representantes: Array<{
    padre: Padre;
  }>;
  disciplinas_count?: number;
}

export interface StudentCounts {
  active: number;
  inactive: number;
  total: number;
}

export const useEstudiantesData = () => {
  const [estudiantes, setEstudiantes] = useState<EstudianteWithDetails[]>([]);
  const [allEstudiantes, setAllEstudiantes] = useState<EstudianteWithDetails[]>([]);
  const [studentCounts, setStudentCounts] = useState<StudentCounts>({ active: 0, inactive: 0, total: 0 });
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [loading, setLoading] = useState(true);
  const [trainerContext, setTrainerContext] = useState<{
    trainerId: number | null;
    trainerName: string | null;
    resolved: boolean;
  }>({ trainerId: null, trainerName: null, resolved: false });
  const { toast } = useToast();
  const { user } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check if user is auxiliary (roles 6/7)
  const isAuxiliary = user?.roles?.some(role => role.rol_id === 6 || role.rol_id === 7);

  // Resolve trainer context for auxiliary users
  const resolveTrainerContext = async () => {
    if (!user || !isAuxiliary) {
      setTrainerContext({ trainerId: null, trainerName: null, resolved: true });
      return null;
    }

    try {
      // Get trainer association from entrenador_auxiliar
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

      // Get trainer's name using ent_id (which equals usu_id)
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
  };

  // Get coordinator's assigned colegios OR trainer's assigned colegios OR auxiliary trainer's assigned colegios
  const getAssignedColegios = async (effectiveTrainerId?: number) => {
    if (!user) return null;

    // Use effectiveTrainerId for auxiliary trainers, otherwise use current user
    const targetUserId = effectiveTrainerId || user.usu_id;

    // Check if user is a coordinator (rol_id = 2)
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

    // Check if user is a trainer (rol_id = 3) OR auxiliary trainer (rol_id = 6 or 7 with effectiveTrainerId)
    if (user.roles?.some(role => role.rol_id === 3) || effectiveTrainerId) {
      try {
        // Get trainer's assigned colegios through entrenador_asignacion
        const { data: trainerAssignments, error } = await supabase
          .from('entrenador_asignacion')
          .select(`
            colegio_actividad_horario!inner(col_id)
          `)
          .eq('ent_id', targetUserId)
          .eq('est_id', 1); // Only active assignments

        if (error) throw error;
        
        const colegioIds = trainerAssignments?.map(
          assignment => (assignment.colegio_actividad_horario as any).col_id
        ) || [];
        
        // Remove duplicates
        return [...new Set(colegioIds)];
      } catch (error) {
        console.error("Error fetching trainer colegios:", error);
        return [];
      }
    }

    return null; // Not a coordinator or trainer, return null to indicate no filtering
  };

  // Get trainer's assigned discipline slots (colacthor_id)
  const getTrainerDisciplineSlots = async (effectiveTrainerId?: number) => {
    const targetUserId = effectiveTrainerId || user?.usu_id;
    
    if (!user || (!user.roles?.some(role => role.rol_id === 3) && !effectiveTrainerId)) {
      return null; // Not a trainer or auxiliary
    }

    try {
      const { data: trainerAssignments, error } = await supabase
        .from('entrenador_asignacion')
        .select('colacthor_id')
        .eq('ent_id', targetUserId)
        .eq('est_id', 1); // Only active assignments

      if (error) throw error;
      return trainerAssignments?.map(assignment => assignment.colacthor_id) || [];
    } catch (error) {
      console.error("Error fetching trainer discipline slots:", error);
      return [];
    }
  };

  // Calculate student counts from all students
  const calculateStudentCounts = (students: EstudianteWithDetails[]): StudentCounts => {
    const active = students.filter(s => s.est_id === 1).length;
    const inactive = students.filter(s => s.est_id === 2).length;
    const total = students.length;
    return { active, inactive, total };
  };

  const fetchEstudiantes = async (effectiveTrainerId?: number) => {
    // Cancel previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Get assigned colegios if applicable (coordinator, trainer, or auxiliary)
      const allowedColegioIds = await getAssignedColegios(effectiveTrainerId);
      
      // Get trainer's discipline slots if applicable
      const trainerDisciplineSlots = await getTrainerDisciplineSlots(effectiveTrainerId);

      // Build query for students
      let estudiantesQuery = supabase
        .from('nino')
        .select(`
          *,
          colegio!inner(col_nombre),
          categoria_nino_grado(catninograd_nombre),
          nino_padre(
            padre!inner(
              padre_id,
              usu_id,
              padre_sector_residencia,
              padre_fecha_creacion,
              padre_fecha_modificacion,
              usuario!padre_usu_id_fkey(
                usu_id,
                usu_nombre,
                usu_correo,
                usu_telefono,
                usu_foto,
                usu_fecha_creacion,
                usu_fecha_modificacion,
                usu_contrasena,
                est_id
              )
            )
          )
        `)
        .order('nino_nombre');

      // Apply colegio filtering if applicable
      if (allowedColegioIds !== null && allowedColegioIds.length > 0) {
        estudiantesQuery = estudiantesQuery.in('col_id', allowedColegioIds);
      }

      const { data: estudiantesData, error: estudiantesError } = await estudiantesQuery;

      if (estudiantesError) throw estudiantesError;

      if (!estudiantesData || estudiantesData.length === 0) {
        setEstudiantes([]);
        setAllEstudiantes([]);
        setStudentCounts({ active: 0, inactive: 0, total: 0 });
        return;
      }

      // BATCH: Get ALL active discipline assignments for ALL students in ONE query
      const studentIds = estudiantesData.map(e => e.nino_id);
      let assignmentsQuery = supabase
        .from('nino_asignacion')
        .select('nino_id, colacthor_id')
        .in('nino_id', studentIds)
        .eq('est_id', 1);

      // For trainers, filter to their assigned disciplines
      if (trainerDisciplineSlots !== null && trainerDisciplineSlots.length > 0) {
        assignmentsQuery = assignmentsQuery.in('colacthor_id', trainerDisciplineSlots);
      }

      const { data: allAssignmentsData } = await assignmentsQuery;

      // Count assignments per student
      const countsByStudent = new Map<number, number>();
      (allAssignmentsData || []).forEach(assignment => {
        const currentCount = countsByStudent.get(assignment.nino_id) || 0;
        countsByStudent.set(assignment.nino_id, currentCount + 1);
      });

      // Build students with counts from pre-fetched data (no N+1)
      const estudiantesWithCounts = estudiantesData.map(estudiante => ({
        ...estudiante,
        disciplinas_count: countsByStudent.get(estudiante.nino_id) || 0,
        representantes: estudiante.nino_padre?.map(np => ({
          padre: np.padre
        })) || []
      }));

      // For trainers, filter students to only show those with assignments to trainer's disciplines
      let filteredStudents = estudiantesWithCounts;
      if (trainerDisciplineSlots !== null && trainerDisciplineSlots.length > 0) {
        // Use the same batch data - students with assignments are those in countsByStudent
        const trainerStudentIds = new Set(countsByStudent.keys());

        // Include students with assignments to trainer's disciplines + students with no assignments (disciplinas_count = 0)
        filteredStudents = estudiantesWithCounts.filter(student => 
          trainerStudentIds.has(student.nino_id) || student.disciplinas_count === 0
        );
      }

      const allStudents = filteredStudents;
      setAllEstudiantes(allStudents);
      
      // Calculate and store counts
      const counts = calculateStudentCounts(allStudents);
      setStudentCounts(counts);
      
      // Initially show only active students
      const activeStudents = allStudents.filter(s => s.est_id === 1);
      setEstudiantes(activeStudents);
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error("Error fetching estudiantes:", error);
      toast({
        title: "Error",
        description: "Error al cargar estudiantes",
        variant: "destructive",
      });
    }
  };

  const fetchColegios = async (effectiveTrainerId?: number) => {
    try {
      // Get assigned colegios if applicable
      const allowedColegioIds = await getAssignedColegios(effectiveTrainerId);

      let colegiosQuery = supabase
        .from('colegio')
        .select('*')
        .order('col_nombre');

      // Apply colegio filtering if applicable
      if (allowedColegioIds !== null && allowedColegioIds.length > 0) {
        colegiosQuery = colegiosQuery.in('col_id', allowedColegioIds);
      }

      const { data, error } = await colegiosQuery;

      if (error) throw error;
      setColegios(data || []);
    } catch (error) {
      console.error("Error fetching colegios:", error);
    }
  };

  // Sequential initialization for auxiliary users (roles 6/7)
  const initializeAuxiliaryData = async () => {
    try {
      setLoading(true);
      
      // Step 1: Resolve trainer context
      const trainerId = await resolveTrainerContext();
      
      if (trainerId) {
        // Step 2: Fetch filtered data using trainer context
        await Promise.all([
          fetchColegios(trainerId),
          fetchEstudiantes(trainerId)
        ]);
      } else {
        // No trainer context, set empty data
        setColegios([]);
        setEstudiantes([]);
        setAllEstudiantes([]);
        setStudentCounts({ active: 0, inactive: 0, total: 0 });
      }
    } catch (error) {
      console.error("Error initializing auxiliary data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Standard initialization for other users
  const initializeStandardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchColegios(),
        fetchEstudiantes()
      ]);
    } catch (error) {
      console.error("Error initializing standard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterStudentsByStatus = (statusFilter: 'active' | 'inactive' | 'all') => {
    let filtered = [...allEstudiantes];
    
    // Apply status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(s => s.est_id === 1);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(s => s.est_id === 2);
    }
    
    setEstudiantes(filtered);
  };

  const deleteEstudiante = async (estudiante: EstudianteWithDetails) => {
    try {
      // Use a transaction to update both the student and their discipline assignments
      const { error: studentError } = await supabase
        .from('nino')
        .update({ 
          est_id: 2,
          nino_fecha_modificacion: new Date().toISOString()
        })
        .eq('nino_id', estudiante.nino_id);

      if (studentError) throw studentError;

      // Deactivate all active discipline assignments for this student
      const { error: assignmentError } = await supabase
        .from('nino_asignacion')
        .update({ 
          est_id: 2,
          ninoasig_fecha_baja: new Date().toISOString()
        })
        .eq('nino_id', estudiante.nino_id)
        .eq('est_id', 1); // Only update active assignments

      if (assignmentError) throw assignmentError;

      toast({
        title: "Éxito",
        description: "Estudiante y disciplinas desactivados correctamente",
      });

      // Refresh data using appropriate method
      if (isAuxiliary && trainerContext.trainerId) {
        await fetchEstudiantes(trainerContext.trainerId);
      } else {
        await fetchEstudiantes();
      }
      return true;
    } catch (error) {
      console.error("Error deactivating estudiante:", error);
      toast({
        title: "Error",
        description: "Error al desactivar estudiante",
        variant: "destructive",
      });
      return false;
    }
  };

  const reactivateEstudiante = async (estudiante: EstudianteWithDetails) => {
    try {
      const { error } = await supabase
        .from('nino')
        .update({ 
          est_id: 1,
          nino_fecha_modificacion: new Date().toISOString()
        })
        .eq('nino_id', estudiante.nino_id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Estudiante reactivado correctamente",
      });

      // Refresh data using appropriate method
      if (isAuxiliary && trainerContext.trainerId) {
        await fetchEstudiantes(trainerContext.trainerId);
      } else {
        await fetchEstudiantes();
      }
      return true;
    } catch (error) {
      console.error("Error reactivating estudiante:", error);
      toast({
        title: "Error",
        description: "Error al reactivar estudiante",
        variant: "destructive",
      });
      return false;
    }
  };

  const permanentDeleteEstudiante = async (estudiante: EstudianteWithDetails) => {
    try {
      const { error } = await supabase
        .from('nino')
        .delete()
        .eq('nino_id', estudiante.nino_id);

      if (error) {
        if (error.code === '23503') {
          toast({
            title: "No se puede eliminar",
            description: "No se puede eliminar el estudiante porque tiene registros relacionados. Primero debe desactivar o transferir estos registros.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: `Error al eliminar permanentemente el estudiante: ${error.message}`,
            variant: "destructive",
          });
        }
        return false;
      }

      toast({
        title: "Éxito",
        description: "Estudiante eliminado permanentemente",
      });

      // Refresh data using appropriate method
      if (isAuxiliary && trainerContext.trainerId) {
        await fetchEstudiantes(trainerContext.trainerId);
      } else {
        await fetchEstudiantes();
      }
      return true;
    } catch (error) {
      console.error("Error permanently deleting estudiante:", error);
      toast({
        title: "Error",
        description: "Error inesperado al eliminar permanentemente el estudiante",
        variant: "destructive",
      });
      return false;
    }
  };

  // Main initialization effect
  useEffect(() => {
    if (!user) return;

    if (isAuxiliary) {
      // Sequential initialization for auxiliary users
      initializeAuxiliaryData();
    } else {
      // Standard parallel initialization for other users
      initializeStandardData();
    }

    // Listen for discipline assignment changes to refresh data
    const handleDisciplineChange = () => {
      if (isAuxiliary && trainerContext.trainerId) {
        fetchEstudiantes(trainerContext.trainerId);
      } else {
        fetchEstudiantes();
      }
    };

    window.addEventListener('disciplineAssignmentChanged', handleDisciplineChange);

    return () => {
      window.removeEventListener('disciplineAssignmentChanged', handleDisciplineChange);
      // Cleanup: abort pending requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user]);

  return {
    estudiantes,
    allEstudiantes,
    studentCounts,
    colegios,
    loading,
    trainerContext,
    fetchEstudiantes: (effectiveTrainerId?: number) => {
      if (isAuxiliary && trainerContext.trainerId) {
        return fetchEstudiantes(trainerContext.trainerId);
      }
      return fetchEstudiantes(effectiveTrainerId);
    },
    fetchColegios: (effectiveTrainerId?: number) => {
      if (isAuxiliary && trainerContext.trainerId) {
        return fetchColegios(trainerContext.trainerId);
      }
      return fetchColegios(effectiveTrainerId);
    },
    filterStudentsByStatus,
    deleteEstudiante,
    reactivateEstudiante,
    permanentDeleteEstudiante
  };
};
