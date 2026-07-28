
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import NewEvaluationModal from '@/components/evaluations/NewEvaluationModal';
import EvaluationsTableContainer from '@/components/evaluations/EvaluationsTableContainer';
import EvaluateStudentsSection from '@/components/evaluations/EvaluateStudentsSection';
import LinkDisciplinesToEvaluationModal from '@/components/evaluations/LinkDisciplinesToEvaluationModal';
import { useEvaluations } from '@/hooks/useEvaluations';
import { useToast } from '@/hooks/use-toast';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import { useTrainerEvaluationContext } from '@/hooks/useTrainerEvaluationContext';

interface EditEvaluation {
  eva_id: number;
  eva_titulo: string;
  eva_descripcion: string | null;
  eva_categoria: string | null;
  eva_puntaje_total: number | null;
  eva_creador: number;
  eva_fecha_creacion: string;
  est_id: number;
}

const Evaluaciones = () => {
  const [showNewEvaluationModal, setShowNewEvaluationModal] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<EditEvaluation | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'management' | 'evaluate'>('management');
  const [linkModalData, setLinkModalData] = useState<{
    open: boolean;
    evaluationId: number | null;
    evaluationTitle: string;
  }>({ open: false, evaluationId: null, evaluationTitle: '' });
  const { fetchEvaluationWithParameters } = useEvaluations();
  const { toast } = useToast();
  const { trainerName, isAuxiliaryRole } = useTrainerEvaluationContext();

  const handleNewEvaluation = () => {
    setEditingEvaluation(null);
    setShowNewEvaluationModal(true);
  };

  const handleEditEvaluation = async (evaluation: EditEvaluation) => {
    try {
      const data = await fetchEvaluationWithParameters(evaluation.eva_id);
      if (data) {
        setEditingEvaluation(evaluation);
        setShowNewEvaluationModal(true);
      }
    } catch (error) {
      console.error('Error fetching evaluation for edit:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la evaluación para editar.",
        variant: "destructive",
      });
    }
  };

  const handleLinkEvaluation = (evaluation: EditEvaluation) => {
    setLinkModalData({ 
      open: true, 
      evaluationId: evaluation.eva_id,
      evaluationTitle: evaluation.eva_titulo
    });
  };

  const handleModalClose = () => {
    setShowNewEvaluationModal(false);
    setEditingEvaluation(null);
    // Trigger a refresh of the table
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLinkModalClose = () => {
    setLinkModalData({ open: false, evaluationId: null, evaluationTitle: '' });
    // Trigger a refresh of the table
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      {/* Mobile Layout */}
      <div className="block md:hidden">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Gestión de Evaluaciones
            </h1>
            {isAuxiliaryRole && trainerName && (
              <p className="text-sm text-muted-foreground mt-1">
                Evaluaciones del entrenador {trainerName}
              </p>
            )}
          </div>
          
          <ConditionalAction module="evaluaciones" action="crear">
            <Button 
              onClick={handleNewEvaluation}
              className="flex items-center justify-center gap-2 w-full"
            >
              <Plus className="h-4 w-4" />
              Nueva Evaluación
            </Button>
          </ConditionalAction>

          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant={activeTab === 'management' ? 'default' : 'outline'}
              onClick={() => setActiveTab('management')}
              className="text-xs px-2 py-2 h-auto"
            >
              Gestión de Evaluaciones
            </Button>
            <Button 
              variant={activeTab === 'evaluate' ? 'default' : 'outline'}
              onClick={() => setActiveTab('evaluate')}
              className="text-xs px-2 py-2 h-auto"
            >
              Evaluar Alumnos
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Gestión de Evaluaciones
            </h1>
            {isAuxiliaryRole && trainerName && (
              <p className="text-sm text-muted-foreground mt-1">
                Evaluaciones del entrenador {trainerName}
              </p>
            )}
          </div>
          <ConditionalAction module="evaluaciones" action="crear">
            <Button 
              onClick={handleNewEvaluation}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nueva Evaluación
            </Button>
          </ConditionalAction>
        </div>
      </div>
      
      {/* Mobile Content */}
      <div className="block md:hidden mt-6">
        {activeTab === 'management' && (
          <EvaluationsTableContainer 
            onEditEvaluation={handleEditEvaluation}
            onLinkEvaluation={handleLinkEvaluation}
            refreshTrigger={refreshTrigger}
          />
        )}
        {activeTab === 'evaluate' && (
          <EvaluateStudentsSection />
        )}
      </div>

      {/* Desktop Tabs */}
      <Tabs defaultValue="management" className="w-full hidden md:block">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="management">Gestión de Evaluaciones</TabsTrigger>
          <TabsTrigger value="evaluate">Evaluar Alumnos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="management" className="mt-6">
          <EvaluationsTableContainer 
            onEditEvaluation={handleEditEvaluation}
            onLinkEvaluation={handleLinkEvaluation}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>
        
        <TabsContent value="evaluate" className="mt-6">
          <EvaluateStudentsSection />
        </TabsContent>
      </Tabs>

      <NewEvaluationModal 
        open={showNewEvaluationModal}
        onOpenChange={handleModalClose}
        editingEvaluation={editingEvaluation}
      />

      <LinkDisciplinesToEvaluationModal
        open={linkModalData.open}
        onOpenChange={handleLinkModalClose}
        evaluationId={linkModalData.evaluationId}
        evaluationTitle={linkModalData.evaluationTitle}
      />
    </div>
  );
};

export default Evaluaciones;
