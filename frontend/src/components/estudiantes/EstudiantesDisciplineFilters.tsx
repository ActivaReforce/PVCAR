import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTrainerContext } from "@/hooks/useTrainerContext";
import { useStudentCounts } from "@/hooks/useStudentCounts";

interface DisciplineSlot {
  colacthor_id: number;
  actividad: { act_nombre: string } | null;
  dia: { dia_nombre: string } | null;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
}

interface EstudiantesDisciplineFiltersProps {
  selectedSchool: string;
  selectedDiscipline: number | null;
  onDisciplineSelect: (disciplineId: number | null) => void;
  showUnassigned?: boolean;
  onUnassignedSelect?: (showUnassigned: boolean) => void;
  searchQuery?: string;
}

const EstudiantesDisciplineFilters: React.FC<EstudiantesDisciplineFiltersProps> = ({
  selectedSchool,
  selectedDiscipline,
  onDisciplineSelect,
  showUnassigned = false,
  onUnassignedSelect,
  searchQuery
}) => {
  const [disciplineSlots, setDisciplineSlots] = useState<DisciplineSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { trainerId } = useTrainerContext();
  
  // Check if user is a trainer or auxiliary - hide unassigned tab for these roles
  const isTrainerRole = user?.roles?.some(role => role.rol_id === 3);
  const isAuxiliaryRole = user?.roles?.some(role => role.rol_id === 6 || role.rol_id === 7);
  const hideUnassignedTab = isTrainerRole || isAuxiliaryRole;
  
  // Get unassigned count for notification badge (only for non-trainer roles)
  const { counts } = useStudentCounts({
    selectedSchool,
    searchQuery
  });

  useEffect(() => {
    if (selectedSchool) {
      fetchDisciplineSlots();
    }
  }, [selectedSchool, user, trainerId]);

  const fetchDisciplineSlots = async () => {
    setLoading(true);
    try {
      // Get the school ID first
      const { data: schoolData, error: schoolError } = await supabase
        .from('colegio')
        .select('col_id')
        .eq('col_nombre', selectedSchool)
        .single();

      if (schoolError) throw schoolError;

      // For trainers (rol_id = 3) or auxiliaries (rol_id = 6/7), filter disciplines to only show assigned ones
      const isTrainer = user?.roles?.some(role => role.rol_id === 3);
      const isAuxiliary = user?.roles?.some(role => role.rol_id === 6 || role.rol_id === 7);
      let allowedDisciplineSlots: number[] | null = null;

      if (isTrainer || (isAuxiliary && trainerId)) {
        // Use trainerId for auxiliaries, otherwise use current user ID
        const effectiveUserId = isAuxiliary && trainerId ? trainerId : user?.usu_id;
        
        // Get trainer's assigned discipline slots
        const { data: trainerAssignments, error: trainerError } = await supabase
          .from('entrenador_asignacion')
          .select('colacthor_id')
          .eq('ent_id', effectiveUserId)
          .eq('est_id', 1); // Only active assignments

        if (trainerError) throw trainerError;
        allowedDisciplineSlots = trainerAssignments?.map(assignment => assignment.colacthor_id) || [];
      }

      // Get all active discipline slots for this school
      let disciplineSlotsQuery = supabase
        .from('colegio_actividad_horario')
        .select(`
          colacthor_id,
          colacthor_hora_inicio,
          colacthor_hora_fin,
          actividad!inner(act_nombre),
          dia!inner(dia_nombre)
        `)
        .eq('col_id', schoolData.col_id)
        .eq('est_id', 1) // Only active disciplines
        .order('dia_id')
        .order('colacthor_hora_inicio');

      // Filter by trainer's assignments if applicable
      if (allowedDisciplineSlots !== null && allowedDisciplineSlots.length > 0) {
        disciplineSlotsQuery = disciplineSlotsQuery.in('colacthor_id', allowedDisciplineSlots);
      }

      const { data: disciplineSlotsData, error: disciplineSlotsError } = await disciplineSlotsQuery;

      if (disciplineSlotsError) throw disciplineSlotsError;

      setDisciplineSlots(disciplineSlotsData || []);
    } catch (error) {
      console.error("Error fetching discipline slots:", error);
      toast({
        title: "Error",
        description: "Error al cargar las disciplinas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRange = (startTime: string | null, endTime: string | null) => {
    if (!startTime || !endTime) return '';
    
    // Format time from HH:MM:SS to HH:MM
    const formatTime = (time: string) => {
      return time.substring(0, 5);
    };
    
    return `${formatTime(startTime)} – ${formatTime(endTime)}`;
  };

  const handleTodosClick = () => {
    onDisciplineSelect(null);
    if (onUnassignedSelect) {
      onUnassignedSelect(false);
    }
  };

  const handleUnassignedClick = () => {
    onDisciplineSelect(null);
    if (onUnassignedSelect) {
      onUnassignedSelect(true);
    }
  };

  const handleDisciplineClick = (disciplineId: number) => {
    onDisciplineSelect(disciplineId);
    if (onUnassignedSelect) {
      onUnassignedSelect(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 bg-gray-100 p-4">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        <span className="text-sm text-muted-foreground">Cargando disciplinas...</span>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Select (< 640px) */}
      <div className="sm:hidden">
        <Select 
          value={
            showUnassigned ? 'unassigned' : 
            selectedDiscipline === null ? 'all' : 
            selectedDiscipline.toString()
          }
          onValueChange={(value) => {
            if (value === 'all') {
              handleTodosClick();
            } else if (value === 'unassigned') {
              handleUnassignedClick();
            } else {
              handleDisciplineClick(parseInt(value));
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar disciplina..." />
          </SelectTrigger>
          <SelectContent>
            {!hideUnassignedTab && (
              <SelectItem value="unassigned">
                Sin asignar {counts.unassigned > 0 && `(${counts.unassigned})`}
              </SelectItem>
            )}
            <SelectItem value="all">Ver todos</SelectItem>
            {disciplineSlots.map((slot) => (
              <SelectItem key={slot.colacthor_id} value={slot.colacthor_id.toString()}>
                {slot.actividad?.act_nombre || 'Sin nombre'} - {slot.dia?.dia_nombre}, {formatTimeRange(slot.colacthor_hora_inicio, slot.colacthor_hora_fin)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Buttons (≥ 640px) */}
      <div className="hidden sm:flex flex-wrap gap-2 bg-gray-100 p-4">
        {!hideUnassignedTab && (
          <Button 
            variant={showUnassigned ? "default" : "outline"} 
            size="sm" 
            onClick={handleUnassignedClick}
            className="flex items-center gap-2 relative"
          >
            Sin asignar
            {counts.unassigned > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs font-medium min-w-[20px]"
              >
                {counts.unassigned}
              </Badge>
            )}
          </Button>
        )}
        
        <Button 
          variant={selectedDiscipline === null && !showUnassigned ? "default" : "outline"} 
          size="sm" 
          onClick={handleTodosClick}
          className="flex items-center gap-2"
        >
          Ver todos
        </Button>

        {disciplineSlots.map((slot) => (
          <Button 
            key={slot.colacthor_id}
            variant={selectedDiscipline === slot.colacthor_id ? "default" : "outline"} 
            size="sm" 
            onClick={() => handleDisciplineClick(slot.colacthor_id)}
            className="flex flex-col items-center gap-0 h-auto py-2 px-3 min-w-[140px]"
          >
            <span className="font-medium text-xs">
              {slot.actividad?.act_nombre || 'Sin nombre'}
            </span>
            <span className="text-xs opacity-80">
              {slot.dia?.dia_nombre}, {formatTimeRange(slot.colacthor_hora_inicio, slot.colacthor_hora_fin)}
            </span>
          </Button>
        ))}
      </div>
    </>
  );
};

export default EstudiantesDisciplineFilters;
