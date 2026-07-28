import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

type Usuario = Database['public']['Tables']['usuario']['Row'];
type Entrenador = Database['public']['Tables']['entrenador']['Row'];
type ColegioActividadHorario = Database['public']['Tables']['colegio_actividad_horario']['Row'];
type Actividad = Database['public']['Tables']['actividad']['Row'];
type Colegio = Database['public']['Tables']['colegio']['Row'];
type Dia = Database['public']['Tables']['dia']['Row'];

interface EntrenadorWithDetails extends Entrenador {
  usuario: Usuario;
  colegios: string[];
  disciplinas_count: number;
}

interface DisciplinaWithDetails extends ColegioActividadHorario {
  actividad: Actividad;
  colegio: Colegio;
  dia: Dia;
}

interface AssignedDisciplina {
  entasig_id: number;
  colacthor_id: number;
  colegio_nombre: string;
  actividad_nombre: string;
  dia_nombre: string;
  hora_inicio: string | null;
  hora_fin: string | null;
}

interface AtarEntrenadorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entrenador: EntrenadorWithDetails | null;
  onClose: () => void;
  onSuccess: () => void;
}

const AtarEntrenadorModal = ({ 
  open, 
  onOpenChange, 
  entrenador, 
  onClose, 
  onSuccess 
}: AtarEntrenadorModalProps) => {
  const [loading, setLoading] = useState(false);
  const [disciplinas, setDisciplinas] = useState<DisciplinaWithDetails[]>([]);
  const [assignedDisciplinas, setAssignedDisciplinas] = useState<AssignedDisciplina[]>([]);
  const [selectedDisciplinaIds, setSelectedDisciplinaIds] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [disciplinaToDelete, setDisciplinaToDelete] = useState<AssignedDisciplina | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Check if user is coordinator
  const isCoordinator = () => {
    return user?.roles?.some(role => role.rol_id === 2);
  };

  // Get coordinator's allowed school IDs
  const getCoordinatorSchoolIds = async (): Promise<number[]> => {
    if (!isCoordinator() || !user?.usu_id) {
      return [];
    }

    const { data, error } = await supabase
      .from('colegio_coordinador')
      .select('col_id')
      .eq('usu_id', user.usu_id);

    if (error) {
      console.error("Error fetching coordinator schools:", error);
      return [];
    }

    return (data || []).map(item => item.col_id).filter(Boolean);
  };

  // Day order mapping for sorting
  const dayOrder: { [key: string]: number } = {
    'lunes': 1,
    'martes': 2,
    'miércoles': 3,
    'jueves': 4,
    'viernes': 5,
    'sábado': 6,
    'domingo': 7
  };

  useEffect(() => {
    if (open && entrenador) {
      loadDisciplinas();
      loadAssignedDisciplinas();
    }
  }, [open, entrenador]);

  const loadDisciplinas = async () => {
    try {
      setLoading(true);
      
      // Get coordinator's allowed schools if applicable
      const allowedSchoolIds = await getCoordinatorSchoolIds();
      
      // Build base query for all colegio_actividad_horario entries
      let disciplinasQuery = supabase
        .from('colegio_actividad_horario')
        .select(`
          *,
          actividad:act_id (
            act_id,
            act_nombre,
            act_descripcion
          ),
          colegio:col_id (
            col_id,
            col_nombre
          ),
          dia:dia_id (
            dia_id,
            dia_nombre
          )
        `)
        .order('colacthor_id', { ascending: true });

      // Filter by coordinator's schools if applicable
      if (allowedSchoolIds.length > 0) {
        disciplinasQuery = disciplinasQuery.in('col_id', allowedSchoolIds);
      }

      const { data: allDisciplinas, error: disciplinasError } = await disciplinasQuery;

      if (disciplinasError) throw disciplinasError;

      // Get all active assignments (est_id != 2) to filter out assigned disciplinas
      const { data: activeAssignments, error: assignmentsError } = await supabase
        .from('entrenador_asignacion')
        .select('colacthor_id')
        .neq('est_id', 2) // Exclude inactive assignments
        .is('entasig_fecha_fin', null); // Only current assignments

      if (assignmentsError) throw assignmentsError;

      // Create a set of assigned colacthor_ids for efficient filtering
      const assignedColacthorIds = new Set(
        activeAssignments?.map(assignment => assignment.colacthor_id) || []
      );

      // Filter out assigned disciplinas and ensure all related data exists
      const availableDisciplinas = (allDisciplinas || []).filter(
        item => item.actividad && 
               item.colegio && 
               item.dia && 
               !assignedColacthorIds.has(item.colacthor_id)
      ) as DisciplinaWithDetails[];

      // Sort by day of week (Monday to Sunday), then by start time, then by activity name
      const sortedDisciplinas = availableDisciplinas.sort((a, b) => {
        const dayA = dayOrder[a.dia.dia_nombre.toLowerCase()] || 999;
        const dayB = dayOrder[b.dia.dia_nombre.toLowerCase()] || 999;
        
        if (dayA !== dayB) {
          return dayA - dayB;
        }
        
        // Then by start time
        const timeA = a.colacthor_hora_inicio || '';
        const timeB = b.colacthor_hora_inicio || '';
        if (timeA !== timeB) {
          return timeA.localeCompare(timeB);
        }
        
        // Finally by activity name
        return a.actividad.act_nombre.localeCompare(b.actividad.act_nombre);
      });

      setDisciplinas(sortedDisciplinas);
    } catch (error) {
      console.error("Error loading disciplinas:", error);
      toast({
        title: "Error",
        description: "Error al cargar las disciplinas disponibles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAssignedDisciplinas = async () => {
    if (!entrenador) return;

    try {
      const { data, error } = await supabase
        .from('entrenador_asignacion')
        .select(`
          entasig_id,
          colacthor_id,
          colegio_actividad_horario:colacthor_id (
            colacthor_hora_inicio,
            colacthor_hora_fin,
            colegio:col_id (
              col_nombre
            ),
            actividad:act_id (
              act_nombre
            ),
            dia:dia_id (
              dia_nombre
            )
          )
        `)
        .eq('ent_id', entrenador.ent_id)
        .is('entasig_fecha_fin', null)
        .eq('est_id', 1); // Only active assignments

      if (error) throw error;

      const formattedAssigned = (data || [])
        .filter(item => item.colegio_actividad_horario)
        .map(item => {
          const cah = item.colegio_actividad_horario as any;
          return {
            entasig_id: item.entasig_id,
            colacthor_id: item.colacthor_id!,
            colegio_nombre: cah.colegio?.col_nombre || '',
            actividad_nombre: cah.actividad?.act_nombre || '',
            dia_nombre: cah.dia?.dia_nombre || '',
            hora_inicio: cah.colacthor_hora_inicio,
            hora_fin: cah.colacthor_hora_fin,
          };
        });

      setAssignedDisciplinas(formattedAssigned);
    } catch (error) {
      console.error("Error loading assigned disciplinas:", error);
      toast({
        title: "Error",
        description: "Error al cargar las disciplinas asignadas",
        variant: "destructive"
      });
    }
  };

  const handleDisciplinaToggle = (disciplinaId: string, checked: boolean) => {
    if (checked) {
      setSelectedDisciplinaIds(prev => [...prev, disciplinaId]);
    } else {
      setSelectedDisciplinaIds(prev => prev.filter(id => id !== disciplinaId));
    }
  };

  const handleSubmit = async () => {
    if (!entrenador || selectedDisciplinaIds.length === 0) return;

    try {
      setLoading(true);

      // Check for existing assignments
      const { data: existingAssignments } = await supabase
        .from('entrenador_asignacion')
        .select('colacthor_id')
        .eq('ent_id', entrenador.ent_id)
        .in('colacthor_id', selectedDisciplinaIds.map(id => parseInt(id)))
        .is('entasig_fecha_fin', null)
        .eq('est_id', 1);

      const existingIds = new Set(existingAssignments?.map(a => a.colacthor_id.toString()) || []);
      const newDisciplinaIds = selectedDisciplinaIds.filter(id => !existingIds.has(id));

      if (newDisciplinaIds.length === 0) {
        toast({
          title: "Sin cambios",
          description: "Todas las disciplinas seleccionadas ya están asignadas",
          variant: "destructive"
        });
        return;
      }

      // Create assignments for new disciplinas
      const assignmentsToCreate = newDisciplinaIds.map(disciplinaId => ({
        ent_id: entrenador.ent_id,
        colacthor_id: parseInt(disciplinaId),
        entasig_fecha_inicio: new Date().toISOString().split('T')[0],
        entasig_fecha_fin: null,
        est_id: 1
      }));

      const { error } = await supabase
        .from('entrenador_asignacion')
        .insert(assignmentsToCreate);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `Entrenador asignado a ${newDisciplinaIds.length} disciplina(s) correctamente`
      });

      setSelectedDisciplinaIds([]);
      loadDisciplinas(); // Reload to update available disciplinas
      loadAssignedDisciplinas();
      onSuccess();
    } catch (error) {
      console.error("Error creating assignments:", error);
      toast({
        title: "Error",
        description: "Error al asignar el entrenador a las disciplinas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDisciplina = (disciplina: AssignedDisciplina) => {
    setDisciplinaToDelete(disciplina);
    setShowDeleteDialog(true);
  };

  const confirmDeleteDisciplina = async () => {
    if (!disciplinaToDelete) return;

    try {
      setLoading(true);

      // Update assignment to set end date and inactive status instead of deleting
      const { error } = await supabase
        .from('entrenador_asignacion')
        .update({ 
          entasig_fecha_fin: new Date().toISOString().split('T')[0],
          est_id: 2 // Inactive
        })
        .eq('entasig_id', disciplinaToDelete.entasig_id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Disciplina eliminada correctamente del entrenador"
      });

      loadDisciplinas(); // Reload to update available disciplinas
      loadAssignedDisciplinas();
      onSuccess();
    } catch (error) {
      console.error("Error removing assignment:", error);
      toast({
        title: "Error",
        description: "Error al eliminar la disciplina del entrenador",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
      setDisciplinaToDelete(null);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (time: string | null) => {
    if (!time) return "";
    return time.slice(0, 5);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md md:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignar Disciplinas a Entrenador</DialogTitle>
          </DialogHeader>

          {entrenador && (
            <div className="space-y-6">
              {/* Entrenador Info */}
              <div className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={entrenador.usuario.usu_foto || undefined} />
                  <AvatarFallback>
                    {getInitials(entrenador.usuario.usu_nombre)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{entrenador.usuario.usu_nombre}</h3>
                  <p className="text-sm text-muted-foreground">
                    Cédula: {entrenador.ent_cedula || "—"}
                  </p>
                </div>
              </div>

              {/* Disciplina Multi-Selection */}
              <div className="space-y-3">
                <Label>Seleccionar Disciplinas:</Label>
                {disciplinas.length === 0 ? (
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground text-center">
                        No hay disciplinas disponibles
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {disciplinas.map((disciplina) => (
                      <Card key={disciplina.colacthor_id} className="transition-colors hover:bg-muted/50">
                        <CardContent className="p-3">
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              id={`disciplina-${disciplina.colacthor_id}`}
                              checked={selectedDisciplinaIds.includes(disciplina.colacthor_id.toString())}
                              onCheckedChange={(checked) => 
                                handleDisciplinaToggle(disciplina.colacthor_id.toString(), checked as boolean)
                              }
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <label 
                                htmlFor={`disciplina-${disciplina.colacthor_id}`}
                                className="block font-medium text-sm cursor-pointer"
                              >
                                {disciplina.actividad.act_nombre} - {disciplina.colegio.col_nombre}
                              </label>
                              <p className="text-xs text-muted-foreground">
                                {disciplina.dia.dia_nombre}: {formatTime(disciplina.colacthor_hora_inicio)} - {formatTime(disciplina.colacthor_hora_fin)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Assigned Disciplinas */}
              {assignedDisciplinas.length > 0 && (
                <div className="space-y-2">
                  <Label>Disciplinas Asignadas:</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {assignedDisciplinas.map((disciplina) => (
                      <div key={disciplina.entasig_id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {disciplina.actividad_nombre} - {disciplina.colegio_nombre}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {disciplina.dia_nombre}: {formatTime(disciplina.hora_inicio)} - {formatTime(disciplina.hora_fin)}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteDisciplina(disciplina)}
                          className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Eliminar asignación"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || selectedDisciplinaIds.length === 0 || disciplinas.length === 0}
              className="bg-[#FD5757] hover:bg-[#E04747]"
            >
              {loading ? "Asignando..." : `Asignar a ${selectedDisciplinaIds.length} disciplina(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar la asignación de la disciplina "{disciplinaToDelete?.actividad_nombre}" del entrenador? Esta acción marcará la asignación como inactiva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteDisciplina}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AtarEntrenadorModal;
