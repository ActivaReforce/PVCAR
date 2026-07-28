
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSorting } from '@/hooks/useSorting';
import { usePagination } from '@/hooks/usePagination';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import EvaluationsTable from './EvaluationsTable';
import { useTrainerEvaluationContext } from '@/hooks/useTrainerEvaluationContext';

interface Evaluation {
  eva_id: number;
  eva_titulo: string;
  eva_descripcion: string | null;
  eva_categoria: string | null;
  eva_fecha_creacion: string;
  eva_puntaje_total: number | null;
  est_id: number;
  eva_creador: number;
  estado?: {
    est_nombre: string;
  };
  usuario?: {
    usu_nombre: string;
  };
}

interface EvaluationsTableContainerProps {
  onEditEvaluation: (evaluation: Evaluation) => void;
  onLinkEvaluation: (evaluation: Evaluation) => void;
  refreshTrigger: number;
}

const EvaluationsTableContainer: React.FC<EvaluationsTableContainerProps> = ({
  onEditEvaluation,
  onLinkEvaluation,
  refreshTrigger
}) => {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { trainerId, isAuxiliaryRole } = useTrainerEvaluationContext();

  // Filter evaluations based on search term
  const filteredEvaluations = useMemo(() => {
    if (!searchTerm.trim()) return evaluations;
    
    const searchLower = searchTerm.toLowerCase();
    return evaluations.filter(evaluation => 
      evaluation.eva_titulo.toLowerCase().includes(searchLower) ||
      (evaluation.eva_descripcion && evaluation.eva_descripcion.toLowerCase().includes(searchLower))
    );
  }, [evaluations, searchTerm]);

  // Add sorting functionality
  const { sortedData, sortKey, sortDirection, handleSort } = useSorting({
    data: filteredEvaluations,
    defaultSortKey: null,
    defaultSortDirection: null
  });

  // Add pagination functionality
  const {
    currentPage,
    totalPages,
    paginatedData,
    goToPage,
    canGoNext,
    canGoPrevious,
    startIndex,
    endIndex,
    totalItems
  } = usePagination({
    data: sortedData,
    itemsPerPage: 5
  });

  const fetchEvaluations = async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('evaluacion')
        .select(`
          eva_id,
          eva_titulo,
          eva_descripcion,
          eva_categoria,
          eva_fecha_creacion,
          eva_puntaje_total,
          est_id,
          eva_creador,
          estado:est_id (
            est_nombre
          ),
          usuario:eva_creador (
            usu_nombre
          )
        `);

      // Filter for auxiliary roles based on trainer's evaluations
      if (isAuxiliaryRole && trainerId) {
        // Get evaluation IDs that are assigned to disciplines the trainer teaches
        const { data: trainerAssignments, error: assignmentError } = await supabase
          .from('entrenador_asignacion')
          .select('colacthor_id')
          .eq('ent_id', trainerId)
          .eq('est_id', 1);

        if (assignmentError) {
          console.error('Error fetching trainer assignments:', assignmentError);
          setEvaluations([]);
          return;
        }

        if (!trainerAssignments || trainerAssignments.length === 0) {
          setEvaluations([]);
          return;
        }

        const colacthorIds = trainerAssignments.map(ta => ta.colacthor_id);

        // Get evaluations assigned to these disciplines
        const { data: evaluationAssignments, error: evalAssignmentError } = await supabase
          .from('evaluacion_asignacion')
          .select('eva_id')
          .in('colacthor_id', colacthorIds)
          .eq('est_id', 1);

        if (evalAssignmentError) {
          console.error('Error fetching evaluation assignments:', evalAssignmentError);
          setEvaluations([]);
          return;
        }

        if (!evaluationAssignments || evaluationAssignments.length === 0) {
          setEvaluations([]);
          return;
        }

        const evaluationIds = [...new Set(evaluationAssignments.map(ea => ea.eva_id))];
        query = query.in('eva_id', evaluationIds);
      }

      const { data, error } = await query.order('eva_fecha_creacion', { ascending: false });

      if (error) {
        console.error('Error fetching evaluations:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las evaluaciones.",
          variant: "destructive",
        });
        return;
      }

      setEvaluations(data || []);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado al cargar las evaluaciones.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuxiliaryRole) {
      // Wait for trainer context to be resolved for auxiliary roles
      if (trainerId !== null) {
        fetchEvaluations();
      }
    } else {
      // For non-auxiliary roles, fetch immediately
      fetchEvaluations();
    }
  }, [refreshTrigger, trainerId, isAuxiliaryRole]);

  const handleRefresh = () => {
    fetchEvaluations();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Cargando evaluaciones...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título o descripción..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8"
        />
      </div>

      <EvaluationsTable
        evaluations={paginatedData}
        onEdit={onEditEvaluation}
        onLink={onLinkEvaluation}
        onRefresh={handleRefresh}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
        canGoNext={canGoNext}
        canGoPrevious={canGoPrevious}
        startIndex={startIndex}
        endIndex={endIndex}
        totalItems={totalItems}
      />
    </div>
  );
};

export default EvaluationsTableContainer;
