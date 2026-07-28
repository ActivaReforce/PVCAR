import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { RemoveDisciplineDialog } from "./RemoveDisciplineDialog";

type ColActHor = Database['public']['Tables']['colegio_actividad_horario']['Row'] & {
  actividad: { act_nombre: string } | null;
  dia: { dia_nombre: string } | null;
};

type Assignment = {
  ninoasig_id: number;
  colacthor_id: number;
  actividad_nombre: string;
  dia_nombre?: string;
  hora_inicio?: string;
  hora_fin?: string;
};

interface LinkDisciplinasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estudiante: {
    nino_id: number;
    nino_nombre: string;
    col_id: number;
    colegio: { col_nombre: string } | null;
  } | null;
  onSuccess: () => void;
}

const LinkDisciplinasModal = ({
  open,
  onOpenChange,
  estudiante,
  onSuccess
}: LinkDisciplinasModalProps) => {
  const [disciplines, setDisciplines] = useState<ColActHor[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<Assignment[]>([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    assignment: Assignment | null;
  }>({
    isOpen: false,
    assignment: null
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && estudiante) {
      fetchDisciplines();
      fetchCurrentAssignments();
      setSelectedDisciplines([]);
    }
  }, [open, estudiante]);

  const fetchCurrentAssignments = async () => {
    if (!estudiante) return;

    try {
      const { data: assignments, error } = await supabase
        .from('nino_asignacion')
        .select(`
          ninoasig_id,
          colacthor_id,
          colegio_actividad_horario!inner(
            colacthor_hora_inicio,
            colacthor_hora_fin,
            actividad!inner(act_nombre),
            dia(dia_nombre)
          )
        `)
        .eq('nino_id', estudiante.nino_id)
        .eq('est_id', 1); // Only active assignments

      if (error) throw error;

      const formattedAssignments: Assignment[] = (assignments || []).map(assignment => ({
        ninoasig_id: assignment.ninoasig_id,
        colacthor_id: assignment.colacthor_id,
        actividad_nombre: assignment.colegio_actividad_horario?.actividad?.act_nombre || 'Sin nombre',
        dia_nombre: assignment.colegio_actividad_horario?.dia?.dia_nombre,
        hora_inicio: assignment.colegio_actividad_horario?.colacthor_hora_inicio,
        hora_fin: assignment.colegio_actividad_horario?.colacthor_hora_fin
      }));

      setCurrentAssignments(formattedAssignments);
    } catch (error) {
      console.error("Error fetching current assignments:", error);
      toast({
        title: "Error",
        description: "Error al cargar las disciplinas asignadas",
        variant: "destructive",
      });
    }
  };

  const fetchDisciplines = async () => {
    if (!estudiante) return;

    setLoading(true);
    try {
      // Get available disciplines for the student's school ONLY
      const { data: disciplinesData, error: disciplinesError } = await supabase
        .from('colegio_actividad_horario')
        .select(`
          *,
          actividad!inner(act_nombre),
          dia(dia_nombre)
        `)
        .eq('col_id', estudiante.col_id) // Only disciplines from this school
        .eq('est_id', 1); // Only active disciplines

      if (disciplinesError) throw disciplinesError;

      // Get already assigned disciplines for this student (only active ones)
      const { data: assignedData, error: assignedError } = await supabase
        .from('nino_asignacion')
        .select('colacthor_id')
        .eq('nino_id', estudiante.nino_id)
        .eq('est_id', 1); // Only active assignments

      if (assignedError) throw assignedError;

      const assignedIds = new Set(assignedData?.map(a => a.colacthor_id) || []);
      
      // Filter out already assigned disciplines
      const availableDisciplines = (disciplinesData || []).filter(
        d => !assignedIds.has(d.colacthor_id)
      );

      setDisciplines(availableDisciplines);
    } catch (error) {
      console.error("Error fetching disciplines:", error);
      toast({
        title: "Error",
        description: "Error al cargar las disciplinas disponibles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisciplineToggle = (colacthorId: number) => {
    setSelectedDisciplines(prev =>
      prev.includes(colacthorId)
        ? prev.filter(id => id !== colacthorId)
        : [...prev, colacthorId]
    );
  };

  const handleRemoveAssignmentRequest = (assignment: Assignment) => {
    setConfirmDialog({
      isOpen: true,
      assignment
    });
  };

  const handleConfirmRemoveAssignment = async () => {
    const { assignment } = confirmDialog;
    if (!assignment) return;

    try {
      // Optimistically remove from UI
      setCurrentAssignments(prev => 
        prev.filter(a => a.ninoasig_id !== assignment.ninoasig_id)
      );

      setConfirmDialog({ isOpen: false, assignment: null });

      // Deactivate the assignment (soft delete)
      const { error } = await supabase
        .from('nino_asignacion')
        .update({ 
          est_id: 2, // Inactive status
          ninoasig_fecha_baja: new Date().toISOString()
        })
        .eq('ninoasig_id', assignment.ninoasig_id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `Disciplina "${assignment.actividad_nombre}" desasignada correctamente`,
      });

      // Refresh available disciplines since one was removed
      fetchDisciplines();
    } catch (error: any) {
      console.error("Error removing assignment:", error);
      
      // Revert optimistic update on error
      fetchCurrentAssignments();
      
      toast({
        title: "Error",
        description: error.message || "Error al desasignar la disciplina",
        variant: "destructive",
      });
    }
  };

  const handleCancelRemoveAssignment = () => {
    setConfirmDialog({ isOpen: false, assignment: null });
  };

  const handleSave = async () => {
    if (!estudiante) return;

    if (selectedDisciplines.length === 0) {
      toast({
        title: "Error",
        description: "Debe seleccionar al menos una disciplina",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Insert assignments for selected disciplines
      const assignments = selectedDisciplines.map(colacthorId => ({
        nino_id: estudiante.nino_id,
        colacthor_id: colacthorId,
        ninoasig_fecha_inscripcion: new Date().toISOString(),
        ninoasig_fecha_baja: null, // Explicitly set to null for new assignments
        est_id: 1 // Active status
      }));

      const { error } = await supabase
        .from('nino_asignacion')
        .insert(assignments);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `${selectedDisciplines.length} disciplina(s) asignada(s) correctamente`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error linking disciplines:", error);
      toast({
        title: "Error",
        description: error.message || "Error al asignar las disciplinas",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatSchedule = (discipline: ColActHor) => {
    const parts = [];
    if (discipline.dia?.dia_nombre) {
      parts.push(discipline.dia.dia_nombre);
    }
    if (discipline.colacthor_hora_inicio && discipline.colacthor_hora_fin) {
      parts.push(`${discipline.colacthor_hora_inicio} - ${discipline.colacthor_hora_fin}`);
    }
    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
  };

  const formatAssignmentSchedule = (assignment: Assignment) => {
    const parts = [];
    if (assignment.dia_nombre) {
      parts.push(assignment.dia_nombre);
    }
    if (assignment.hora_inicio && assignment.hora_fin) {
      parts.push(`${assignment.hora_inicio} - ${assignment.hora_fin}`);
    }
    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
  };

  if (!estudiante) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Gestionar Disciplinas - {estudiante.nino_nombre}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Escuela: <span className="font-medium">{estudiante.colegio?.col_nombre || 'Sin asignar'}</span>
            </p>

            {/* Current assignments section */}
            <div className="space-y-3">
              <h4 className="font-semibold text-base">Disciplinas Asignadas</h4>
              {currentAssignments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {currentAssignments.map((assignment) => (
                    <Badge 
                      key={assignment.ninoasig_id} 
                      variant="default" 
                      className="flex items-center gap-2 px-3 py-1"
                    >
                      <span className="text-sm">
                        {assignment.actividad_nombre}
                        {formatAssignmentSchedule(assignment)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-destructive/20 hover:text-destructive"
                        onClick={() => handleRemoveAssignmentRequest(assignment)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-lg">
                  <p className="text-sm">Sin disciplinas asignadas</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Available disciplines section */}
            <div className="space-y-3">
              <h4 className="font-semibold text-base">Disciplinas Disponibles</h4>
              
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Cargando disciplinas disponibles...</p>
                </div>
              ) : disciplines.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No hay disciplinas disponibles para asignar en esta escuela</p>
                  <p className="text-sm mt-1">Es posible que ya tenga todas las disciplinas asignadas</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {disciplines.map((discipline) => (
                    <div
                      key={discipline.colacthor_id}
                      className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`discipline-${discipline.colacthor_id}`}
                        checked={selectedDisciplines.includes(discipline.colacthor_id)}
                        onCheckedChange={() => handleDisciplineToggle(discipline.colacthor_id)}
                      />
                      <label
                        htmlFor={`discipline-${discipline.colacthor_id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <span className="font-medium">
                          {discipline.actividad?.act_nombre || 'Disciplina sin nombre'}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formatSchedule(discipline)}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || selectedDisciplines.length === 0}
              >
                {saving ? "Guardando..." : `Asignar (${selectedDisciplines.length})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <RemoveDisciplineDialog
        isOpen={confirmDialog.isOpen}
        onClose={handleCancelRemoveAssignment}
        onConfirm={handleConfirmRemoveAssignment}
        disciplineName={confirmDialog.assignment?.actividad_nombre}
      />
    </>
  );
};

export default LinkDisciplinasModal;
