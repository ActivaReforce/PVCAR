
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Eye } from 'lucide-react';
import { EvaluationParameter } from './NewEvaluationModal';
import ParameterForm from './ParameterForm';
import EvaluateStudentModal from './EvaluateStudentModal';
import { supabase } from '@/integrations/supabase/client';

interface EvaluationParametersStepProps {
  parameters: EvaluationParameter[];
  onParametersChange: (parameters: EvaluationParameter[]) => void;
  onSubmit: (parameters: EvaluationParameter[]) => void;
  isSubmitting: boolean;
  evaluationDraft?: {
    eva_titulo: string;
    eva_descripcion: string;
    eva_categoria: string;
  };
}

interface EvaluationMethod {
  evatipometo_id: number;
  evatipometo_nombre: string;
}

const EvaluationParametersStep: React.FC<EvaluationParametersStepProps> = ({
  parameters,
  onParametersChange,
  onSubmit,
  isSubmitting,
  evaluationDraft
}) => {
  const [methods, setMethods] = useState<EvaluationMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [parameterValidations, setParameterValidations] = useState<{ [key: number]: boolean }>({});

  // Calculate total points from parameters
  const totalPoints = parameters.reduce((sum, param) => {
    return sum + (param.evaparam_puntaje || 0);
  }, 0);

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const { data, error } = await supabase
          .from('evaluacion_tipo_metodo')
          .select('evatipometo_id, evatipometo_nombre')
          .order('evatipometo_id');

        if (error) {
          console.error('Error fetching methods:', error);
          return;
        }

        setMethods(data || []);
      } catch (error) {
        console.error('Unexpected error fetching methods:', error);
      } finally {
        setLoadingMethods(false);
      }
    };

    fetchMethods();
  }, []);

  // Initialize with one empty parameter if none exist
  useEffect(() => {
    if (parameters.length === 0) {
      addParameter();
    }
  }, []);

  const addParameter = () => {
    const newParameter: EvaluationParameter = {
      evaparam_nombre: '',
      evaparam_nota: '',
      evaparam_intentos: 1,
      evatipometo_id: methods.length > 0 ? methods[0].evatipometo_id : 1,
      evaparam_puntaje: undefined
    };
    
    const newParameters = [...parameters, newParameter];
    onParametersChange(newParameters);
  };

  const removeParameter = (index: number) => {
    if (parameters.length > 1) {
      const newParameters = parameters.filter((_, i) => i !== index);
      onParametersChange(newParameters);
      
      // Remove validation state for the removed parameter
      const updatedValidations = { ...parameterValidations };
      delete updatedValidations[index];
      
      // Re-index remaining validations
      const reindexedValidations: { [key: number]: boolean } = {};
      Object.entries(updatedValidations).forEach(([key, value]) => {
        const numKey = parseInt(key);
        if (numKey > index) {
          reindexedValidations[numKey - 1] = value;
        } else {
          reindexedValidations[numKey] = value;
        }
      });
      
      setParameterValidations(reindexedValidations);
    }
  };

  const updateParameter = (index: number, updatedParameter: EvaluationParameter) => {
    const newParameters = parameters.map((param, i) => 
      i === index ? updatedParameter : param
    );
    onParametersChange(newParameters);
  };

  const handleParameterValidationChange = (index: number, isValid: boolean) => {
    setParameterValidations(prev => ({
      ...prev,
      [index]: isValid
    }));
  };

  const isFormValid = () => {
    return parameters.every((param, index) => {
      const isNameValid = param.evaparam_nombre.trim() !== '';
      const isAttemptsValid = param.evaparam_intentos > 0;
      const isPuntajeValid = param.evaparam_puntaje !== undefined && param.evaparam_puntaje !== null && param.evaparam_puntaje > 0;
      
      // Validate scale parameters if method is scale (evatipometo_id === 3)
      let isScaleValid = true;
      if (param.evatipometo_id === 3) {
        const min = param.evaparam_escala_min;
        const max = param.evaparam_escala_max;
        
        // Allow min to be 0, but ensure 0 <= min < max
        if (min !== undefined && max !== undefined) {
          isScaleValid = min >= 0 && min < max;
        } else {
          isScaleValid = false; // Both min and max are required for scale type
        }
      }
      
      // Validate time range for tiempo method (evatipometo_id === 1)
      let isTimeRangeValid = true;
      if (param.evatipometo_id === 1) {
        // Use the validation state from parameterValidations if available, otherwise fallback to manual validation
        if (Object.prototype.hasOwnProperty.call(parameterValidations, index)) {
          isTimeRangeValid = parameterValidations[index];
        } else if (param.timeRange) {
          isTimeRangeValid = param.timeRange.evatieran_tiempo_cero > 0 && 
                            param.timeRange.evatieran_tiempo_full > 0 &&
                            param.timeRange.evatieran_tiempo_cero !== param.timeRange.evatieran_tiempo_full;
        } else {
          isTimeRangeValid = false; // Time range is required for tiempo method
        }
      }
      
      return isNameValid && isAttemptsValid && isScaleValid && isPuntajeValid && isTimeRangeValid;
    });
  };

  const handleSubmit = () => {
    if (isFormValid()) {
      onSubmit(parameters);
    }
  };

  const handlePreview = () => {
    if (isFormValid()) {
      setShowPreviewModal(true);
    }
  };

  // Generate preview data for the modal
  const getPreviewData = () => {
    if (!evaluationDraft) return undefined;
    
    return {
      eva_titulo: evaluationDraft.eva_titulo || "Vista previa de evaluación",
      eva_descripcion: evaluationDraft.eva_descripcion || null,
      eva_categoria: evaluationDraft.eva_categoria || null,
      parameters: parameters.map((param, idx) => ({
        evaparam_id: idx + 1000, // Use a high number to avoid conflicts
        evaparam_nombre: param.evaparam_nombre,
        evaparam_nota: param.evaparam_nota,
        evaparam_intentos: param.evaparam_intentos,
        evatipometo_id: param.evatipometo_id,
        evaparam_escala_min: param.evaparam_escala_min,
        evaparam_escala_max: param.evaparam_escala_max,
        evaparam_puntaje: param.evaparam_puntaje
      }))
    };
  };

  if (loadingMethods) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Cargando métodos de evaluación...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Define los parámetros que se evaluarán. Cada parámetro puede tener un método diferente de calificación.
      </div>

      <div className="space-y-4">
        {parameters.map((parameter, index) => (
          <div key={index} className="relative">
            <ParameterForm
              parameter={parameter}
              methods={methods}
              onChange={(updatedParam) => updateParameter(index, updatedParam)}
              index={index}
              onValidationChange={handleParameterValidationChange}
            />
            {parameters.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeParameter(index)}
                className="absolute top-2 right-2 text-red-600 hover:text-red-800 z-10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-4">
        <Button
          variant="outline"
          onClick={addParameter}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Agregar parámetro
        </Button>

        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-muted-foreground">
            Total de puntos: {totalPoints}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={!isFormValid()}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              Vista previa
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting || !isFormValid()}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar evaluación'}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && (
        <EvaluateStudentModal
          open={showPreviewModal}
          onOpenChange={setShowPreviewModal}
          isPreviewMode={true}
          previewData={getPreviewData()}
        />
      )}
    </div>
  );
};

export default EvaluationParametersStep;
