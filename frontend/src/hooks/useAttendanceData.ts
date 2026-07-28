import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatTimeForDisplay } from "@/components/attendance/TimezoneUtils";
import { useAuth } from '@/contexts/AuthContext';
import { useTrainerContext } from '@/hooks/useTrainerContext';
import { 
  Colegio, 
  Dia, 
  DisciplineWithDetails, 
  ChildWithAttendance, 
  AsistenciaEstado 
} from "@/components/attendance/AttendanceTypes";

export const useAttendanceData = () => {
  const { user } = useAuth();
  const { trainerId } = useTrainerContext();
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [dias, setDias] = useState<Dia[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineWithDetails[]>([]);
  const [children, setChildren] = useState<ChildWithAttendance[]>([]);
  const [asistenciaEstados, setAsistenciaEstados] = useState<AsistenciaEstado[]>([]);
  
  const [selectedColegio, setSelectedColegio] = useState<string>("");
  const [selectedDia, setSelectedDia] = useState<string>("");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [markAllPresent, setMarkAllPresent] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const { toast } = useToast();

  // Track if user has manually changed the date to prevent auto-overwrite
  const userChangedDateRef = useRef(false);
  // Track the last discipline that triggered auto-date to prevent re-triggering
  const lastAutoDisciplineRef = useRef<string>("");
  // AbortController refs for async operations
  const abortControllerRef = useRef<AbortController | null>(null);
  // Debounce timer for discipline selection
  const disciplineDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Track mounted state
  const isMountedRef = useRef(true);

  // Wrapper to mark user-initiated date changes
  const handleUserDateChange = useCallback((date: Date) => {
    userChangedDateRef.current = true;
    setSelectedDate(date);
  }, []);

  // Check if current user is a trainer or auxiliary
  const isTrainer = user?.roles?.some(role => role.rol_id === 3);
  const isAuxiliary = user?.roles?.some(role => role.rol_id === 6 || role.rol_id === 7);
  const effectiveTrainerId = isAuxiliary ? trainerId : (isTrainer ? user?.usu_id : null);

  const loadInitialData = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);

      // Check if user is a coordinator (rol_id = 2) or trainer/auxiliary (rol_id = 3, 6, 7)
      const isCoordinator = user?.roles?.some(role => role.rol_id === 2);
      
      let colegiosData;
      
      if ((isTrainer || isAuxiliary) && effectiveTrainerId) {
        // For trainers and auxiliaries, load only assigned schools
        const { data: trainerAssignments, error: trainerError } = await supabase
          .from('entrenador_asignacion')
          .select(`
            colacthor_id,
            colegio_actividad_horario!inner(
              colegio!inner(*)
            )
          `)
          .eq('ent_id', effectiveTrainerId)
          .eq('est_id', 1);

        if (trainerError) throw trainerError;
        
        // Extract unique schools from trainer assignments
        const uniqueSchools = new Map();
        trainerAssignments?.forEach(assignment => {
          const colegio = (assignment.colegio_actividad_horario as any)?.colegio;
          if (colegio) {
            uniqueSchools.set(colegio.col_id, colegio);
          }
        });
        
        colegiosData = Array.from(uniqueSchools.values());
      } else if (isCoordinator && user) {
        // For coordinators, load only assigned schools
        const { data: coordinatorColegios, error: colegiosError } = await supabase
          .from('colegio_coordinador')
          .select(`
            colegio!inner (*)
          `)
          .eq('usu_id', user.usu_id);

        if (colegiosError) throw colegiosError;
        colegiosData = coordinatorColegios?.map(cc => cc.colegio) || [];
      } else {
        // For other roles, load all schools
        const { data: allColegios, error: colegiosError } = await supabase
          .from('colegio')
          .select('*')
          .order('col_nombre');

        if (colegiosError) throw colegiosError;
        colegiosData = allColegios || [];
      }

      // Check if still mounted before updating state
      if (!isMountedRef.current) return;
      
      setColegios(colegiosData);

      // Load days - for trainers and auxiliaries, we'll filter this later based on selected school
      if ((isTrainer || isAuxiliary) && effectiveTrainerId) {
        // For trainers and auxiliaries, load only days where they have assignments
        const { data: trainerDays, error: daysError } = await supabase
          .from('entrenador_asignacion')
          .select(`
            colegio_actividad_horario!inner(
              dia!inner(*)
            )
          `)
          .eq('ent_id', effectiveTrainerId)
          .eq('est_id', 1);

        if (daysError) throw daysError;
        
        // Extract unique days
        const uniqueDays = new Map();
        trainerDays?.forEach(assignment => {
          const dia = (assignment.colegio_actividad_horario as any)?.dia;
          if (dia) {
            uniqueDays.set(dia.dia_id, dia);
          }
        });
        
        if (!isMountedRef.current) return;
        const diasData = Array.from(uniqueDays.values()).sort((a, b) => a.dia_id - b.dia_id);
        setDias(diasData);
      } else {
        // For other roles, load all days
        const { data: diasData, error: diasError } = await supabase
          .from('dia')
          .select('*')
          .order('dia_id');

        if (diasError) throw diasError;
        if (!isMountedRef.current) return;
        setDias(diasData || []);
      }

      // Load attendance states
      const { data: estadosData, error: estadosError } = await supabase
        .from('asistencia_estado')
        .select('*')
        .order('asisest_nombre');

      if (estadosError) throw estadosError;
      if (!isMountedRef.current) return;
      setAsistenciaEstados(estadosData || []);

    } catch (error: any) {
      // Ignore abort errors
      if (error?.name === 'AbortError') return;
      if (!isMountedRef.current) return;
      
      toast({
        title: "Error",
        description: "Error al cargar los datos iniciales",
        variant: "destructive"
      });
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [effectiveTrainerId, isTrainer, isAuxiliary, user, toast]);

  const loadDisciplines = useCallback(async () => {
    if (!selectedColegio || !selectedDia) return;

    try {
      let disciplinesQuery = supabase
        .from('colegio_actividad_horario')
        .select(`
          *,
          actividad!inner (*),
          dia!inner (*)
        `)
        .eq('col_id', parseInt(selectedColegio))
        .eq('dia_id', parseInt(selectedDia))
        .eq('est_id', 1) // Active only
        .order('colacthor_hora_inicio');

      // If user is trainer or auxiliary, filter by their assigned disciplines
      if ((isTrainer || isAuxiliary) && effectiveTrainerId) {
        const { data: trainerAssignments, error: trainerError } = await supabase
          .from('entrenador_asignacion')
          .select('colacthor_id')
          .eq('ent_id', effectiveTrainerId)
          .eq('est_id', 1);

        if (trainerError) throw trainerError;

        const allowedDisciplineIds = trainerAssignments?.map(ta => ta.colacthor_id) || [];
        if (allowedDisciplineIds.length > 0) {
          disciplinesQuery = disciplinesQuery.in('colacthor_id', allowedDisciplineIds);
        } else {
          // No assignments, show no disciplines
          if (isMountedRef.current) {
            setDisciplines([]);
            setSelectedDiscipline("");
          }
          return;
        }
      }

      const { data: disciplinesData, error } = await disciplinesQuery;
      
      if (error) throw error;
      if (isMountedRef.current) {
        setDisciplines(disciplinesData as DisciplineWithDetails[] || []);
        setSelectedDiscipline("");
      }

    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      if (!isMountedRef.current) return;
      
      toast({
        title: "Error",
        description: "Error al cargar las disciplinas",
        variant: "destructive"
      });
    }
  }, [selectedColegio, selectedDia, effectiveTrainerId, isTrainer, isAuxiliary, toast]);

  const loadChildren = useCallback(async () => {
    if (!selectedDiscipline) return;

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoadingChildren(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const disciplineId = parseInt(selectedDiscipline);

      // Get children assigned to this discipline
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('nino_asignacion')
        .select(`
          nino!inner (*)
        `)
        .eq('colacthor_id', disciplineId)
        .eq('est_id', 1); // Active assignments only

      if (assignmentsError) throw assignmentsError;

      // Get existing attendance records for this date and discipline
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('asistencia_nino')
        .select('*')
        .eq('asisnino_fecha', dateStr)
        .eq('colacthor_id', disciplineId);

      if (attendanceError) throw attendanceError;

      if (!isMountedRef.current) return;

      // Combine children with their attendance data
      const childrenWithAttendance: ChildWithAttendance[] = (assignmentsData || []).map(assignment => {
        const existingAttendance = (attendanceData || []).find(a => 
          a.nino_id === assignment.nino.nino_id
        );

        return {
          nino: assignment.nino,
          attendance: existingAttendance ? {
            asisnino_id: existingAttendance.asisnino_id,
            asisest_id: existingAttendance.asisest_id,
            asisnino_hora_tarde: existingAttendance.asisnino_hora_tarde 
              ? formatTimeForDisplay(existingAttendance.asisnino_hora_tarde)
              : undefined,
            asisnino_razon_justificado: existingAttendance.asisnino_razon_justificado || undefined,
            usu_registrador: existingAttendance.usu_registrador,
            asisnino_fecha_registrado: existingAttendance.asisnino_fecha_registrado
          } : undefined
        };
      });

      setChildren(childrenWithAttendance);

    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      if (!isMountedRef.current) return;
      
      toast({
        title: "Error",
        description: "Error al cargar los niños",
        variant: "destructive"
      });
    } finally {
      if (isMountedRef.current) {
        setLoadingChildren(false);
      }
    }
  }, [selectedDiscipline, selectedDate, toast]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (disciplineDebounceRef.current) {
        clearTimeout(disciplineDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedColegio && selectedDia) {
      loadDisciplines();
    } else {
      setDisciplines([]);
      setSelectedDiscipline("");
    }
  }, [selectedColegio, selectedDia, loadDisciplines]);

  // Debounced discipline change handler
  const handleDisciplineChange = useCallback((value: string) => {
    if (disciplineDebounceRef.current) {
      clearTimeout(disciplineDebounceRef.current);
    }
    disciplineDebounceRef.current = setTimeout(() => {
      setSelectedDiscipline(value);
    }, 150);
  }, []);

  useEffect(() => {
    if (selectedDiscipline && selectedDate) {
      loadChildren();
    } else {
      setChildren([]);
    }
  }, [selectedDiscipline, selectedDate, loadChildren]);

  // Auto-set date only when discipline changes AND user hasn't manually picked a date
  useEffect(() => {
    if (selectedDia && selectedDiscipline) {
      // Skip auto-date if user has manually changed the date
      if (userChangedDateRef.current) {
        return;
      }
      
      // Skip if we already set date for this discipline selection
      if (lastAutoDisciplineRef.current === selectedDiscipline) {
        return;
      }
      
      const today = new Date();
      const currentDayOfWeek = today.getDay();
      const targetDayOfWeek = parseInt(selectedDia);
      
      let daysToAdd = targetDayOfWeek - currentDayOfWeek;
      if (daysToAdd < 0) {
        daysToAdd += 7;
      }
      
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysToAdd);
      
      lastAutoDisciplineRef.current = selectedDiscipline;
      setSelectedDate(targetDate);
    }
  }, [selectedDia, selectedDiscipline]);

  // Reset userChangedDate flag when discipline changes (new context = new date logic)
  useEffect(() => {
    if (selectedDiscipline) {
      // When discipline changes, reset the user-changed flag for that new context
      // but keep it if we're just re-selecting the same discipline
      if (lastAutoDisciplineRef.current !== selectedDiscipline) {
        userChangedDateRef.current = false;
      }
    }
  }, [selectedDiscipline]);

  return {
    // Data
    colegios,
    dias,
    disciplines,
    children,
    asistenciaEstados,
    
    // State
    selectedColegio,
    selectedDia,
    selectedDiscipline,
    selectedDate,
    markAllPresent,
    loading,
    loadingChildren,
    
    // Setters
    setSelectedColegio,
    setSelectedDia,
    setSelectedDiscipline: handleDisciplineChange, // Use debounced handler
    setSelectedDate: handleUserDateChange, // Use wrapper to track user changes
    setMarkAllPresent,
    
    // Functions
    loadChildren
  };
};
