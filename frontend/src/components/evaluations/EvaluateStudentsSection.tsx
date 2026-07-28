import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StudentEvaluationTable from './StudentEvaluationTable';
import EvaluateStudentModal from './EvaluateStudentModal';
import { useDeleteEvaluation } from '@/hooks/useDeleteEvaluation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useTrainerEvaluationContext } from '@/hooks/useTrainerEvaluationContext';

interface School {
  col_id: number;
  col_nombre: string;
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

interface EvaluationCard {
  eva_id: number;
  eva_titulo: string;
  eva_categoria: string | null;
}

interface StudentEvaluation {
  nino_nombre: string;
  evaninopen_id: number;
  est_id: number;
}

const EvaluateStudentsSection = () => {
  const { user } = useAuth();
  const { trainerId, isAuxiliaryRole } = useTrainerEvaluationContext();
  
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<number | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<number | null>(null);
  const [evaluationCards, setEvaluationCards] = useState<EvaluationCard[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<number | null>(null);
  const [studentEvaluations, setStudentEvaluations] = useState<StudentEvaluation[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentEvaluation | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingDisciplines, setLoadingDisciplines] = useState(false);
  const [loadingEvaluations, setLoadingEvaluations] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showEvaluateModal, setShowEvaluateModal] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [evaluationTitle, setEvaluationTitle] = useState('');
  const [disciplineName, setDisciplineName] = useState('');
  const [studentToDelete, setStudentToDelete] = useState<StudentEvaluation | null>(null);
  const { toast } = useToast();
  const { deleteEvaluation, isDeleting } = useDeleteEvaluation();

  // Check if current user is a trainer
  const isTrainer = user?.roles?.some(role => role.rol_id === 3);

  useEffect(() => {
    loadSchools();
  }, [trainerId, isAuxiliaryRole]);

  const loadSchools = async () => {
    try {
      setLoadingSchools(true);
      
      // Determine effective user ID for filtering
      const effectiveUserId = isAuxiliaryRole && trainerId ? trainerId : user?.usu_id;
      
      // Check if current user is a coordinator (rol_id = 2)
      const isCoordinator = user?.roles?.some(role => role.rol_id === 2);
      
      let schoolsQuery = supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .order('col_nombre');

      // If user is coordinator, filter by their allowed schools
      if (isCoordinator && user && !isAuxiliaryRole) {
        const { data: coordinatorSchools, error: coordError } = await supabase
          .from('colegio_coordinador')
          .select('col_id')
          .eq('usu_id', user.usu_id);

        if (coordError) {
          console.error('Error fetching coordinator schools:', coordError);
          toast({
            title: "Error",
            description: "No se pudieron cargar los colegios del coordinador.",
            variant: "destructive",
          });
          return;
        }

        const allowedSchoolIds = coordinatorSchools?.map(cs => cs.col_id) || [];
        if (allowedSchoolIds.length > 0) {
          schoolsQuery = schoolsQuery.in('col_id', allowedSchoolIds);
        }
      }

      // If user is trainer or auxiliary role, filter by their assigned schools
      if ((isTrainer || isAuxiliaryRole) && effectiveUserId) {
        const { data: trainerAssignments, error: trainerError } = await supabase
          .from('entrenador_asignacion')
          .select(`
            colacthor_id,
            colegio_actividad_horario!inner(col_id)
          `)
          .eq('ent_id', effectiveUserId)
          .eq('est_id', 1);

        if (trainerError) {
          console.error('Error fetching trainer assignments:', trainerError);
          toast({
            title: "Error",
            description: "No se pudieron cargar las asignaciones del entrenador.",
            variant: "destructive",
          });
          return;
        }

        const allowedSchoolIds = Array.from(
          new Set(trainerAssignments?.map(ta => ta.colegio_actividad_horario.col_id) || [])
        );
        
        if (allowedSchoolIds.length > 0) {
          schoolsQuery = schoolsQuery.in('col_id', allowedSchoolIds);
        } else {
          // No assignments, show no schools
          setSchools([]);
          setLoadingSchools(false);
          return;
        }
      }

      const { data, error } = await schoolsQuery;

      if (error) {
        console.error('Error loading schools:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los colegios.",
          variant: "destructive",
        });
        return;
      }

      const schoolsData = data || [];
      setSchools(schoolsData);
      
      // Auto-select school if trainer/auxiliary has only one
      if ((isTrainer || isAuxiliaryRole) && schoolsData.length === 1) {
        const singleSchool = schoolsData[0];
        setSelectedSchool(singleSchool.col_id);
        loadDisciplines(singleSchool.col_id);
      }

    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setLoadingSchools(false);
    }
  };

