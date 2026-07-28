
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EvaluationDetailsStep from './EvaluationDetailsStep';
import EvaluationParametersStep from './EvaluationParametersStep';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { TimeRangeRule } from './TimeRangeConfig';

export interface EvaluationParameter {
  evaparam_nombre: string;
  evaparam_nota: string;
  evaparam_intentos: number;
  evatipometo_id: number;
  evaparam_escala_min?: number;
  evaparam_escala_max?: number;
  evaparam_puntaje?: number;
  timeRange?: TimeRangeRule;
}

interface EvaluationDetails {
  eva_titulo: string;
  eva_descripcion: string;
  eva_categoria: string;
}

interface EditEvaluation {
  eva_id: number;
  eva_titulo: string;
  eva_descripcion: string | null;
  eva_categoria: string | null;
  eva_creador: number;
  eva_fecha_creacion: string;
  est_id: number;
}

interface NewEvaluationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEvaluation?: EditEvaluation | null;
}

const NewEvaluationModal: React.FC<NewEvaluationModalProps> = ({
  open,
  onOpenChange,
  editingEvaluation
}) => {
  const [currentStep, setCurrentStep] = useState('details');
  const [evaluationDetails, setEvaluationDetails] = useState<EvaluationDetails>({
    eva_titulo: '',
    eva_descripcion: '',
    eva_categoria: ''
  });
  const [parameters, setParameters] = useState<EvaluationParameter[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Reset form when modal opens/closes or when switching between create/edit
  useEffect(() => {
    if (open) {
      if (editingEvaluation) {
        // Editing mode - load existing data
        setEvaluationDetails({
          eva_titulo: editingEvaluation.eva_titulo,
          eva_descripcion: editingEvaluation.eva_descripcion || '',
          eva_categoria: editingEvaluation.eva_categoria || ''
        });
        loadExistingParameters(editingEvaluation.eva_id);
      } else {
        // Creating new evaluation - reset to defaults
        setEvaluationDetails({
          eva_titulo: '',
          eva_descripcion: '',
          eva_categoria: ''
        });
        setParameters([]);
      }
      setCurrentStep('details');
    }
  }, [open, editingEvaluation]);

  const loadExistingParameters = async (evaluationId: number) => {
    try {
      // Fetch parameters
      const { data, error } = await supabase
        .from('evaluacion_parametro')
        .select('evaparam_nombre, evaparam_nota, evaparam_intentos, evatipometo_id, evaparam_escala_min, evaparam_escala_max, evaparam_puntaje, evaparam_id')
        .eq('eva_id', evaluationId)
        .order('evaparam_id');

      if (error) {
        console.error('Error loading parameters:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los parámetros de la evaluación.",
          variant: "destructive",
        });
        return;
      }

      // Fetch time ranges for tiempo parameters using the correct column names
      const { data: timeRanges, error: timeRangeError } = await supabase
        .from('evaluacion_tiempo_rangos')
        .select('evaparam_id, evatieran_op_cero, evatieran_tiempo_cero, evatieran_op_full, evatieran_tiempo_full');

      if (timeRangeError) {
        console.error('Error loading time ranges:', timeRangeError);
      }

      // Transform the data to match our interface
      const transformedData: EvaluationParameter[] = (data || []).map(param => {
        const timeRange = timeRanges?.find(tr => tr.evaparam_id === param.evaparam_id);
        
        return {
          evaparam_nombre: param.evaparam_nombre || '',
          evaparam_nota: param.evaparam_nota || '',
          evaparam_intentos: param.evaparam_intentos || 1,
          evatipometo_id: param.evatipometo_id || 1,
          evaparam_escala_min: param.evaparam_escala_min || undefined,
          evaparam_escala_max: param.evaparam_escala_max || undefined,
          evaparam_puntaje: param.evaparam_puntaje || undefined,
          timeRange: timeRange ? {
            evatieran_op_cero: timeRange.evatieran_op_cero,
            evatieran_tiempo_cero: timeRange.evatieran_tiempo_cero,
            evatieran_op_full: timeRange.evatieran_op_full,
            evatieran_tiempo_full: timeRange.evatieran_tiempo_full
          } : undefined
        };
      });

      setParameters(transformedData);
    } catch (error) {
      console.error('Unexpected error loading parameters:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado al cargar los parámetros.",
        variant: "destructive",
      });
    }
  };

  const handleDetailsSubmit = (details: EvaluationDetails) => {
    setEvaluationDetails(details);
    setCurrentStep('parameters');
  };

  const handleParametersSubmit = async (finalParameters: EvaluationParameter[]) => {
    setIsSubmitting(true);

    try {
      if (editingEvaluation) {
        // Update existing evaluation
        await updateEvaluation(editingEvaluation.eva_id, finalParameters);
      } else {
        // Create new evaluation
        await createEvaluation(finalParameters);
      }

      toast({
        title: "Éxito",
        description: editingEvaluation 
          ? "Evaluación actualizada correctamente." 
          : "Evaluación creada correctamente.",
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting evaluation:', error);
      toast({
        title: "Error",
        description: editingEvaluation 
          ? "No se pudo actualizar la evaluación." 
          : "No se pudo crear la evaluación.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const createEvaluation = async (finalParameters: EvaluationParameter[]) => {
    if (!user?.usu_id) {
      throw new Error('No authenticated user');
    }

    // Create evaluation
    const { data: evaluationData, error: evalError } = await supabase
      .from('evaluacion')
      .insert({
        eva_titulo: evaluationDetails.eva_titulo,
        eva_descripcion: evaluationDetails.eva_descripcion || null,
        eva_categoria: evaluationDetails.eva_categoria || null,
        eva_creador: user.usu_id,
        est_id: 1
      })
      .select('eva_id')
      .single();

    if (evalError || !evaluationData) throw evalError;

    // Create parameters and handle time ranges
    await createParametersWithTimeRanges(evaluationData.eva_id, finalParameters);
  };

  const updateEvaluation = async (evaluationId: number, finalParameters: EvaluationParameter[]) => {
    // Update evaluation details
    const { error: evalError } = await supabase
      .from('evaluacion')
      .update({
        eva_titulo: evaluationDetails.eva_titulo,
        eva_descripcion: evaluationDetails.eva_descripcion || null,
        eva_categoria: evaluationDetails.eva_categoria || null
      })
      .eq('eva_id', evaluationId);

    if (evalError) throw evalError;

    // Delete existing parameters and their time ranges
    const { error: deleteError } = await supabase
      .from('evaluacion_parametro')
      .delete()
      .eq('eva_id', evaluationId);

    if (deleteError) throw deleteError;

    // Create new parameters and time ranges
    await createParametersWithTimeRanges(evaluationId, finalParameters);
  };

  const createParametersWithTimeRanges = async (evaluationId: number, finalParameters: EvaluationParameter[]) => {
    // Insert parameters
    const parametersToInsert = finalParameters.map(param => ({
      eva_id: evaluationId,
      evaparam_nombre: param.evaparam_nombre,
      evaparam_nota: param.evaparam_nota || null,
      evaparam_intentos: param.evaparam_intentos,
      evatipometo_id: param.evatipometo_id,
      evaparam_escala_min: param.evaparam_escala_min || null,
      evaparam_escala_max: param.evaparam_escala_max || null,
      evaparam_puntaje: param.evaparam_puntaje || null
    }));

    const { data: insertedParameters, error: paramError } = await supabase
      .from('evaluacion_parametro')
      .insert(parametersToInsert)
      .select('evaparam_id');

    if (paramError) throw paramError;

    // Insert time ranges for tiempo parameters using correct column names
    const timeRangesToInsert = [];
    for (let i = 0; i < finalParameters.length; i++) {
      const param = finalParameters[i];
      if (param.evatipometo_id === 1 && param.timeRange && insertedParameters[i]) {
        timeRangesToInsert.push({
          evaparam_id: insertedParameters[i].evaparam_id,
          evatieran_op_cero: param.timeRange.evatieran_op_cero,
          evatieran_tiempo_cero: param.timeRange.evatieran_tiempo_cero,
          evatieran_op_full: param.timeRange.evatieran_op_full,
          evatieran_tiempo_full: param.timeRange.evatieran_tiempo_full
        });
      }
    }

    if (timeRangesToInsert.length > 0) {
      const { error: timeRangeError } = await supabase
        .from('evaluacion_tiempo_rangos')
        .insert(timeRangesToInsert);

      if (timeRangeError) throw timeRangeError;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {editingEvaluation ? 'Editar Evaluación' : 'Nueva Evaluación'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={currentStep} onValueChange={setCurrentStep} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="parameters" disabled={!evaluationDetails.eva_titulo.trim()}>
              Parámetros
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="details" className="space-y-4">
              <EvaluationDetailsStep
                data={evaluationDetails}
                onSubmit={handleDetailsSubmit}
                isSubmitting={isSubmitting}
              />
            </TabsContent>

            <TabsContent value="parameters" className="space-y-4">
              <EvaluationParametersStep
                parameters={parameters}
                onParametersChange={setParameters}
                onSubmit={handleParametersSubmit}
                isSubmitting={isSubmitting}
                evaluationDraft={evaluationDetails}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default NewEvaluationModal;
