
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StudentEvaluation {
  nino_nombre: string;
  evaninopen_id: number;
  est_id: number;
}

export const useDeleteEvaluation = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const deleteEvaluation = async (student: StudentEvaluation): Promise<boolean> => {
    setIsDeleting(true);
    
    try {
      // Call the RPC function to delete the student evaluation
      const { error } = await supabase.rpc('delete_student_evaluation', {
        p_evaninopen_id: student.evaninopen_id
      });

      if (error) {
        console.error('Error deleting evaluation:', error);
        toast({
          title: "Error",
          description: "No se pudo eliminar la evaluación. Inténtalo de nuevo.",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Éxito",
        description: `Evaluación de ${student.nino_nombre} eliminada exitosamente.`,
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
    deleteEvaluation,
    isDeleting
  };
};
