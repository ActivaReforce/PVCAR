import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRequestQueue } from "@/hooks/useRequestQueue";
import { formatTimeForDatabase } from "./TimezoneUtils";
import AttendanceChildRow from "./AttendanceChildRow";

type Nino = Database['public']['Tables']['nino']['Row'];
type AsistenciaEstado = Database['public']['Tables']['asistencia_estado']['Row'];

interface ChildWithAttendance {
  nino: Nino;
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
  nino_id: number;
  status?: number;
  arrivalTime: string;
  justification: string;
  hasChanges: boolean;
  originalStatus?: number;
  originalArrivalTime: string;
  originalJustification: string;
}

interface AttendanceChildrenTableProps {
  children: ChildWithAttendance[];
  disciplineName: string;
  selectedDate: Date;
  selectedDisciplineId: number;
  asistenciaEstados: AsistenciaEstado[];
  markAllPresent: boolean;
  onDataRefresh: () => void;
}

const AttendanceChildrenTable = ({
  children,
  disciplineName,
  selectedDate,
  selectedDisciplineId,
  asistenciaEstados,
  markAllPresent,
  onDataRefresh
}: AttendanceChildrenTableProps) => {
  const [attendanceRows, setAttendanceRows] = useState<Record<number, AttendanceRowData>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Request queue to prevent race conditions on rapid saves
  const { enqueue: enqueueRequest, isProcessing } = useRequestQueue();
  
  // Track previous props for stable reinitialization
  const prevChildrenRef = useRef<ChildWithAttendance[]>([]);
  const prevDateRef = useRef<string>("");

  // Memoize formatted date for header
  const formattedDateHeader = useMemo(() => 
    format(selectedDate, "EEEE, d 'de' MMMM", { locale: es }),
    [selectedDate]
  );

  // Memoize dateStr for save operations
  const dateStr = useMemo(() => 
    format(selectedDate, 'yyyy-MM-dd'),
    [selectedDate]
  );

  // Initialize attendance rows when children data OR date changes
  useEffect(() => {
    // Check if date has changed
    const dateChanged = prevDateRef.current !== dateStr;
    
    // Check if children data has actually changed (by comparing IDs and attendance)
    const prevIds = prevChildrenRef.current.map(c => c.nino.nino_id).sort().join(',');
    const newIds = children.map(c => c.nino.nino_id).sort().join(',');
    
    const hasChildrenChanged = prevIds !== newIds || 
      children.some((child) => {
        const prevChild = prevChildrenRef.current.find(c => c.nino.nino_id === child.nino.nino_id);
        return !prevChild || prevChild.attendance?.asisest_id !== child.attendance?.asisest_id;
      });

    // Reinitialize if date changed OR children data changed
    if (dateChanged || hasChildrenChanged) {
      const newAttendanceRows: Record<number, AttendanceRowData> = {};

      children.forEach(child => {
        const arrivalTime = child.attendance?.asisnino_hora_tarde || '';
        const justification = child.attendance?.asisnino_razon_justificado || '';

        newAttendanceRows[child.nino.nino_id] = {
          nino_id: child.nino.nino_id,
          status: child.attendance?.asisest_id,
          arrivalTime,
          justification,
          hasChanges: false,
          originalStatus: child.attendance?.asisest_id,
          originalArrivalTime: arrivalTime,
          originalJustification: justification
        };
      });

      setAttendanceRows(newAttendanceRows);
      prevChildrenRef.current = children;
      prevDateRef.current = dateStr;
    }
  }, [children, dateStr]);

  const updateRowData = useCallback((ninoId: number, updates: Partial<AttendanceRowData>) => {
    setAttendanceRows(prev => {
      const current = prev[ninoId];
      if (!current) return prev;

      const updated = { ...current, ...updates };
      
      // Check if there are changes from original
      const hasChanges = 
        updated.status !== updated.originalStatus ||
        updated.arrivalTime !== updated.originalArrivalTime ||
        updated.justification !== updated.originalJustification;

      return {
        ...prev,
        [ninoId]: { ...updated, hasChanges }
      };
    });
  }, []);

  const handleStatusChange = useCallback((ninoId: number, statusId: number) => {
    setAttendanceRows(prev => {
      const currentRow = prev[ninoId];
      if (!currentRow) return prev;

      const updates: Partial<AttendanceRowData> = { 
        status: statusId
      };

      // Clear fields based on status type
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

      const updated = { ...currentRow, ...updates };
      const hasChanges = 
        updated.status !== updated.originalStatus ||
        updated.arrivalTime !== updated.originalArrivalTime ||
        updated.justification !== updated.originalJustification;

      return {
        ...prev,
        [ninoId]: { ...updated, hasChanges }
      };
    });
  }, []);

  const applyPresentToAll = useCallback(() => {
    const presenteStatus = asistenciaEstados.find(e => 
      e.asisest_nombre.toLowerCase() === 'presente'
    );
    
    if (presenteStatus) {
      setAttendanceRows(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(ninoIdStr => {
          const ninoId = parseInt(ninoIdStr);
          const current = updated[ninoId];
          if (current) {
            const newData = {
              ...current,
              status: presenteStatus.asisest_id,
              arrivalTime: '',
              justification: ''
            };
            newData.hasChanges = 
              newData.status !== newData.originalStatus ||
              newData.arrivalTime !== newData.originalArrivalTime ||
              newData.justification !== newData.originalJustification;
            updated[ninoId] = newData;
          }
        });
        return updated;
      });

      toast({
        title: "Éxito",
        description: "Todos los niños han sido marcados como presentes",
      });
    }
  }, [asistenciaEstados, toast]);

  const validateRowData = useCallback((rowData: AttendanceRowData): string | null => {
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
  }, []);

  const saveRowAttendance = useCallback(async (ninoId: number) => {
    const rowData = attendanceRows[ninoId];
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

    // Check if already processing this child's attendance
    const requestId = `attendance-${ninoId}-${selectedDisciplineId}-${dateStr}`;
    if (isProcessing(requestId)) {
      console.log(`Attendance save for nino ${ninoId} already in progress, queuing...`);
    }

    setSavingIds(prev => new Set([...prev, ninoId]));
    
    // Use request queue to prevent race conditions
    try {
      await enqueueRequest(requestId, async () => {
      // For Late status, format the time as HH:mm:ss for database storage
      let arrivalTime = null;
      if (rowData.status === 3 && rowData.arrivalTime) {
        arrivalTime = formatTimeForDatabase(rowData.arrivalTime);
      }

      const now = new Date();
      const registrationTimestamp = now.toISOString().replace('T', ' ').substring(0, 19);

      const upsertData = {
        nino_id: rowData.nino_id,
        colacthor_id: selectedDisciplineId,
        asisest_id: rowData.status!,
        usu_registrador: user.usu_id,
        asisnino_fecha: dateStr,
        asisnino_hora_tarde: arrivalTime,
        asisnino_razon_justificado: rowData.status === 4 ? rowData.justification : null,
        asisnino_fecha_registrado: registrationTimestamp
      };

      const { error: saveError } = await supabase
        .from('asistencia_nino')
        .upsert(upsertData, {
          onConflict: 'nino_id,colacthor_id,asisnino_fecha',
          ignoreDuplicates: false
        });

        if (saveError) throw saveError;

        // Update original values to current values
        updateRowData(ninoId, {
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
      }); // End of enqueueRequest

      // Refresh data to get updated audit info
      onDataRefresh();

    } catch (saveError: any) {
      console.error("Error saving child attendance:", saveError);
      
      let errorMessage = "Error al guardar la asistencia";
      if (saveError.code === '23503') {
        errorMessage = "Error de referencia. Por favor, intente nuevamente.";
      } else if (saveError.code === '22007') {
        errorMessage = "Error en el formato de hora. Verifique el tiempo ingresado.";
      } else if (saveError.message) {
        errorMessage = saveError.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSavingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(ninoId);
        return newSet;
      });
    }
  }, [attendanceRows, user, selectedDisciplineId, dateStr, validateRowData, updateRowData, toast, onDataRefresh, enqueueRequest, isProcessing]);

  const undoRowChanges = useCallback((ninoId: number) => {
    setAttendanceRows(prev => {
      const rowData = prev[ninoId];
      if (!rowData) return prev;

      return {
        ...prev,
        [ninoId]: {
          ...rowData,
          status: rowData.originalStatus,
          arrivalTime: rowData.originalArrivalTime,
          justification: rowData.originalJustification,
          hasChanges: false
        }
      };
    });
  }, []);

  // Stable callback refs for row handlers
  const handleArrivalTimeChange = useCallback((ninoId: number, time: string) => {
    updateRowData(ninoId, { arrivalTime: time });
  }, [updateRowData]);

  const handleJustificationChange = useCallback((ninoId: number, text: string) => {
    updateRowData(ninoId, { justification: text });
  }, [updateRowData]);

  if (children.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          No hay niños asignados a esta disciplina
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
        <h2 className="text-lg sm:text-xl font-semibold">
          Asistencia&nbsp;‑&nbsp;{disciplineName}&nbsp;
          ({formattedDateHeader})
        </h2>

        {markAllPresent && (
          <Button type="button" onClick={applyPresentToAll} variant="outline" size="sm">
            Aplicar "Presente" a todos
          </Button>
        )}
      </div>

      {/* Lista de estudiantes */}
      <div className="space-y-2" role="table" aria-label="Registro de asistencia de alumno">
        {children.map(child => {
          const rowData = attendanceRows[child.nino.nino_id];
          if (!rowData) return null;

          return (
            <AttendanceChildRow
              key={child.nino.nino_id}
              child={child}
              rowData={rowData}
              estados={asistenciaEstados}
              isSaving={savingIds.has(child.nino.nino_id)}
              isMobile={isMobile}
              onStatusChange={handleStatusChange}
              onArrivalTimeChange={handleArrivalTimeChange}
              onJustificationChange={handleJustificationChange}
              onSave={saveRowAttendance}
              onUndo={undoRowChanges}
            />
          );
        })}
      </div>
    </>
  );
};

export default AttendanceChildrenTable;
