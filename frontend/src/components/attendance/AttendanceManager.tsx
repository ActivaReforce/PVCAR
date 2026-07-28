
import { useToast } from "@/hooks/use-toast";
import AttendanceFilters from "./AttendanceFilters";
import AttendanceChildrenTable from "./AttendanceChildrenTable";
import AttendanceErrorBoundary from "./AttendanceErrorBoundary";
import { useAttendanceData } from "@/hooks/useAttendanceData";
import { useAuth } from "@/contexts/AuthContext";
import { useTrainerContext } from "@/hooks/useTrainerContext";
import { Loader2 } from "lucide-react";

const AttendanceManagerContent = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { trainerName } = useTrainerContext();
  
  const {
    colegios,
    dias,
    disciplines,
    children,
    asistenciaEstados,
    selectedColegio,
    selectedDia,
    selectedDiscipline,
    selectedDate,
    markAllPresent,
    loading,
    loadingChildren,
    setSelectedColegio,
    setSelectedDia,
    setSelectedDiscipline,
    setSelectedDate,
    setMarkAllPresent,
    loadChildren
  } = useAttendanceData();

  // Check if current user is auxiliary (roles 6 or 7)
  const isAuxiliary = user?.roles?.some(role => role.rol_id === 6 || role.rol_id === 7);

  const handleMarkAllPresent = (checked: boolean) => {
    setMarkAllPresent(checked);
    if (checked && asistenciaEstados.length > 0) {
      const presenteStatus = asistenciaEstados.find(e => 
        e.asisest_nombre.toLowerCase() === 'presente'
      );
      
      if (presenteStatus) {
        toast({
          title: "Información",
          description: "Use el botón 'Aplicar a todos' en la tabla para marcar todos como presentes",
        });
      }
    }
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
    
    // Validate that the selected date matches the chosen weekday
    if (selectedDayOfWeek !== targetDayOfWeek) {
      toast({
        title: "Error de validación",
        description: `La fecha seleccionada debe ser un ${getDayName(targetDayOfWeek)}`,
        variant: "destructive"
      });
      return;
    }
    
    setSelectedDate(date);
  };

  const getDayName = (dayId: number): string => {
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    return dayNames[dayId] || 'día';
  };

  const getSelectedDisciplineName = (): string => {
    if (!selectedDiscipline) return "";
    const discipline = disciplines.find(d => d.colacthor_id.toString() === selectedDiscipline);
    // Guard against null/undefined actividad
    return discipline?.actividad?.act_nombre ?? "";
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Cargando datos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Gestión de Asistencias
          </h1>
          {isAuxiliary && trainerName && (
            <p className="text-sm text-muted-foreground mt-1">
              Asistencia de alumnos del entrenador {trainerName}
            </p>
          )}
        </div>

        <AttendanceFilters
          colegios={colegios}
          dias={dias}
          disciplines={disciplines}
          selectedColegio={selectedColegio}
          selectedDia={selectedDia}
          selectedDiscipline={selectedDiscipline}
          selectedDate={selectedDate}
          markAllPresent={markAllPresent}
          onColegioChange={setSelectedColegio}
          onDiaChange={setSelectedDia}
          onDisciplineChange={setSelectedDiscipline}
          onDateChange={handleDateChange}
          onMarkAllPresentChange={handleMarkAllPresent}
        />

        {selectedDiscipline && (
          <>
            {loadingChildren ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-muted-foreground">Cargando estudiantes...</span>
              </div>
            ) : (
              <AttendanceChildrenTable
                children={children}
                disciplineName={getSelectedDisciplineName()}
                selectedDate={selectedDate}
                selectedDisciplineId={parseInt(selectedDiscipline)}
                asistenciaEstados={asistenciaEstados}
                markAllPresent={markAllPresent}
                onDataRefresh={loadChildren}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

const AttendanceManager = () => {
  return (
    <AttendanceErrorBoundary>
      <AttendanceManagerContent />
    </AttendanceErrorBoundary>
  );
};

export default AttendanceManager;
