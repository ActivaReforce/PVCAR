
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type NinoAsignacion = Database['public']['Tables']['nino_asignacion']['Row'] & {
  colegio_actividad_horario: {
    actividad: { act_nombre: string } | null;
    dia: { dia_nombre: string } | null;
    colacthor_hora_inicio: string | null;
    colacthor_hora_fin: string | null;
  } | null;
};

export const useEstudianteDisciplinas = (estudianteId: number) => {
  const [assignments, setAssignments] = useState<NinoAsignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    assignmentId: number | null;
    disciplineName: string;
  }>({
    isOpen: false,
    assignmentId: null,
    disciplineName: ''
  });
  const { toast } = useToast();

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('nino_asignacion')
        .select(`
          *,
          colegio_actividad_horario!inner(
            actividad!inner(act_nombre),
            dia(dia_nombre),
            colacthor_hora_inicio,
            colacthor_hora_fin
          )
        `)
        .eq('nino_id', estudianteId)
        .eq('est_id', 1) // Only active assignments
        .order('ninoasig_fecha_inscripcion', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast({
        title: "Error",
        description: "Error al cargar las disciplinas asignadas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkRequest = (assignmentId: number, disciplineName: string) => {
    setConfirmDialog({
      isOpen: true,
      assignmentId,
      disciplineName
    });
  };

  const handleConfirmUnlink = async () => {
    const { assignmentId, disciplineName } = confirmDialog;
    if (!assignmentId) return;

    setUnlinkingId(assignmentId);
    setConfirmDialog({ isOpen: false, assignmentId: null, disciplineName: '' });

    try {
      // Update status to inactive and set withdrawal date instead of deleting
      const { error } = await supabase
        .from('nino_asignacion')
        .update({
          est_id: 2, // Inactive status
          ninoasig_fecha_baja: new Date().toISOString()
        })
        .eq('ninoasig_id', assignmentId);

      if (error) throw error;

      // Optimistic update - remove from active list
      setAssignments(prev => prev.filter(a => a.ninoasig_id !== assignmentId));

      toast({
        title: "Éxito",
        description: `Disciplina "${disciplineName}" desvinculada correctamente`,
      });

      // Trigger a custom event to notify other components about the discipline change
      window.dispatchEvent(new CustomEvent('disciplineAssignmentChanged', {
        detail: { estudianteId, action: 'unlink' }
      }));
    } catch (error: any) {
      console.error("Error unlinking discipline:", error);
      toast({
        title: "Error",
        description: error.message || "Error al desvincular la disciplina",
        variant: "destructive",
      });
      // Refresh on error
      fetchAssignments();
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleCancelUnlink = () => {
    setConfirmDialog({ isOpen: false, assignmentId: null, disciplineName: '' });
  };

  useEffect(() => {
    fetchAssignments();
  }, [estudianteId]);

  return {
    assignments,
    loading,
    unlinkingId,
    confirmDialog,
    handleUnlinkRequest,
    handleConfirmUnlink,
    handleCancelUnlink,
    refetch: fetchAssignments
  };
};
