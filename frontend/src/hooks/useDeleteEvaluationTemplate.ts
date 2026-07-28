
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useDeleteEvaluationTemplate = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const deleteEvaluationTemplate = async (evaluationId: number): Promise<boolean> => {
    setIsDeleting(true);
    
    try {
      // First delete all parameters
      const { error: paramsError } = await supabase
        .from('evaluacion_parametro')
        .delete()
        .eq('eva_id', evaluationId);

      if (paramsError) {
        console.error('Error deleting evaluation parameters:', paramsError);
        toast({
          title: "Error",
          description: "No se pudieron eliminar los parámetros de la evaluación.",
          variant: "destructive",
        });
        return false;
      }

      // Then delete the evaluation
      const { error: evaluationError } = await supabase
        .from('evaluacion')
        .delete()
        .eq('eva_id', evaluationId);

      if (evaluationError) {
        console.error('Error deleting evaluation:', evaluationError);
        toast({
          title: "Error",
          description: "No se pudo eliminar la evaluación. Inténtalo de nuevo.",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Éxito",
        description: "Evaluación eliminada exitosamente.",
      });

      return true;
    } catch (error) {
      console.error('Unexpected error deleting evaluation:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado al eliminar la evaluación.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deleteEvaluationTemplate,
    isDeleting
  };
};
