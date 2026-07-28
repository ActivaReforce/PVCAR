import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DisciplinaCalendar from "./DisciplinaCalendar";
import DisciplinasHeader from "./DisciplinasHeader";
import DisciplinasFilters from "./DisciplinasFilters";
import DisciplinaMultiForm from "./DisciplinaMultiForm";
import EditDisciplinaForm from "./EditDisciplinaForm";
import { DeleteDisciplinaDialog } from "./DeleteDisciplinaDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import ColegioFilter from "./ColegioFilter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
interface DisciplinaWithDetails {
  colacthor_id: number;
  colegio: {
    col_nombre: string;
  } | null;
  actividad: {
    act_nombre: string;
  } | null;
  dia: {
    dia_nombre: string;
  } | null;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  colacthor_fecha_creacion: string;
  col_id: number | null;
  act_id: number | null;
  dia_id: number | null;
  est_id: number | null;
  trainer?: {
    usu_nombre: string;
    usu_id: number;
  } | null;
}
interface DisciplinaCounts {
  total: number;
  assigned: number;
}
interface Child {
  nino_id: number;
  nino_nombre: string;
  col_id: number;
  colegio?: {
    col_nombre: string;
  };
}
const DisciplinasManager = () => {
  const [disciplinas, setDisciplinas] = useState<DisciplinaWithDetails[]>([]);
  const [disciplinaCounts, setDisciplinaCounts] = useState<DisciplinaCounts>({
    total: 0,
    assigned: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedColegios, setSelectedColegios] = useState<string[]>(["all"]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingDisciplina, setEditingDisciplina] = useState<DisciplinaWithDetails | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [disciplinaToDelete, setDisciplinaToDelete] = useState<DisciplinaWithDetails | null>(null);
  const [trainerContext, setTrainerContext] = useState<{
    ent_id: number;
    trainer_name: string;
  } | null>(null);

  // Role 4 specific state
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const {
    toast
  } = useToast();
  const {
    user
  } = useAuth();
  const isCoordinator = () => {
    return user?.roles?.some(role => role.rol_id === 2);
  };
  const isTrainer = () => {
    return user?.roles?.some(role => role.rol_id === 3);
  };
  const isAssistantOrBackup = () => {
    return user?.roles?.some(role => role.rol_id === 6 || role.rol_id === 7);
  };
  const isRepresentante = () => {
    return user?.roles?.some(role => role.rol_id === 4);
  };
  const resolveTrainerContext = async (): Promise<{
    ent_id: number;
    trainer_name: string;
  } | null> => {
    if (!isAssistantOrBackup() || !user?.usu_id) {
      return null;
    }
    try {
      // First, get the trainer's ent_id from entrenador_auxiliar
      const {
        data: auxiliarData,
        error: auxiliarError
      } = await supabase.from('entrenador_auxiliar').select('ent_id').eq('usu_id', user.usu_id).eq('est_id', 1).maybeSingle();
      if (auxiliarError || !auxiliarData?.ent_id) {
        console.error("Error fetching trainer context from entrenador_auxiliar:", auxiliarError);
        return null;
      }

      // Then, get the trainer's name from usuario table
      const {
        data: trainerData,
        error: trainerError
      } = await supabase.from('usuario').select('usu_nombre').eq('usu_id', auxiliarData.ent_id).maybeSingle();
      if (trainerError || !trainerData?.usu_nombre) {
        console.error("Error fetching trainer name:", trainerError);
        return null;
      }
      return {
        ent_id: auxiliarData.ent_id,
        trainer_name: trainerData.usu_nombre
      };
    } catch (error) {
      console.error("Error in resolveTrainerContext:", error);
      return null;
    }
  };
  const getCoordinatorSchools = async (): Promise<number[]> => {
    if (!isCoordinator() || !user?.usu_id) {
      return [];
    }
    const {
      data,
      error
    } = await supabase.from('colegio_coordinador').select('col_id').eq('usu_id', user.usu_id);
    if (error) {
      console.error("Error fetching coordinator schools:", error);
      return [];
    }
    return (data || []).map(item => item.col_id).filter(Boolean);
  };
  const getTrainerAssignedColacthorIds = async (trainerId?: number): Promise<number[]> => {
    const effectiveTrainerId = trainerId || user?.usu_id;
    if (!isTrainer() && !trainerId || !effectiveTrainerId) {
      return [];
    }

    // Get trainer's entrenador record
    const {
      data: trainerData,
      error: trainerError
    } = await supabase.from('entrenador').select('ent_id').eq('ent_id', effectiveTrainerId).eq('est_id', 1).maybeSingle();
    if (trainerError || !trainerData) {
      console.error("Error fetching trainer data:", trainerError);
      return [];
    }

    // Get active assignments for this trainer
    const {
      data: assignmentsData,
      error: assignmentsError
    } = await supabase.from('entrenador_asignacion').select('colacthor_id').eq('ent_id', trainerData.ent_id).eq('est_id', 1).is('entasig_fecha_fin', null);
    if (assignmentsError) {
      console.error("Error fetching trainer assignments:", assignmentsError);
      return [];
    }
    return (assignmentsData || []).map(item => item.colacthor_id).filter(Boolean);
  };
  const loadRepresentanteChildren = async () => {
    if (!isRepresentante() || !user?.usu_id) {
      return [];
    }
    try {
      // Get padre_id from user
      const {
        data: padreData,
        error: padreError
      } = await supabase.from('padre').select('padre_id').eq('usu_id', user.usu_id).maybeSingle();
      if (padreError || !padreData) {
        console.error("Error fetching padre data:", padreError);
        return [];
      }

      // Get children through nino_padre
      const {
        data: childrenData,
        error: childrenError
      } = await supabase.from('nino_padre').select(`
          nino!inner(
            nino_id,
            nino_nombre,
            col_id,
            colegio!inner(col_nombre)
          )
        `).eq('padre_id', padreData.padre_id).eq('nino.est_id', 1); // Only active children

      if (childrenError) {
        console.error("Error fetching children data:", childrenError);
        return [];
      }
      const childrenList = (childrenData || []).map(item => ({
        nino_id: item.nino.nino_id,
        nino_nombre: item.nino.nino_nombre,
        col_id: item.nino.col_id,
        colegio: item.nino.colegio
      }));
      setChildren(childrenList);

      // Auto-select first child if available
      if (childrenList.length > 0 && !selectedChildId) {
        setSelectedChildId(childrenList[0].nino_id);
      }
      return childrenList;
    } catch (error) {
      console.error("Error loading representante children:", error);
      return [];
    }
  };
  const getChildAssignedColacthorIds = async (childId: number): Promise<number[]> => {
    try {
      const {
        data: assignmentsData,
        error: assignmentsError
      } = await supabase.from('nino_asignacion').select('colacthor_id').eq('nino_id', childId).eq('est_id', 1); // Only active assignments

      if (assignmentsError) {
        console.error("Error fetching child assignments:", assignmentsError);
        return [];
      }
      return (assignmentsData || []).map(item => item.colacthor_id).filter(Boolean);
    } catch (error) {
      console.error("Error in getChildAssignedColacthorIds:", error);
      return [];
    }
  };
  const loadData = async () => {
    try {
      setLoading(true);
      let schoolIds: number[] = [];
      let trainerColacthorIds: number[] = [];
      let childColacthorIds: number[] = [];
      let resolvedTrainerContext: {
        ent_id: number;
        trainer_name: string;
      } | null = null;

      // Handle role-specific data loading
      if (isRepresentante()) {
        const childrenList = await loadRepresentanteChildren();
        if (childrenList.length === 0 || !selectedChildId) {
          setDisciplinas([]);
          setDisciplinaCounts({
            total: 0,
            assigned: 0
          });
          setLoading(false);
          return;
        }
        childColacthorIds = await getChildAssignedColacthorIds(selectedChildId);
      } else {
        // Resolve trainer context for roles 6 and 7
        if (isAssistantOrBackup()) {
          resolvedTrainerContext = await resolveTrainerContext();
          setTrainerContext(resolvedTrainerContext);
          if (resolvedTrainerContext) {
            trainerColacthorIds = await getTrainerAssignedColacthorIds(resolvedTrainerContext.ent_id);
          }
        } else if (isCoordinator()) {
          schoolIds = await getCoordinatorSchools();
        } else if (isTrainer()) {
          trainerColacthorIds = await getTrainerAssignedColacthorIds();
        }
      }

      // Build disciplinas query
      let disciplinasQuery = supabase.from('colegio_actividad_horario').select(`
          colacthor_id,
          col_id,
          act_id,
          dia_id,
          est_id,
          colacthor_hora_inicio,
          colacthor_hora_fin,
          colacthor_fecha_creacion,
          colegio:col_id(col_nombre),
          actividad:act_id(act_nombre),
          dia:dia_id(dia_nombre)
        `);

      // Apply role-specific filters
      if (isRepresentante() && childColacthorIds.length > 0) {
        disciplinasQuery = disciplinasQuery.in('colacthor_id', childColacthorIds);
      } else if (isRepresentante() && childColacthorIds.length === 0) {
        // Representative with no child assignments - return empty
        setDisciplinas([]);
        setDisciplinaCounts({
          total: 0,
          assigned: 0
        });
        setLoading(false);
        return;
      } else if (isCoordinator() && schoolIds.length > 0) {
        disciplinasQuery = disciplinasQuery.in('col_id', schoolIds);
      } else if ((isTrainer() || isAssistantOrBackup()) && trainerColacthorIds.length > 0) {
        disciplinasQuery = disciplinasQuery.in('colacthor_id', trainerColacthorIds);
      } else if ((isTrainer() || isAssistantOrBackup()) && trainerColacthorIds.length === 0) {
        // Trainer or assistant/backup with no assignments - return empty
        setDisciplinas([]);
        setDisciplinaCounts({
          total: 0,
          assigned: 0
        });
        setLoading(false);
        return;
      }
      const {
        data: disciplinasData,
        error: disciplinasError
      } = await disciplinasQuery.order('colacthor_fecha_creacion', {
        ascending: false
      });
      if (disciplinasError) throw disciplinasError;

      // Build assignments query - include for all roles now
      const trainerMap = new Map();
      let assignmentsQuery = supabase.from('entrenador_asignacion').select(`
          colacthor_id,
          entrenador:ent_id(
            usuario!entrenador_ent_id_fkey(
              usu_id,
              usu_nombre
            )
          )
        `).eq('est_id', 1) // Only active assignments
      .is('entasig_fecha_fin', null); // Only current assignments

      // Filter assignments based on role
      if (isRepresentante() && childColacthorIds.length > 0) {
        assignmentsQuery = assignmentsQuery.in('colacthor_id', childColacthorIds);
      } else if (isCoordinator() && schoolIds.length > 0) {
        const coordinatorColacthorIds = (disciplinasData || []).filter(d => schoolIds.includes(d.col_id!)).map(d => d.colacthor_id);
        if (coordinatorColacthorIds.length > 0) {
          assignmentsQuery = assignmentsQuery.in('colacthor_id', coordinatorColacthorIds);
        } else {
          assignmentsQuery = assignmentsQuery.eq('colacthor_id', -1); // Force empty result
        }
      } else if ((isTrainer() || isAssistantOrBackup()) && trainerColacthorIds.length > 0) {
        assignmentsQuery = assignmentsQuery.in('colacthor_id', trainerColacthorIds);
      }
      const {
        data: assignmentsData,
        error: assignmentsError
      } = await assignmentsQuery;
      if (assignmentsError) throw assignmentsError;

      // Create a map of colacthor_id to trainer for quick lookup
      (assignmentsData || []).forEach(assignment => {
        if (assignment.colacthor_id && assignment.entrenador?.usuario && !trainerMap.has(assignment.colacthor_id)) {
          trainerMap.set(assignment.colacthor_id, assignment.entrenador.usuario);
        }
      });

      // Transform disciplinas with trainer info
      const transformedData = (disciplinasData || []).map(disciplina => ({
        ...disciplina,
        trainer: trainerMap.get(disciplina.colacthor_id) || null
      }));
      setDisciplinas(transformedData);

      // Calculate counts based on role
      const totalCount = transformedData.length;
      if (isTrainer() || isAssistantOrBackup() || isRepresentante()) {
        // For trainers, assistants/backups, and representantes, all shown disciplinas are assigned to them
        setDisciplinaCounts({
          total: totalCount,
          assigned: totalCount
        });
      } else {
        // For other roles, calculate as before
        const assignedColacthorIds = new Set(Array.from(trainerMap.keys()));
        const assignedCount = transformedData.filter(d => assignedColacthorIds.has(d.colacthor_id)).length;
        setDisciplinaCounts({
          total: totalCount,
          assigned: assignedCount
        });
      }
    } catch (error) {
      console.error("Error loading disciplinas:", error);
      toast({
        title: "Error",
        description: "Error al cargar las disciplinas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadData();
  }, [selectedChildId]);
  const handleCreateDisciplina = () => {
    setShowCreateForm(true);
  };
  const handleEditDisciplina = (disciplina: DisciplinaWithDetails) => {
    setEditingDisciplina(disciplina);
    setShowEditForm(true);
  };
  const handleDeleteDisciplina = async (disciplina: DisciplinaWithDetails) => {
    setDisciplinaToDelete(disciplina);
    setShowDeleteDialog(true);
  };
  const handleDeleteConfirm = async () => {
    if (!disciplinaToDelete) return;
    try {
      const {
        error
      } = await supabase.from('colegio_actividad_horario').delete().eq('colacthor_id', disciplinaToDelete.colacthor_id);
      if (error) throw error;
      toast({
        title: "Éxito",
        description: "Disciplina eliminada correctamente"
      });
      loadData();
    } catch (error) {
      console.error("Error deleting disciplina:", error);
      toast({
        title: "Error",
        description: "Error al eliminar la disciplina, revise que no tenga nada atado (Entrenador, Alumnos, Evaluaciones)",
        variant: "destructive"
      });
    } finally {
      setShowDeleteDialog(false);
      setDisciplinaToDelete(null);
    }
  };
  const handleDeleteDialogClose = () => {
    setShowDeleteDialog(false);
    setDisciplinaToDelete(null);
  };
  const handleCreateFormSuccess = () => {
    setShowCreateForm(false);
    loadData();
  };
  const handleEditFormSuccess = () => {
    setShowEditForm(false);
    setEditingDisciplina(null);
    loadData();
  };
  const handleCreateFormCancel = () => {
    setShowCreateForm(false);
  };
  const handleEditFormCancel = () => {
    setShowEditForm(false);
    setEditingDisciplina(null);
  };
  const filteredDisciplinas = disciplinas.filter(disciplina => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = disciplina.colegio?.col_nombre.toLowerCase().includes(searchLower) || disciplina.actividad?.act_nombre.toLowerCase().includes(searchLower) || disciplina.dia?.dia_nombre.toLowerCase().includes(searchLower);
    const matchesColegios = selectedColegios.includes("all") || selectedColegios.some(selectedColegio => disciplina.colegio?.col_nombre === selectedColegio);
    return matchesSearch && matchesColegios;
  });
  if (loading) {
    return <div className="flex items-center justify-center h-64">
        <div className="text-lg">Cargando disciplinas...</div>
      </div>;
  }
  const selectedChild = children.find(child => child.nino_id === selectedChildId);
  return <div className="container mx-auto p-4 lg:p-6 space-y-6">
      {/* Small informational title for roles 6 and 7 */}
      {isAssistantOrBackup() && trainerContext && <div className="text-sm text-muted-foreground bg-muted/30 p-2 rounded border">
          Disciplinas del entrenador {trainerContext.trainer_name}
        </div>}

      {/* Role 4 specific header with child selection */}
      {isRepresentante() ? <div className="space-y-4">
          {children.length > 1 ? <Tabs value={selectedChildId?.toString()} onValueChange={value => setSelectedChildId(parseInt(value))}>
              <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
                {children.map(child => <TabsTrigger key={child.nino_id} value={child.nino_id.toString()}>
                    {child.nino_nombre.split(' ')[0]}
                  </TabsTrigger>)}
              </TabsList>
              {children.map(child => <TabsContent key={child.nino_id} value={child.nino_id.toString()}>
                  <div className="text-lg font-semibold mt-10 ">
                    {child.nino_nombre}
                  </div>
                </TabsContent>)}
            </Tabs> : selectedChild ? <div className="text-lg font-semibold">
              {selectedChild.nino_nombre}
            </div> : null}
        </div> : <DisciplinasHeader onCreateDisciplina={handleCreateDisciplina} disciplinaCounts={disciplinaCounts} isTrainer={isTrainer() || isAssistantOrBackup()} />}

      {/* Conditional filters and search - hide for role 4 */}
      {!isRepresentante() && <>
          {/* Mobile: Search bar directly beneath header */}
          <div className="sm:hidden w-full">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por colegio, actividad o día..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-full" />
            </div>
          </div>

          {/* Mobile: College select directly beneath search bar */}
          <div className="sm:hidden w-full">
            <ColegioFilter disciplinas={disciplinas} selectedColegios={selectedColegios} onColegiosChange={setSelectedColegios} />
          </div>

          {/* Desktop: Original layout with flex row */}
          <div className="hidden sm:flex flex-row items-start sm:items-center gap-4">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por colegio, actividad o día..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-full" />
            </div>
            <div className="w-full sm:w-auto">
              <ColegioFilter disciplinas={disciplinas} selectedColegios={selectedColegios} onColegiosChange={setSelectedColegios} />
            </div>
          </div>
        </>}

      <DisciplinaCalendar disciplinas={isRepresentante() ? disciplinas : filteredDisciplinas} onEdit={handleEditDisciplina} onDelete={handleDeleteDisciplina} />

      {/* Create Disciplina Form Modal */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              Crear Nuevas Disciplinas
            </DialogTitle>
          </DialogHeader>

          <DisciplinaMultiForm onSuccess={handleCreateFormSuccess} onCancel={handleCreateFormCancel} />
        </DialogContent>
      </Dialog>

      {/* Edit Disciplina Form Modal */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              Editar Disciplina
            </DialogTitle>
          </DialogHeader>

          {editingDisciplina && <EditDisciplinaForm disciplina={editingDisciplina} onSuccess={handleEditFormSuccess} onCancel={handleEditFormCancel} />}
        </DialogContent>
      </Dialog>

      {/* Delete Disciplina Confirmation Dialog */}
      <DeleteDisciplinaDialog isOpen={showDeleteDialog} onClose={handleDeleteDialogClose} onConfirm={handleDeleteConfirm} disciplinaName={disciplinaToDelete ? `${disciplinaToDelete.actividad?.act_nombre} - ${disciplinaToDelete.colegio?.col_nombre}` : undefined} />
    </div>;
};
export default DisciplinasManager;