  const loadDisciplines = async (schoolId: number) => {
    try {
      setLoadingDisciplines(true);
      
      // Determine effective user ID for filtering
      const effectiveUserId = isAuxiliaryRole && trainerId ? trainerId : user?.usu_id;
      
      let disciplinesQuery = supabase
        .from('colegio_actividad_horario')
        .select(`
          colacthor_id,
          colacthor_hora_inicio,
          colacthor_hora_fin,
          actividad:act_id (
            act_nombre
          ),
          dia:dia_id (
            dia_nombre
          )
        `)
        .eq('col_id', schoolId)
        .eq('est_id', 1)
        .order('colacthor_id');

      // If user is trainer or auxiliary role, filter by their assigned disciplines
      if ((isTrainer || isAuxiliaryRole) && effectiveUserId) {
        const { data: trainerAssignments, error: trainerError } = await supabase
          .from('entrenador_asignacion')
          .select('colacthor_id')
          .eq('ent_id', effectiveUserId)
          .eq('est_id', 1);

        if (trainerError) {
          console.error('Error fetching trainer discipline assignments:', trainerError);
          toast({
            title: "Error",
            description: "No se pudieron cargar las disciplinas asignadas.",
            variant: "destructive",
          });
          return;
        }

        const allowedDisciplineIds = trainerAssignments?.map(ta => ta.colacthor_id) || [];
        if (allowedDisciplineIds.length > 0) {
          disciplinesQuery = disciplinesQuery.in('colacthor_id', allowedDisciplineIds);
        } else {
          // No assignments for this school, show no disciplines
          setDisciplines([]);
          setLoadingDisciplines(false);
          return;
        }
      }

      const { data, error } = await disciplinesQuery;

      if (error) {
        console.error('Error loading disciplines:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las disciplinas.",
          variant: "destructive",
        });
        return;
      }

      setDisciplines(data || []);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setLoadingDisciplines(false);
    }
  };

  const loadEvaluations = async (disciplineId: number) => {
    try {
      setLoadingEvaluations(true);
      
      const { data, error } = await supabase
        .from('evaluacion_asignacion')
        .select(`
          evaluacion:eva_id (
            eva_id,
            eva_titulo,
            eva_categoria
          )
        `)
        .eq('colacthor_id', disciplineId)
        .eq('est_id', 1);

      if (error) {
        console.error('Error loading evaluations:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las evaluaciones.",
          variant: "destructive",
        });
        return;
      }

      const evaluations = data?.map(item => item.evaluacion).filter(Boolean) || [];
      setEvaluationCards(evaluations);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setLoadingEvaluations(false);
    }
  };

  const loadStudents = async (evaluationId: number) => {
    try {
      setLoadingStudents(true);
      
      // Use the new query that properly filters by college, discipline, and evaluation
      const { data, error } = await supabase
        .from('evaluacion_nino_pendiente')
        .select(`
          evaninopen_id,
          eva_id,
          est_id,
          ninoasig_id,
          nino_asignacion!inner (
            ninoasig_id,
            nino_id,
            colacthor_id,
            colegio_actividad_horario!inner (
              colacthor_id,
              col_id
            ),
            nino!inner (
              nino_nombre
            )
          )
        `)
        .eq('eva_id', evaluationId)
        .eq('nino_asignacion.colacthor_id', selectedDiscipline)
        .eq('nino_asignacion.colegio_actividad_horario.col_id', selectedSchool);

      if (error) {
        console.error('Error loading students:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los alumnos.",
          variant: "destructive",
        });
        return;
      }

      const students = data?.map(item => ({
        nino_nombre: item.nino_asignacion?.nino?.nino_nombre || 'Nombre no disponible',
        evaninopen_id: item.evaninopen_id,
        est_id: item.est_id
      })) || [];

      setStudentEvaluations(students);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSchoolChange = (schoolId: string) => {
    const id = parseInt(schoolId);
    setSelectedSchool(id);
    setSelectedDiscipline(null);
    setSelectedEvaluation(null);
    setStudentEvaluations([]);
    setEvaluationCards([]);
    setDisciplines([]);
    loadDisciplines(id);
  };

  const handleDisciplineChange = (disciplineId: string) => {
    const id = parseInt(disciplineId);
    setSelectedDiscipline(id);
    setSelectedEvaluation(null);
    setStudentEvaluations([]);
    
    // Get discipline name for the modal
    const discipline = disciplines.find(d => d.colacthor_id === id);
    setDisciplineName(discipline?.actividad?.act_nombre || '');
    
    loadEvaluations(id);
  };

  const handleEvaluationChange = (evaluationId: string) => {
    const id = parseInt(evaluationId);
    setSelectedEvaluation(id);
    
    // Get evaluation title for the modal
    const evaluation = evaluationCards.find(e => e.eva_id === id);
    setEvaluationTitle(evaluation?.eva_titulo || '');
    
    loadStudents(id);
  };

  const handleEvaluateStudent = (student: StudentEvaluation) => {
    setSelectedStudent(student);
    setIsModifying(false);
    setShowEvaluateModal(true);
  };

  const handleModifyEvaluation = (student: StudentEvaluation) => {
    setSelectedStudent(student);
    setIsModifying(true);
    setShowEvaluateModal(true);
  };

  const handleDeleteEvaluation = (student: StudentEvaluation) => {
    setStudentToDelete(student);
  };

  const confirmDeleteEvaluation = async () => {
    if (!studentToDelete) return;

    const success = await deleteEvaluation(studentToDelete);
    if (success && selectedEvaluation) {
      // Refresh the student list
      loadStudents(selectedEvaluation);
    }
    setStudentToDelete(null);
  };

  const handleEvaluationComplete = () => {
    setShowEvaluateModal(false);
    setSelectedStudent(null);
    setIsModifying(false);
    
    // Refresh the student list
    if (selectedEvaluation) {
      loadStudents(selectedEvaluation);
    }
  };

  const formatDisciplineLabel = (discipline: Discipline) => {
    const activityName = discipline.actividad?.act_nombre || 'Sin nombre';
    const dayName = discipline.dia?.dia_nombre || '';
    const startTime = discipline.colacthor_hora_inicio || '';
    const endTime = discipline.colacthor_hora_fin || '';
    
    if (dayName && startTime && endTime) {
      return `${activityName} — ${dayName} ${startTime}-${endTime}`;
    }
    
    return activityName;
  };

  const formatEvaluationLabel = (evaluation: EvaluationCard) => {
    if (evaluation.eva_categoria) {
      return `${evaluation.eva_titulo} (${evaluation.eva_categoria})`;
    }
    return evaluation.eva_titulo;
  };

  return (
    <div className="space-y-4">
      {/* Horizontal filter row with three selects */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* School Select */}
        <div className="w-full sm:w-64">
          <Select onValueChange={handleSchoolChange} value={selectedSchool?.toString() || ""}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un colegio..." />
            </SelectTrigger>
            <SelectContent>
              {loadingSchools ? (
                <SelectItem value="loading" disabled>
                  Cargando colegios...
                </SelectItem>
              ) : (
                schools.map((school) => (
                  <SelectItem 
                    key={school.col_id} 
                    value={school.col_id.toString()}
                  >
                    {school.col_nombre}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Discipline Select */}
        {selectedSchool && (
          <div className="w-full sm:w-64">
            <Select onValueChange={handleDisciplineChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una disciplina..." />
              </SelectTrigger>
              <SelectContent>
                {loadingDisciplines ? (
                  <SelectItem value="loading" disabled>
                    Cargando disciplinas...
                  </SelectItem>
                ) : (
                  disciplines.map((discipline) => (
                    <SelectItem 
                      key={discipline.colacthor_id} 
                      value={discipline.colacthor_id.toString()}
                    >
                      {formatDisciplineLabel(discipline)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Evaluation Select */}
        {selectedDiscipline && (
          <div className="w-full sm:w-64">
            <Select onValueChange={handleEvaluationChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una evaluación..." />
              </SelectTrigger>
              <SelectContent>
                {loadingEvaluations ? (
                  <SelectItem value="loading" disabled>
                    Cargando evaluaciones...
                  </SelectItem>
                ) : evaluationCards.length === 0 ? (
                  <SelectItem value="no-evaluations" disabled>
                    No hay evaluaciones disponibles
                  </SelectItem>
                ) : (
                  evaluationCards.map((card) => (
                    <SelectItem 
                      key={card.eva_id} 
                      value={card.eva_id.toString()}
                    >
                      {formatEvaluationLabel(card)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Students Table */}
      {selectedEvaluation && (
        <StudentEvaluationTable
          studentEvaluations={studentEvaluations}
          loading={loadingStudents}
          onEvaluateStudent={handleEvaluateStudent}
          onModifyEvaluation={handleModifyEvaluation}
          onDeleteEvaluation={handleDeleteEvaluation}
        />
      )}

      {showEvaluateModal && selectedStudent && selectedEvaluation && (
        <EvaluateStudentModal
          open={showEvaluateModal}
          onOpenChange={setShowEvaluateModal}
          student={selectedStudent}
          evaluationId={selectedEvaluation}
          evaluationTitle={evaluationTitle}
          disciplineName={disciplineName}
          onEvaluationComplete={handleEvaluationComplete}
          isModifying={isModifying}
        />
      )}

      <AlertDialog open={!!studentToDelete} onOpenChange={() => setStudentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evaluación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la evaluación de {studentToDelete?.nino_nombre}. 
              El alumnos volverá al estado "Pendiente" y se borrarán todos los intentos registrados.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteEvaluation}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar evaluación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EvaluateStudentsSection;
