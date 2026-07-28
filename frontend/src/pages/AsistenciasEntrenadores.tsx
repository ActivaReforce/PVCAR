import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TrainerAttendanceFilters from "@/components/attendance/TrainerAttendanceFilters";
import TrainerAttendanceList from "@/components/attendance/TrainerAttendanceList";
import TrainerAttendanceEmptyState from "@/components/attendance/TrainerAttendanceEmptyState";
import AttendanceErrorBoundary from "@/components/attendance/AttendanceErrorBoundary";
import { formatTimeForDisplay, formatTimeForDatabase } from "@/components/attendance/TimezoneUtils";
import { Loader2 } from "lucide-react";
import {
  EntrenadorWithDetails,
  AuxiliaryWithDetails,
  AttendanceUser,
  AttendanceRowData,
  AsistenciaEstado,
  Colegio,
  Dia
} from "@/components/attendance/TrainerAttendanceTypes";

const AsistenciasEntrenadoresContent = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedColegio, setSelectedColegio] = useState<string>("");
  const [selectedDia, setSelectedDia] = useState<string>("");
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [dias, setDias] = useState<Dia[]>([]);
  const [entrenadores, setEntrenadores] = useState<EntrenadorWithDetails[]>([]);
  const [attendanceUsers, setAttendanceUsers] = useState<AttendanceUser[]>([]);
  const [asistenciaEstados, setAsistenciaEstados] = useState<AsistenciaEstado[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<Record<number, AttendanceRowData>>({});
  const [markAllPresent, setMarkAllPresent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingTrainers, setLoadingTrainers] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();

  // Track if user has manually changed the date to prevent auto-overwrite
  const userChangedDateRef = useRef(false);
  // Track the last day that triggered auto-date to prevent re-triggering  
  const lastAutoDiaRef = useRef<string>("");
  // AbortController ref for async operations
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track mounted state
  const isMountedRef = useRef(true);

  // Wrapper to mark user-initiated date changes
  const handleUserDateChange = useCallback((date: Date) => {
    userChangedDateRef.current = true;
    setSelectedDate(date);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedColegio && selectedDia) {
      loadFilteredEntrenadores();
    } else {
      setEntrenadores([]);
      setAttendanceUsers([]);
      setAttendanceRows({});
    }
  }, [selectedColegio, selectedDia]);

  // Auto-set date only when day changes AND user hasn't manually picked a date
  useEffect(() => {
    if (selectedDia) {
      // Skip auto-date if user has manually changed the date
      if (userChangedDateRef.current) {
        return;
      }
      
      // Skip if we already set date for this day selection
      if (lastAutoDiaRef.current === selectedDia) {
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
      
      lastAutoDiaRef.current = selectedDia;
      setSelectedDate(targetDate);
    }
  }, [selectedDia]);

  // Reset userChangedDate flag when day changes (new context = new date logic)
  useEffect(() => {
    if (selectedDia && lastAutoDiaRef.current !== selectedDia) {
      userChangedDateRef.current = false;
    }
  }, [selectedDia]);

  useEffect(() => {
    if (selectedDate && attendanceUsers.length > 0) {
      loadAttendanceForDate();
    }
  }, [selectedDate, attendanceUsers]);

  const loadInitialData = async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);

      // Check if user is a coordinator (rol_id = 2)
      const isCoordinator = user?.roles?.some(role => role.rol_id === 2);
      
      let colegiosData;
      
      if (isCoordinator && user) {
        // For coordinators, load only assigned schools
        const { data: coordinatorColegios, error: colegiosError } = await supabase
          .from('colegio_coordinador')
          .select(`
            colegio!inner (*)
          `)
          .eq('usu_id', user.usu_id);

        if (colegiosError) throw colegiosError;

        colegiosData = coordinatorColegios?.map(cc => cc.colegio).sort((a, b) => a.col_nombre.localeCompare(b.col_nombre)) || [];
      } else {
        // For other roles, load all schools
        const { data: allColegios, error: colegiosError } = await supabase
          .from('colegio')
          .select('*')
          .order('col_nombre');

        if (colegiosError) throw colegiosError;

        colegiosData = allColegios || [];
      }

      if (!isMountedRef.current) return;

      // Load days
      const { data: diasData, error: diasError } = await supabase
        .from('dia')
        .select('*')
        .order('dia_id');

      if (diasError) throw diasError;

      if (!isMountedRef.current) return;

      // Load attendance states
      const { data: estadosData, error: estadosError } = await supabase
        .from('asistencia_estado')
        .select('*')
        .order('asisest_nombre');

      if (estadosError) throw estadosError;

      if (!isMountedRef.current) return;

      setColegios(colegiosData);
      setDias(diasData || []);
      setAsistenciaEstados(estadosData || []);

    } catch (error: any) {
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
  };

  const loadFilteredEntrenadores = async () => {
    if (!selectedColegio || !selectedDia) return;

    setLoadingTrainers(true);
    try {

      // Get trainers assigned to activities in the selected school and weekday
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('entrenador_asignacion')
        .select(`
          ent_id,
          colegio_actividad_horario!inner (
            col_id,
            dia_id
          ),
          entrenador!inner (
            *,
            usuario!entrenador_ent_id_fkey (*)
          )
        `)
        .eq('colegio_actividad_horario.col_id', parseInt(selectedColegio))
        .eq('colegio_actividad_horario.dia_id', parseInt(selectedDia))
        .eq('est_id', 1); // Active assignments only

      if (assignmentsError) {
        console.error("Error loading trainer assignments:", assignmentsError);
        throw assignmentsError;
      }

      console.log("Found trainer assignments:", assignmentsData?.length || 0);

      // Extract unique trainers
      const uniqueTrainers = new Map<number, EntrenadorWithDetails>();
      
      (assignmentsData || []).forEach(assignment => {
        const trainer = assignment.entrenador;
        if (trainer && trainer.usuario && !Array.isArray(trainer.usuario)) {
          uniqueTrainers.set(trainer.ent_id, trainer as EntrenadorWithDetails);
        }
      });

      const filteredEntrenadores = Array.from(uniqueTrainers.values());
      console.log("Unique trainers found:", filteredEntrenadores.length);
      
      setEntrenadores(filteredEntrenadores);

      // Load auxiliaries linked to these trainers
      const trainerIds = filteredEntrenadores.map(t => t.ent_id);
      let auxiliaries: AuxiliaryWithDetails[] = [];

      if (trainerIds.length > 0) {
        const { data: auxiliariesData, error: auxError } = await supabase
          .from('entrenador_auxiliar')
          .select(`
            *,
            usuario!entrenador_auxiliar_usu_id_fkey (*),
            rol!entrenador_auxiliar_rol_id_fkey (*)
          `)
          .in('ent_id', trainerIds)
          .eq('est_id', 1); // Active auxiliaries only

        if (auxError) {
          console.error("Error loading auxiliaries:", auxError);
        } else {
          auxiliaries = (auxiliariesData || []).filter(
            aux => aux.usuario && !Array.isArray(aux.usuario) && 
                   aux.rol && !Array.isArray(aux.rol)
          ) as AuxiliaryWithDetails[];
          console.log("Auxiliaries found:", auxiliaries.length);
        }
      }

      // Combine trainers and auxiliaries into unified list
      const combinedUsers: AttendanceUser[] = [
        ...filteredEntrenadores.map(trainer => ({
          type: 'trainer' as const,
          data: trainer
        })),
        ...auxiliaries.map(aux => ({
          type: 'auxiliary' as const,
          data: aux
        }))
      ];

      setAttendanceUsers(combinedUsers);

      // Initialize attendance rows
      const initialRows: Record<number, AttendanceRowData> = {};
      
      filteredEntrenadores.forEach(entrenador => {
        initialRows[entrenador.ent_id] = {
          id: entrenador.ent_id,
          userType: 'trainer',
          status: undefined,
          arrivalTime: '',
          justification: '',
          hasChanges: false,
          originalStatus: undefined,
          originalArrivalTime: '',
          originalJustification: ''
        };
      });

      auxiliaries.forEach(aux => {
        initialRows[aux.usu_id] = {
          id: aux.usu_id,
          userType: 'auxiliary',
          status: undefined,
          arrivalTime: '',
          justification: '',
          hasChanges: false,
          originalStatus: undefined,
          originalArrivalTime: '',
          originalJustification: ''
        };
      });

      setAttendanceRows(initialRows);

    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      if (!isMountedRef.current) return;
      
      toast({
        title: "Error",
        description: "Error al cargar los entrenadores filtrados",
        variant: "destructive"
      });
    } finally {
      if (isMountedRef.current) {
        setLoadingTrainers(false);
      }
    }
  };

  const loadAttendanceForDate = async () => {
    if (!selectedColegio) return;
    
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Load trainer attendance
      const { data: trainerAttendance, error: trainerError } = await supabase
        .from('asistencia_entrenador')
        .select('*')
        .eq('asisent_fecha', dateStr)
        .eq('col_id', parseInt(selectedColegio));

      if (trainerError) throw trainerError;

      // Load auxiliary attendance
      const { data: auxiliaryAttendance, error: auxError } = await supabase
        .from('asistencia_auxiliar')
        .select('*')
        .eq('asisaux_fecha', dateStr)
        .eq('col_id', parseInt(selectedColegio));

      if (auxError) throw auxError;

      const updatedRows = { ...attendanceRows };

      // Reset to defaults first
      attendanceUsers.forEach(user => {
        const id = user.type === 'trainer' ? user.data.ent_id : user.data.usu_id;
        updatedRows[id] = {
          id,
          userType: user.type,
          status: undefined,
          arrivalTime: '',
          justification: '',
          hasChanges: false,
          originalStatus: undefined,
          originalArrivalTime: '',
          originalJustification: ''
        };
      });

      // Apply existing trainer attendance
      trainerAttendance?.forEach(record => {
        if (updatedRows[record.ent_id]) {
          const arrivalTime = record.asisent_hora_tarde 
            ? formatTimeForDisplay(record.asisent_hora_tarde)
            : '';
          
          updatedRows[record.ent_id] = {
            id: record.ent_id,
            userType: 'trainer',
            status: record.asisest_id,
            arrivalTime,
            justification: record.asisent_razon_justificado || '',
            hasChanges: false,
            originalStatus: record.asisest_id,
            originalArrivalTime: arrivalTime,
            originalJustification: record.asisent_razon_justificado || ''
          };
        }
      });

      // Apply existing auxiliary attendance
      auxiliaryAttendance?.forEach(record => {
        if (updatedRows[record.usu_id]) {
          const arrivalTime = record.asisaux_hora_tarde 
            ? formatTimeForDisplay(record.asisaux_hora_tarde)
            : '';
          
          updatedRows[record.usu_id] = {
            id: record.usu_id,
            userType: 'auxiliary',
            status: record.asisest_id,
            arrivalTime,
            justification: record.asisaux_razon_justificado || '',
            hasChanges: false,
            originalStatus: record.asisest_id,
            originalArrivalTime: arrivalTime,
            originalJustification: record.asisaux_razon_justificado || ''
          };
        }
      });

      setAttendanceRows(updatedRows);

    } catch (error) {
      console.error("Error loading attendance for date:", error);
      toast({
        title: "Error",
        description: "Error al cargar las asistencias",
        variant: "destructive"
      });
    }
  };

  const updateRowData = (id: number, updates: Partial<AttendanceRowData>) => {
    setAttendanceRows(prev => {
      const current = prev[id];
      if (!current) return prev;

      const updated = { ...current, ...updates };
      
      // Check if there are changes from original
      const hasChanges = 
        updated.status !== updated.originalStatus ||
        updated.arrivalTime !== updated.originalArrivalTime ||
        updated.justification !== updated.originalJustification;

      return {
        ...prev,
        [id]: { ...updated, hasChanges }
      };
    });
  };

  const handleStatusChange = (id: number, statusId: number) => {
    const currentRow = attendanceRows[id];
    if (!currentRow) return;

    const updates: Partial<AttendanceRowData> = { 
      status: statusId
    };

    if (statusId === 3) { // Tarde (Late)
      if (currentRow.status !== 3) {
        updates.arrivalTime = '';
      }
      updates.justification = '';
    } else if (statusId === 4) { // Justificado
      if (currentRow.status !== 4) {
        updates.justification = '';
      }
      updates.arrivalTime = '';
    } else {
      updates.arrivalTime = '';
      updates.justification = '';
    }

    updateRowData(id, updates);
  };

  const handleMarkAllPresent = (checked: boolean) => {
    setMarkAllPresent(checked);
    if (checked && asistenciaEstados.length > 0) {
      const presenteStatus = asistenciaEstados.find(e => 
        e.asisest_nombre.toLowerCase() === 'presente'
      );
      
      if (presenteStatus) {
        attendanceUsers.forEach(user => {
          const id = user.type === 'trainer' ? user.data.ent_id : user.data.usu_id;
          updateRowData(id, {
            status: presenteStatus.asisest_id,
            arrivalTime: '',
            justification: ''
          });
        });
      }
    }
  };

  const validateRowData = (rowData: AttendanceRowData): string | null => {
    if (!rowData.status) {
      return "Debe seleccionar un estado de asistencia";
    }
    if (rowData.status === 3 && !rowData.arrivalTime.trim()) {
      return "Debe especificar la hora de llegada para asistencia tardía";
    }
    if (rowData.status === 4 && !rowData.justification.trim()) {
      return "Debe proporcionar una justificación";
    }
    return null;
  };

  const saveRowAttendance = async (id: number) => {
    const rowData = attendanceRows[id];
    if (!rowData || !user) {
      toast({
        title: "Error",
        description: "No se pudo obtener la información del usuario registrador",
        variant: "destructive"
      });
      return;
    }

    const error = validateRowData(rowData);
    if (error) {
      toast({
        title: "Error de validación",
        description: error,
        variant: "destructive"
      });
      return;
    }

    setSavingIds(prev => new Set([...prev, id]));
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Handle arrival time as pure time field (no timezone conversion)
      let arrivalTime = null;
      if (rowData.status === 3 && rowData.arrivalTime) {
        arrivalTime = formatTimeForDatabase(rowData.arrivalTime);
      }

      const now = new Date();
      const registrationTimestamp = now.toISOString().replace('T', ' ').substring(0, 19);

      if (rowData.userType === 'trainer') {
        // Save to asistencia_entrenador
        const upsertData = {
          ent_id: id,
          asisest_id: rowData.status!,
          usu_registrador: user.usu_id,
          asisent_fecha: dateStr,
          asisent_hora_tarde: arrivalTime,
          asisent_razon_justificado: rowData.status === 4 ? rowData.justification : null,
          asisent_fecha_registrado: registrationTimestamp,
          col_id: parseInt(selectedColegio)
        };

        const { error } = await supabase
          .from('asistencia_entrenador')
          .upsert(upsertData, {
            onConflict: 'ent_id,asisent_fecha,col_id',
            ignoreDuplicates: false
          });

        if (error) throw error;
      } else {
        // Save to asistencia_auxiliar
        const upsertData = {
          usu_id: id,
          asisest_id: rowData.status!,
          usu_registrador: user.usu_id,
          asisaux_fecha: dateStr,
          asisaux_hora_tarde: arrivalTime,
          asisaux_razon_justificado: rowData.status === 4 ? rowData.justification : null,
          asisaux_fecha_registrado: registrationTimestamp,
          col_id: parseInt(selectedColegio)
        };

        const { error } = await supabase
          .from('asistencia_auxiliar')
          .upsert(upsertData, {
            onConflict: 'usu_id,asisaux_fecha,col_id',
            ignoreDuplicates: false
          });

        if (error) throw error;
      }

      updateRowData(id, {
        originalStatus: rowData.status,
        originalArrivalTime: rowData.arrivalTime,
        originalJustification: rowData.justification,
        hasChanges: false
      });

      const confirmationMessage = rowData.status === 3 && rowData.arrivalTime
        ? `Asistencia guardada correctamente. Hora de llegada: ${rowData.arrivalTime}`
        : "Asistencia guardada correctamente";

      toast({
        title: "Éxito",
        description: confirmationMessage
      });

    } catch (error: any) {
      console.error("Error saving attendance:", error);
      
      let errorMessage = "Error al guardar la asistencia";
      if (error.code === '23503') {
        errorMessage = "Error de usuario registrador. Por favor, intente nuevamente.";
      } else if (error.code === '22007') {
        errorMessage = "Error en el formato de hora. Verifique el tiempo ingresado.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSavingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const undoRowChanges = (id: number) => {
    const rowData = attendanceRows[id];
    if (!rowData) return;

    updateRowData(id, {
      status: rowData.originalStatus,
      arrivalTime: rowData.originalArrivalTime,
      justification: rowData.originalJustification,
      hasChanges: false
    });
  };

  const handleDateChange = (date: Date) => {
    if (!selectedDia) {
      toast({
        title: "Seleccione un día",
        description: "Primero debe seleccionar un día de la semana",
        variant: "destructive"
      });
      return;
    }
    
    const targetDayOfWeek = parseInt(selectedDia);
    const selectedDayOfWeek = date.getDay();
    
    if (selectedDayOfWeek !== targetDayOfWeek) {
      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      toast({
        title: "Error de validación",
        description: `La fecha seleccionada debe ser un ${dayNames[targetDayOfWeek]}`,
        variant: "destructive"
      });
      return;
    }
    
    // Use the wrapper that marks user-initiated changes
    handleUserDateChange(date);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-3 sm:p-4 lg:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Cargando asistencias...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
          Asistencia de Entrenadores
        </h1>

        <TrainerAttendanceFilters
          selectedColegio={selectedColegio}
          selectedDia={selectedDia}
          selectedDate={selectedDate}
          colegios={colegios}
          dias={dias}
          markAllPresent={markAllPresent}
          showMarkAllOption={attendanceUsers.length > 0}
          onColegioChange={setSelectedColegio}
          onDiaChange={setSelectedDia}
          onDateChange={handleDateChange}
          onMarkAllChange={handleMarkAllPresent}
        />

        {loadingTrainers ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Cargando entrenadores...</span>
          </div>
        ) : (
          <>
            <TrainerAttendanceList
              attendanceUsers={attendanceUsers}
              attendanceRows={attendanceRows}
              asistenciaEstados={asistenciaEstados}
              selectedDate={selectedDate}
              savingIds={savingIds}
              onStatusChange={handleStatusChange}
              onArrivalTimeChange={(id, time) => updateRowData(id, { arrivalTime: time })}
              onJustificationChange={(id, text) => updateRowData(id, { justification: text })}
              onSave={saveRowAttendance}
              onUndo={undoRowChanges}
            />

            <TrainerAttendanceEmptyState
              selectedColegio={selectedColegio}
              selectedDia={selectedDia}
              entrenadores={entrenadores}
            />
          </>
        )}
      </div>
    </div>
  );
};

const AsistenciasEntrenadores = () => {
  return (
    <AttendanceErrorBoundary>
      <AsistenciasEntrenadoresContent />
    </AttendanceErrorBoundary>
  );
};

export default AsistenciasEntrenadores;
