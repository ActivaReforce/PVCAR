import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatTimeForDisplay } from "@/components/attendance/TimezoneUtils";
import AttendanceHeader from "@/components/attendance/AttendanceHeader";
import ChildAttendanceSessionRow from "@/components/attendance/ChildAttendanceSessionRow";

type Nino = Database['public']['Tables']['nino']['Row'];
type ColegioActividadHorario = Database['public']['Tables']['colegio_actividad_horario']['Row'];
type Actividad = Database['public']['Tables']['actividad']['Row'];
type Dia = Database['public']['Tables']['dia']['Row'];
type AsistenciaEstado = Database['public']['Tables']['asistencia_estado']['Row'];

interface SessionWithDetails extends ColegioActividadHorario {
  actividad: Actividad;
  dia: Dia;
}

interface ChildSessionData {
  nino: Nino;
  session: SessionWithDetails;
  attendance?: {
    asisnino_id: number;
    asisest_id: number;
    asisnino_hora_tarde?: string;
    asisnino_razon_justificado?: string;
    usu_registrador: number;
    asisnino_fecha_registrado: string;
  };
}

interface AttendanceRowData {
  key: string; // nino_id + session_id
  nino_id: number;
  session_id: number;
  status?: number;
  arrivalTime: string;
  justification: string;
  hasChanges: boolean;
  originalStatus?: number;
  originalArrivalTime: string;
  originalJustification: string;
}

