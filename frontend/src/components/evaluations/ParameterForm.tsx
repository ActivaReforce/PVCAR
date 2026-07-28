
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EvaluationParameter } from './NewEvaluationModal';
import { Check, X } from 'lucide-react';
import TimeRangeConfig, { TimeRangeRule } from './TimeRangeConfig';

interface ParameterFormProps {
  parameter: EvaluationParameter;
  methods: Array<{
    evatipometo_id: number;
    evatipometo_nombre: string;
  }>;
  onChange: (parameter: EvaluationParameter) => void;
  index: number;
  onValidationChange?: (index: number, isValid: boolean) => void;
}

const ParameterForm: React.FC<ParameterFormProps> = ({
  parameter,
  methods,
  onChange,
  index,
  onValidationChange
}) => {
  const [timeRangeValid, setTimeRangeValid] = useState(true);

  const updateField = (field: keyof EvaluationParameter, value: any) => {
    onChange({
      ...parameter,
      [field]: value
    });
  };

  const getMethodName = (id: number) => {
    const method = methods.find(m => m.evatipometo_id === id);
    return method?.evatipometo_nombre || '';
  };

  const handleMethodChange = (newMethodId: string) => {
    const methodId = parseInt(newMethodId);
    let updatedParameter = {
      ...parameter,
      evatipometo_id: methodId
    };

    // Handle Mobak method special logic
    if (methodId === 4) {
      updatedParameter = {
        ...updatedParameter,
        evaparam_intentos: 1,
        evaparam_escala_min: 0,
        evaparam_escala_max: 6,
        evaparam_puntaje: 2,
        timeRange: undefined // Clear time range if switching from tiempo
      };
    } else if (methodId === 5) {
      // New Mobak method with 0-2 scale
      updatedParameter = {
        ...updatedParameter,
        evaparam_intentos: 1,
        evaparam_escala_min: 0,
        evaparam_escala_max: 2,
        evaparam_puntaje: 2,
        timeRange: undefined // Clear time range if switching from tiempo
      };
    } else if (methodId === 1) {
      // Tiempo method - initialize with default time range with empty operators
      updatedParameter = {
        ...updatedParameter,
        timeRange: {
          evatieran_op_cero: '',
          evatieran_tiempo_cero: 60,
          evatieran_op_full: '',
          evatieran_tiempo_full: 30
        }
      };
    } else {
      // Clear method-specific fields for other methods
      if (methodId !== 3) {
        updatedParameter.evaparam_escala_min = undefined;
        updatedParameter.evaparam_escala_max = undefined;
      }
      updatedParameter.timeRange = undefined; // Clear time range for non-tiempo methods
    }
    onChange(updatedParameter);
  };

  const handleTimeRangeChange = (timeRange: TimeRangeRule) => {
    updateField('timeRange', timeRange);
  };

  const handleTimeRangeValidationChange = (isValid: boolean) => {
    setTimeRangeValid(isValid);
    if (onValidationChange) {
      onValidationChange(index, isValid);
    }
  };

  // Validate time range configuration for tiempo method
  const validateTimeRange = () => {
    if (parameter.evatipometo_id !== 1) return true; // Not tiempo method
    
    if (!parameter.timeRange) return false;

    const { evatieran_op_cero, evatieran_tiempo_cero, evatieran_op_full, evatieran_tiempo_full } = parameter.timeRange;

    // Check if operators are selected (not empty strings)
    if (!evatieran_op_cero || !evatieran_op_full) return false;

    // Check if times are equal or not positive
    if (evatieran_tiempo_cero === evatieran_tiempo_full || evatieran_tiempo_cero <= 0 || evatieran_tiempo_full <= 0) {
      return false;
    }

    // Check operator compatibility and time relationship
    if ((evatieran_op_cero === '>' || evatieran_op_cero === '>=') && 
        (evatieran_op_full === '<' || evatieran_op_full === '<=')) {
      return evatieran_tiempo_full > evatieran_tiempo_cero;
    } else if ((evatieran_op_cero === '<' || evatieran_op_cero === '<=') && 
               (evatieran_op_full === '>' || evatieran_op_full === '>=')) {
      return evatieran_tiempo_full < evatieran_tiempo_cero;
    }

    return false; // Invalid operator combination
  };

  const renderMethodSpecificUI = () => {
    const methodId = parameter.evatipometo_id;
    switch (methodId) {
      case 1:
        // Tiempo method
        return (
          <div className="space-y-4">
            {/* Time Range Configuration */}
            <TimeRangeConfig 
              timeRange={parameter.timeRange} 
              onChange={handleTimeRangeChange} 
              parameterScore={parameter.evaparam_puntaje || 0}
              onValidationChange={handleTimeRangeValidationChange}
            />
          </div>
        );
      case 2:
        // Booleano method
        return null;
      case 4: // Original Mobak method (0-6 scale)
      case 5: // New Mobak method (0-2 scale)
        return null;
      default:
        return null;
    }
  };

  // Check if current method is any Mobak method
  const isMobakMethod = parameter.evatipometo_id === 4 || parameter.evatipometo_id === 5;
  const isTiempoMethod = parameter.evatipometo_id === 1;

  // Validation for puntaje field
  const isPuntajeValid = parameter.evaparam_puntaje !== undefined && parameter.evaparam_puntaje !== null && parameter.evaparam_puntaje > 0;

  // Validation for tiempo method - use the timeRangeValid state
  const isTiempoConfigValid = !isTiempoMethod || timeRangeValid;

  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          Parámetro {index + 1}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-0">
        {/* Section 1: Name and Description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Nombre del parámetro *</Label>
            <Input 
              value={parameter.evaparam_nombre} 
              onChange={(e) => updateField('evaparam_nombre', e.target.value)} 
              placeholder="Ej: Velocidad, Precisión, Técnica..." 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Descripción / Nota</Label>
            <Textarea 
              value={parameter.evaparam_nota} 
              onChange={(e) => updateField('evaparam_nota', e.target.value)} 
              placeholder="Instrucciones específicas para este parámetro..." 
              rows={2} 
            />
          </div>
        </div>

        {/* Section 2: Evaluation Method and Dynamic Inputs */}
        <div className="border-t pt-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Método de evaluación</Label>
            <Select value={parameter.evatipometo_id.toString()} onValueChange={handleMethodChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {methods.map((method) => (
                  <SelectItem key={method.evatipometo_id} value={method.evatipometo_id.toString()}>
                    {method.evatipometo_nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {renderMethodSpecificUI()}

          {/* Show scale inputs only when evatipometo_id is 3 (not for Mobak which is 4 or 5) */}
          {parameter.evatipometo_id === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Valor mínimo</Label>
                  <Input 
                    type="number" 
                    value={parameter.evaparam_escala_min ?? ''} 
                    onChange={(e) => {
                      const value = e.target.value;
                      updateField('evaparam_escala_min', value === '' ? undefined : parseInt(value));
                    }} 
                    placeholder="0" 
                    min="0" 
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Valor máximo</Label>
                  <Input 
                    type="number" 
                    value={parameter.evaparam_escala_max ?? ''} 
                    onChange={(e) => {
                      const value = e.target.value;
                      updateField('evaparam_escala_max', value === '' ? undefined : parseInt(value));
                    }} 
                    placeholder="10" 
                    min="1" 
                  />
                </div>
              </div>
              {parameter.evaparam_escala_min !== undefined && parameter.evaparam_escala_max !== undefined && (
                <div className="text-xs text-muted-foreground">
                  {parameter.evaparam_escala_min >= 0 && parameter.evaparam_escala_min < parameter.evaparam_escala_max ? 
                    `✓ Rango válido: ${parameter.evaparam_escala_min} - ${parameter.evaparam_escala_max}` : 
                    `⚠ Rango inválido: el mínimo debe ser ≥ 0 y menor que el máximo`
                  }
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Section 3: Attempts and Score (only show for non-Mobak methods) */}
        {!isMobakMethod && (
          <div className="border-t pt-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Intentos permitidos</Label>
                <Input 
                  type="number" 
                  value={parameter.evaparam_intentos} 
                  onChange={(e) => updateField('evaparam_intentos', parseInt(e.target.value) || 1)} 
                  placeholder="1" 
                  min="1" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Puntaje del parámetro *</Label>
                <Input 
                  type="number" 
                  value={parameter.evaparam_puntaje ?? ''} 
                  onChange={(e) => {
                    const value = e.target.value;
                    updateField('evaparam_puntaje', value === '' ? undefined : parseInt(value));
                  }} 
                  placeholder="Ej: 10" 
                  min="1" 
                  required 
                  className={!isPuntajeValid ? 'border-red-500 focus:border-red-500' : ''} 
                />
                {!isPuntajeValid && (
                  <div className="text-xs text-red-600">
                    El puntaje es obligatorio y debe ser mayor a 0
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Los puntos de este parámetro se dividirán entre la cantidad de intentos.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* For Mobak methods, show the score field separately and read-only */}
        {isMobakMethod && (
          <div className="border-t pt-4 pb-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Puntaje del parámetro</Label>
              <Input 
                type="number" 
                value={parameter.evaparam_puntaje ?? 2} 
                readOnly 
                className="bg-gray-100 dark:bg-gray-700" 
              />
              <div className="text-xs text-muted-foreground">
                Los puntos de este parámetro se dividirán entre la cantidad de intentos.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ParameterForm;
