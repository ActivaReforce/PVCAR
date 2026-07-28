import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import EvaluationParameterPreview from './EvaluationParameterPreview';

interface EvaluationParameter {
  evaparam_id: number;
  evaparam_nombre: string;
  evaparam_nota: string | null;
  evaparam_intentos: number;
  evatipometo_id: number;
  evaparam_escala_min: number | null;
  evaparam_escala_max: number | null;
  evaparam_puntaje?: number;
  metodo_nombre?: string;
}

interface EvaluationData {
  eva_id?: number;
  eva_titulo: string;
  eva_descripcion: string | null;
  eva_categoria: string | null;
  parameters: EvaluationParameter[];
}

interface EvaluationPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluationId?: number | null;
  evaluationTitle?: string;
  previewData?: EvaluationData;
}

const EvaluationPreviewModal: React.FC<EvaluationPreviewModalProps> = ({
  open,
  onOpenChange,
  evaluationId,
  evaluationTitle,
  previewData
}) => {
  const [evaluationData, setEvaluationData] = useState<EvaluationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewState, setPreviewState] = useState<Record<number, any>>({});
  const { toast } = useToast();

  // Calculate total points from parameters
  const totalPoints = evaluationData?.parameters.reduce((sum, param) => {
    return sum + (param.evaparam_puntaje || 0);
  }, 0) || 0;

  useEffect(() => {
    if (open) {
      if (previewData) {
        // Use provided preview data (for new evaluations)
        setEvaluationData(previewData);
        initializePreviewState(previewData.parameters);
      } else if (evaluationId) {
        // Fetch evaluation data (for existing evaluations)
        fetchEvaluationData();
      }
    } else {
      // Clear preview state when modal closes
      setPreviewState({});
      setEvaluationData(null);
    }
  }, [open, evaluationId, previewData]);

  const initializePreviewState = (parameters: EvaluationParameter[]) => {
    const initialState: Record<number, any> = {};
    parameters.forEach(param => {
      initialState[param.evaparam_id] = {};
    });
    setPreviewState(initialState);
  };

  const fetchEvaluationData = async () => {
    if (!evaluationId) return;

    setIsLoading(true);
    try {
      // Fetch evaluation details
      const { data: evaluation, error: evalError } = await supabase
        .from('evaluacion')
        .select('eva_id, eva_titulo, eva_descripcion, eva_categoria')
        .eq('eva_id', evaluationId)
        .single();

      if (evalError) {
        console.error('Error fetching evaluation:', evalError);
        toast({
          title: "Error",
          description: "No se pudo cargar la evaluación.",
          variant: "destructive",
        });
        return;
      }

      // Fetch parameters with method details
      const { data: parameters, error: paramError } = await supabase
        .from('evaluacion_parametro')
        .select(`
          evaparam_id,
          evaparam_nombre,
          evaparam_nota,
          evaparam_intentos,
          evatipometo_id,
          evaparam_escala_min,
          evaparam_escala_max,
          evaparam_puntaje,
          evaluacion_tipo_metodo(evatipometo_nombre)
        `)
        .eq('eva_id', evaluationId)
        .order('evaparam_id');

      if (paramError) {
        console.error('Error fetching parameters:', paramError);
        toast({
          title: "Error",
          description: "No se pudieron cargar los parámetros de la evaluación.",
          variant: "destructive",
        });
        return;
      }

      const formattedParameters: EvaluationParameter[] = parameters?.map(param => ({
        evaparam_id: param.evaparam_id,
        evaparam_nombre: param.evaparam_nombre,
        evaparam_nota: param.evaparam_nota,
        evaparam_intentos: param.evaparam_intentos,
        evatipometo_id: param.evatipometo_id,
        evaparam_escala_min: param.evaparam_escala_min,
        evaparam_escala_max: param.evaparam_escala_max,
        evaparam_puntaje: param.evaparam_puntaje,
        metodo_nombre: param.evaluacion_tipo_metodo?.evatipometo_nombre
      })) || [];

      const evaluationDataResult = {
        ...evaluation,
        parameters: formattedParameters
      };

      setEvaluationData(evaluationDataResult);
      initializePreviewState(formattedParameters);

    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateParameterState = (paramId: number, newState: any) => {
    setPreviewState(prev => ({
      ...prev,
      [paramId]: { ...prev[paramId], ...newState }
    }));
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista previa de evaluación</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="text-lg">Cargando vista previa...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!evaluationData) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Vista previa: {evaluationData.eva_titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Evaluation Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Información de la evaluación</CardTitle>
                <Badge variant="secondary">Vista previa</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {evaluationData.eva_descripcion && (
                  <p className="text-muted-foreground">{evaluationData.eva_descripcion}</p>
                )}
                {evaluationData.eva_categoria && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Categoría:</span>
                    <Badge variant="outline">{evaluationData.eva_categoria}</Badge>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Valor total:</span>
                  <Badge variant="outline">{totalPoints}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Parámetros:</span>
                  <Badge variant="outline">{evaluationData.parameters.length}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parameters */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Parámetros de evaluación</h3>
            {evaluationData.parameters.map((parameter, index) => (
              <EvaluationParameterPreview
                key={parameter.evaparam_id}
                parameter={parameter}
                index={index + 1}
                state={previewState[parameter.evaparam_id] || {}}
                onStateChange={(newState) => updateParameterState(parameter.evaparam_id, newState)}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EvaluationPreviewModal;