const AsistenciasNinos = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [childSessionData, setChildSessionData] = useState<ChildSessionData[]>([]);
  const [asistenciaEstados, setAsistenciaEstados] = useState<AsistenciaEstado[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<Record<string, AttendanceRowData>>({});
  const [markAllPresent, setMarkAllPresent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedDate && asistenciaEstados.length > 0) {
      loadSessionsAndAttendanceForDate();
    }
  }, [selectedDate, asistenciaEstados]);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Load attendance states
      const { data: estadosData, error: estadosError } = await supabase
        .from('asistencia_estado')
        .select('*')
        .order('asisest_nombre');

      if (estadosError) throw estadosError;
      setAsistenciaEstados(estadosData || []);

    } catch (error) {
      console.error("Error loading initial data:", error);
      toast({
        title: "Error",
        description: "Error al cargar los datos iniciales",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSessionsAndAttendanceForDate = async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const dayName = format(selectedDate, 'EEEE', { locale: es }).toLowerCase();

      // Get all active sessions for the selected day
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('colegio_actividad_horario')
        .select(`
          *,
          actividad!inner (*),
          dia!inner (*)
        `)
        .eq('est_id', 1) // Active sessions only
        .eq('dia.dia_nombre', dayName)
        .order('colacthor_hora_inicio');

      if (sessionsError) throw sessionsError;

      // Get all children assigned to these sessions
      const sessionIds = (sessionsData || []).map(s => s.colacthor_id);
      if (sessionIds.length === 0) {
        setChildSessionData([]);
        setAttendanceRows({});
        return;
      }

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('nino_asignacion')
        .select(`
          nino!inner (*),
          colacthor_id
        `)
        .in('colacthor_id', sessionIds)
        .eq('est_id', 1); // Active assignments only

      if (assignmentsError) throw assignmentsError;

      // Get existing attendance records for this date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('asistencia_nino')
        .select('*')
        .eq('asisnino_fecha', dateStr)
        .in('colacthor_id', sessionIds);

      if (attendanceError) throw attendanceError;

      // Build child-session combinations
      const childSessions: ChildSessionData[] = [];
      const newAttendanceRows: Record<string, AttendanceRowData> = {};

      (assignmentsData || []).forEach(assignment => {
        const session = (sessionsData || []).find(s => s.colacthor_id === assignment.colacthor_id);
        if (session && session.actividad && session.dia) {
          const key = `${assignment.nino.nino_id}-${session.colacthor_id}`;
          
          // Find existing attendance for this child-session-date combination
          const existingAttendance = (attendanceData || []).find(a => 
            a.nino_id === assignment.nino.nino_id && 
            a.colacthor_id === session.colacthor_id
          );

          childSessions.push({
            nino: assignment.nino,
            session: session as SessionWithDetails,
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
          });

          // Initialize attendance row data
          const arrivalTime = existingAttendance?.asisnino_hora_tarde 
            ? formatTimeForDisplay(existingAttendance.asisnino_hora_tarde)
            : '';
          const justification = existingAttendance?.asisnino_razon_justificado || '';

          newAttendanceRows[key] = {
            key,
            nino_id: assignment.nino.nino_id,
            session_id: session.colacthor_id,
            status: existingAttendance?.asisest_id,
            arrivalTime,
            justification,
            hasChanges: false,
            originalStatus: existingAttendance?.asisest_id,
            originalArrivalTime: arrivalTime,
            originalJustification: justification
          };
        }
      });

      setChildSessionData(childSessions);
      setAttendanceRows(newAttendanceRows);

    } catch (error) {
      console.error("Error loading sessions and attendance:", error);
      toast({
        title: "Error",
        description: "Error al cargar las sesiones y asistencias",
        variant: "destructive"
      });
    }
  };

  const updateRowData = (key: string, updates: Partial<AttendanceRowData>) => {
    setAttendanceRows(prev => {
      const current = prev[key];
      if (!current) return prev;

      const updated = { ...current, ...updates };
      
      // Check if there are changes from original
      const hasChanges = 
        updated.status !== updated.originalStatus ||
        updated.arrivalTime !== updated.originalArrivalTime ||
        updated.justification !== updated.originalJustification;

      return {
        ...prev,
        [key]: { ...updated, hasChanges }
      };
    });
  };

  const handleStatusChange = (key: string, statusId: number) => {
    const currentRow = attendanceRows[key];
    if (!currentRow) return;

    const updates: Partial<AttendanceRowData> = { 
      status: statusId
    };

    // Only clear fields if switching to a different status type
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
      // Present or Absent - clear both fields
      updates.arrivalTime = '';
      updates.justification = '';
    }

    updateRowData(key, updates);
  };

  const handleMarkAllPresent = (checked: boolean) => {
    setMarkAllPresent(checked);
    if (checked && asistenciaEstados.length > 0) {
      const presenteStatus = asistenciaEstados.find(e => 
        e.asisest_nombre.toLowerCase() === 'presente'
      );
      
      if (presenteStatus) {
        Object.keys(attendanceRows).forEach(key => {
          updateRowData(key, {
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

  const saveRowAttendance = async (key: string) => {
    const rowData = attendanceRows[key];
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

    setSavingIds(prev => new Set([...prev, key]));
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // For Late status, format the time as HH:mm:ss for database storage
      let arrivalTime = null;
      if (rowData.status === 3 && rowData.arrivalTime) {
        // Add seconds if not present
        arrivalTime = rowData.arrivalTime.includes(':') && rowData.arrivalTime.split(':').length === 2 
          ? `${rowData.arrivalTime}:00` 
          : rowData.arrivalTime;
      }

      const now = new Date();
      const registrationTimestamp = now.toISOString().replace('T', ' ').substring(0, 19);

      const upsertData = {
        nino_id: rowData.nino_id,
        colacthor_id: rowData.session_id,
        asisest_id: rowData.status!,
        usu_registrador: user.usu_id,
        asisnino_fecha: dateStr,
        asisnino_hora_tarde: arrivalTime,
        asisnino_razon_justificado: rowData.status === 4 ? rowData.justification : null,
        asisnino_fecha_registrado: registrationTimestamp
      };

      const { error } = await supabase
        .from('asistencia_nino')
        .upsert(upsertData, {
          onConflict: 'nino_id,colacthor_id,asisnino_fecha',
          ignoreDuplicates: false
        });

      if (error) throw error;

      // Update original values to current values
      updateRowData(key, {
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

      // Reload data to get updated audit info
      loadSessionsAndAttendanceForDate();

    } catch (error: any) {
      console.error("Error saving child attendance:", error);
      
      let errorMessage = "Error al guardar la asistencia";
      if (error.code === '23503') {
        errorMessage = "Error de referencia. Por favor, intente nuevamente.";
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
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const undoRowChanges = (key: string) => {
    const rowData = attendanceRows[key];
    if (!rowData) return;

    updateRowData(key, {
      status: rowData.originalStatus,
      arrivalTime: rowData.originalArrivalTime,
      justification: rowData.originalJustification,
      hasChanges: false
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Cargando asistencias...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      <AttendanceHeader
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        markAllPresent={markAllPresent}
        onMarkAllPresentChange={handleMarkAllPresent}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">
            Asistencia de Niños - {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full" role="table" aria-label="Registro de asistencia de niños por sesión">
            <div className="space-y-2">
              {childSessionData.map(childSession => {
                const key = `${childSession.nino.nino_id}-${childSession.session.colacthor_id}`;
                const rowData = attendanceRows[key];
                if (!rowData) return null;

                return (
                  <ChildAttendanceSessionRow
                    key={key}
                    childSession={childSession}
                    rowData={rowData}
                    estados={asistenciaEstados}
                    isSaving={savingIds.has(key)}
                    onStatusChange={handleStatusChange}
                    onArrivalTimeChange={(key, time) => updateRowData(key, { arrivalTime: time })}
                    onJustificationChange={(key, text) => updateRowData(key, { justification: text })}
                    onSave={saveRowAttendance}
                    onUndo={undoRowChanges}
                  />
                );
              })}
              {childSessionData.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No hay sesiones programadas para este día
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AsistenciasNinos;
