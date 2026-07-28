import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTrainerEvaluationContext } from '@/hooks/useTrainerEvaluationContext';

interface School {
  col_id: number;
  col_nombre: string;
  disciplines: Discipline[];
}

interface Discipline {
  colacthor_id: number;
  actividad: {
    act_nombre: string;
  };
  dia: {
    dia_nombre: string;
  };
  colacthor_hora_inicio: string;
  colacthor_hora_fin: string;
}

interface LinkedDiscipline {
  evaasig_id: number;
  colacthor_id: number;
  colegio: {
    col_nombre: string;
  };
  colegio_actividad_horario: {
    col_id: number;
    actividad: {
      act_nombre: string;
    };
    dia: {
      dia_nombre: string;
    };
    colacthor_hora_inicio: string;
    colacthor_hora_fin: string;
  };
}

export const useLinkDisciplinesModal = (evaluationId: number | null, open: boolean) => {
  const [schools, setSchools] = useState<School[]>([]);
  const [linkedDisciplines, setLinkedDisciplines] = useState<LinkedDiscipline[]>([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState<number | null>(null);
  const [allowedSchoolIds, setAllowedSchoolIds] = useState<number[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const { trainerId, isAuxiliaryRole } = useTrainerEvaluationContext();

  // Check if current user is a coordinator and get their allowed schools
  const fetchAllowedSchools = async () => {
    if (!user) return;

    // Determine effective user ID for filtering
    const effectiveUserId = isAuxiliaryRole && trainerId ? trainerId : user.usu_id;

    // Check if user has coordinator role (rol_id = 2)
    const isCoordinator = user.roles?.some(role => role.rol_id === 2);
    
    if (isCoordinator && !isAuxiliaryRole) {
      try {
        const { data: coordinatorSchools, error } = await supabase
          .from('colegio_coordinador')
          .select('col_id')
          .eq('usu_id', user.usu_id);

        if (error) {
          console.error('Error fetching coordinator schools:', error);
          return;
        }

        const schoolIds = coordinatorSchools?.map(cs => cs.col_id) || [];
        setAllowedSchoolIds(schoolIds);
      } catch (error) {
        console.error('Error in fetchAllowedSchools:', error);
      }
    } else if (isAuxiliaryRole && trainerId) {
      // For auxiliary roles, get trainer's allowed schools
      try {
        const { data: trainerAssignments, error } = await supabase
          .from('entrenador_asignacion')
          .select(`
            colacthor_id,
            colegio_actividad_horario!inner(col_id)
          `)
          .eq('ent_id', trainerId)
          .eq('est_id', 1);

        if (error) {
          console.error('Error fetching trainer schools:', error);
          return;
        }

        const schoolIds = Array.from(
          new Set(trainerAssignments?.map(ta => ta.colegio_actividad_horario.col_id) || [])
        );
        setAllowedSchoolIds(schoolIds);
      } catch (error) {
        console.error('Error in fetchTrainerSchools:', error);
      }
    } else {
      // For non-coordinators and non-auxiliary, allow all schools (empty array means no restriction)
      setAllowedSchoolIds([]);
    }
  };

  const fetchLinkedDisciplines = async () => {
    if (!evaluationId) return;

    try {
      const { data, error } = await supabase
        .from('evaluacion_asignacion')
        .select(`
          evaasig_id,
          colacthor_id,
          colegio_actividad_horario!inner(
            col_id,
            colacthor_hora_inicio,
            colacthor_hora_fin,
            actividad!inner(act_nombre),
            dia!inner(dia_nombre),
            colegio!inner(col_nombre)
          )
        `)
        .eq('eva_id', evaluationId);

      if (error) {
        console.error('Error fetching linked disciplines:', error);
        return;
      }

      const formattedData = data?.map(item => ({
        evaasig_id: item.evaasig_id,
        colacthor_id: item.colacthor_id,
        colegio: {
          col_nombre: item.colegio_actividad_horario.colegio.col_nombre
        },
        colegio_actividad_horario: {
          col_id: item.colegio_actividad_horario.col_id,
          actividad: {
            act_nombre: item.colegio_actividad_horario.actividad.act_nombre
          },
          dia: {
            dia_nombre: item.colegio_actividad_horario.dia.dia_nombre
          },
          colacthor_hora_inicio: item.colegio_actividad_horario.colacthor_hora_inicio,
          colacthor_hora_fin: item.colegio_actividad_horario.colacthor_hora_fin
        }
      })) || [];

      setLinkedDisciplines(formattedData);
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  const fetchAvailableDisciplines = async () => {
    if (!evaluationId) return;

    setIsLoading(true);
    try {
      // Build query based on coordinator restrictions
      let schoolsQuery = supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .order('col_nombre');

      // If user is coordinator or auxiliary, filter by their allowed schools
      if (allowedSchoolIds.length > 0) {
        schoolsQuery = schoolsQuery.in('col_id', allowedSchoolIds);
      }

      const { data: schoolsData, error: schoolsError } = await schoolsQuery;

      if (schoolsError) {
        console.error('Error fetching schools:', schoolsError);
        toast({
          title: "Error",
          description: "No se pudieron cargar los colegios.",
          variant: "destructive",
        });
        return;
      }

      const linkedIds = linkedDisciplines.map(ld => ld.colacthor_id);
      const schoolsWithDisciplines: School[] = [];
      
      for (const school of schoolsData || []) {
        let disciplinesQuery = supabase
          .from('colegio_actividad_horario')
          .select(`
            colacthor_id,
            colacthor_hora_inicio,
            colacthor_hora_fin,
            actividad(act_nombre),
            dia(dia_nombre)
          `)
          .eq('col_id', school.col_id)
          .eq('est_id', 1)
          .not('colacthor_id', 'in', `(${linkedIds.join(',') || '0'})`);

        // If auxiliary role, filter by trainer's disciplines
        if (isAuxiliaryRole && trainerId) {
          const { data: trainerDisciplines, error: trainerError } = await supabase
            .from('entrenador_asignacion')
            .select('colacthor_id')
            .eq('ent_id', trainerId)
            .eq('est_id', 1);

          if (trainerError) {
            console.error(`Error fetching trainer disciplines:`, trainerError);
            continue;
          }

          const allowedDisciplineIds = trainerDisciplines?.map(ta => ta.colacthor_id) || [];
          if (allowedDisciplineIds.length > 0) {
            disciplinesQuery = disciplinesQuery.in('colacthor_id', allowedDisciplineIds);
          } else {
            // No trainer disciplines for this school
            continue;
          }
        }

        const { data: disciplinesData, error: disciplinesError } = await disciplinesQuery;

        if (disciplinesError) {
          console.error(`Error fetching disciplines for school ${school.col_id}:`, disciplinesError);
          continue;
        }

        schoolsWithDisciplines.push({
          ...school,
          disciplines: disciplinesData || []
        });
      }

      setSchools(schoolsWithDisciplines);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canUnlinkDiscipline = (discipline: LinkedDiscipline) => {
    // If no restrictions (not a coordinator or auxiliary), can unlink everything
    if (allowedSchoolIds.length === 0) return true;
    
    // If coordinator or auxiliary, can only unlink disciplines from their schools
    return allowedSchoolIds.includes(discipline.colegio_actividad_horario.col_id);
  };

  const handleUnlink = async (assignmentId: number) => {
    if (!evaluationId) return;

    // Check if user can unlink this discipline
    const discipline = linkedDisciplines.find(ld => ld.evaasig_id === assignmentId);
    if (discipline && !canUnlinkDiscipline(discipline)) {
      toast({
        title: "No autorizado",
        description: "No tienes permisos para desvincular disciplinas de este colegio.",
        variant: "destructive",
      });
      return;
    }

    setIsUnlinking(assignmentId);
    try {
      // First, get the colacthor_id for the assignment being deleted
      const { data: assignmentData, error: fetchError } = await supabase
        .from('evaluacion_asignacion')
        .select('colacthor_id')
        .eq('evaasig_id', assignmentId)
        .single();

      if (fetchError) {
        console.error('Error fetching assignment data:', fetchError);
        toast({
          title: "Error",
          description: "No se pudo obtener la información de la asignación.",
          variant: "destructive",
        });
        return;
      }

      const colacthorId = assignmentData.colacthor_id;

      // Delete the assignment
      const { error: deleteError } = await supabase
        .from('evaluacion_asignacion')
        .delete()
        .eq('evaasig_id', assignmentId);

      if (deleteError) {
        console.error('Error unlinking discipline:', deleteError);
        toast({
          title: "Error",
          description: "No se pudo desvincular la disciplina.",
          variant: "destructive",
        });
        return;
      }

      // Get ninoasig_ids for this colacthor_id to clean up pending students
      const { data: studentAssignments, error: studentsError } = await supabase
        .from('nino_asignacion')
        .select('ninoasig_id')
        .eq('colacthor_id', colacthorId);

      if (studentsError) {
        console.error('Error fetching student assignments:', studentsError);
        // Don't show error to user as the main operation succeeded
      } else if (studentAssignments && studentAssignments.length > 0) {
        // Clean up pending students for this evaluation and discipline
        const ninoasigIds = studentAssignments.map(sa => sa.ninoasig_id);
        const { error: cleanupError } = await supabase
          .from('evaluacion_nino_pendiente')
          .delete()
          .eq('eva_id', evaluationId)
          .in('ninoasig_id', ninoasigIds);

        if (cleanupError) {
          console.error('Error cleaning up pending students:', cleanupError);
          // Don't show error to user as the main operation succeeded
        }
      }

      toast({
        title: "Éxito",
        description: "Disciplina desvinculada exitosamente.",
      });

      await fetchLinkedDisciplines();
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsUnlinking(null);
    }
  };

  const handleSave = async () => {
    if (!evaluationId || selectedDisciplines.size === 0) {
      toast({
        title: "Advertencia",
        description: "Por favor selecciona al menos una disciplina.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const selectedColacthorIds = Array.from(selectedDisciplines);
      const allPendingRows: { eva_id: number; ninoasig_id: number; est_id: number; usu_id_registrador: null }[] = [];

      for (const colacthorId of selectedColacthorIds) {
        // Check if assignment already exists
        const { data: existingAssignment } = await supabase
          .from('evaluacion_asignacion')
          .select('evaasig_id')
          .eq('eva_id', evaluationId)
          .eq('colacthor_id', colacthorId)
          .single();

        if (!existingAssignment) {
          // Insert new assignment with est_id = 1 (active)
          const { error: assignmentError } = await supabase
            .from('evaluacion_asignacion')
            .insert({ 
              eva_id: evaluationId, 
              colacthor_id: colacthorId,
              est_id: 1
            });

          if (assignmentError) {
            console.error('Error saving discipline assignment:', assignmentError);
            throw assignmentError;
          }
        }

        // Get active students for this discipline
        const { data: activeStudents, error: studentsError } = await supabase
          .from('nino_asignacion')
          .select('ninoasig_id')
          .eq('colacthor_id', colacthorId)
          .eq('est_id', 1);

        if (studentsError) {
          console.error('Error fetching active students:', studentsError);
          throw studentsError;
        }

        if (activeStudents && activeStudents.length > 0) {
          const disciplinePendingRows = activeStudents.map(student => ({
            eva_id: evaluationId,
            ninoasig_id: student.ninoasig_id,
            est_id: 6, // pending status
            usu_id_registrador: null
          }));
          
          allPendingRows.push(...disciplinePendingRows);
        }
      }

      // Insert pending evaluations for students
      if (allPendingRows.length > 0) {
        for (const pendingRow of allPendingRows) {
          const { data: existingPending } = await supabase
            .from('evaluacion_nino_pendiente')
            .select('evaninopen_id')
            .eq('eva_id', pendingRow.eva_id)
            .eq('ninoasig_id', pendingRow.ninoasig_id)
            .single();

          if (!existingPending) {
            const { error: pendingError } = await supabase
              .from('evaluacion_nino_pendiente')
              .insert(pendingRow);

            if (pendingError) {
              console.error('Error creating pending evaluation:', pendingError);
            }
          }
        }
      }

      toast({
        title: "Éxito",
        description: `Se vincularon ${selectedDisciplines.size} disciplina(s) a la evaluación${allPendingRows.length > 0 ? ` y se crearon evaluaciones pendientes` : ''}.`,
      });

      setSelectedDisciplines(new Set());
      await fetchLinkedDisciplines();
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar las asignaciones de disciplinas.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (open && evaluationId) {
      fetchAllowedSchools();
    }
  }, [open, evaluationId, user, trainerId, isAuxiliaryRole]);

  useEffect(() => {
    if (open && evaluationId) {
      fetchLinkedDisciplines();
      setSelectedDisciplines(new Set());
      setSearchTerm('');
    }
  }, [open, evaluationId]);

  useEffect(() => {
    if (linkedDisciplines.length >= 0 && allowedSchoolIds !== null) {
      fetchAvailableDisciplines();
    }
  }, [linkedDisciplines, allowedSchoolIds, trainerId, isAuxiliaryRole]);

  return {
    schools,
    linkedDisciplines,
    selectedDisciplines,
    searchTerm,
    isLoading,
    isSaving,
    isUnlinking,
    allowedSchoolIds,
    canUnlinkDiscipline,
    setSearchTerm,
    handleDisciplineToggle: (disciplineId: number) => {
      const newSelected = new Set(selectedDisciplines);
      if (newSelected.has(disciplineId)) {
        newSelected.delete(disciplineId);
      } else {
        newSelected.add(disciplineId);
      }
      setSelectedDisciplines(newSelected);
    },
    handleUnlink,
    handleSave
  };
};
