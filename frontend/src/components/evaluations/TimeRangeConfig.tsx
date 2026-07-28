import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export interface TimeRangeRule {
  evatieran_op_cero: string;
  evatieran_tiempo_cero: number;
  evatieran_op_full: string;
  evatieran_tiempo_full: number;
}

interface TimeRangeConfigProps {
  timeRange?: TimeRangeRule;
  onChange: (timeRange: TimeRangeRule) => void;
  parameterScore: number;
  onValidationChange?: (isValid: boolean) => void;
}

const TimeRangeConfig: React.FC<TimeRangeConfigProps> = ({
  timeRange,
  onChange,
  parameterScore,
  onValidationChange
}) => {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const parseTimeToSeconds = (timeString: string) => {
    const parts = timeString.split(':');
    if (parts.length !== 3) return 0;
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  };

  const updateField = (field: keyof TimeRangeRule, value: any) => {
    const updatedRange = {
      evatieran_op_cero: timeRange?.evatieran_op_cero || '',
      evatieran_tiempo_cero: timeRange?.evatieran_tiempo_cero || 60,
      evatieran_op_full: timeRange?.evatieran_op_full || '',
      evatieran_tiempo_full: timeRange?.evatieran_tiempo_full || 30,
      [field]: value
    };
    onChange(updatedRange);
  };

  const handleTimeChange = (field: 'evatieran_tiempo_cero' | 'evatieran_tiempo_full', timeString: string) => {
    const seconds = parseTimeToSeconds(timeString);
    if (seconds > 0) {
      updateField(field, seconds);
    }
  };

  // Get operator label for display
  const getOperatorLabel = (operator: string) => {
    switch (operator) {
      case '>': return 'Mayor que';
      case '>=': return 'Mayor o igual que';
      case '<': return 'Menor que';
      case '<=': return 'Menor o igual que';
      default: return operator;
    }
  };

  // Get compatible operators for upper threshold based on lower threshold
  const getCompatibleUpperOperators = (lowerOp: string) => {
    if (lowerOp === '>' || lowerOp === '>=') {
      return ['<', '<='];
    } else if (lowerOp === '<' || lowerOp === '<=') {
      return ['>', '>='];
    }
    return ['<', '<=', '>', '>='];
  };

  // Handle lower threshold operator change
  const handleLowerOperatorChange = (value: string) => {
    const compatibleUpperOps = getCompatibleUpperOperators(value);
    const currentUpperOp = timeRange?.evatieran_op_full || '';
    
    // If current upper operator is not compatible, reset it to empty string
    const newUpperOp = compatibleUpperOps.includes(currentUpperOp) ? currentUpperOp : '';
    
    const updatedRange = {
      evatieran_op_cero: value,
      evatieran_tiempo_cero: timeRange?.evatieran_tiempo_cero || 60,
      evatieran_op_full: newUpperOp,
      evatieran_tiempo_full: timeRange?.evatieran_tiempo_full || 30
    };
    onChange(updatedRange);
  };

  // Validate the time relationship based on operators
  const validateTimeRelation = () => {
    if (!timeRange) return { isValid: false, message: 'Configuración incompleta' };

    const { evatieran_op_cero, evatieran_tiempo_cero, evatieran_op_full, evatieran_tiempo_full } = timeRange;

    // Check if operators are selected
    if (!evatieran_op_cero || !evatieran_op_full) {
      return { isValid: false, message: 'Debe seleccionar ambos operadores' };
    }

    // Check if times are equal
    if (evatieran_tiempo_cero === evatieran_tiempo_full) {
      return { isValid: false, message: 'Los tiempos deben ser diferentes entre sí' };
    }

    // Check if times are positive
    if (evatieran_tiempo_cero <= 0 || evatieran_tiempo_full <= 0) {
      return { isValid: false, message: 'Los tiempos deben ser positivos' };
    }

    // Check operator compatibility first
    const compatibleOps = getCompatibleUpperOperators(evatieran_op_cero);
    if (!compatibleOps.includes(evatieran_op_full)) {
      return { isValid: false, message: 'Combinación de operadores no válida' };
    }

    // Fixed validation logic for time relationship based on operators
    if ((evatieran_op_cero === '>' || evatieran_op_cero === '>=') && 
        (evatieran_op_full === '<' || evatieran_op_full === '<=')) {
      // "Más tiempo = menos puntos" scenario
      // Lower threshold (0 points) should have higher time than upper threshold (full points)
      if (evatieran_tiempo_cero <= evatieran_tiempo_full) {
        return { 
          isValid: false, 
          message: 'Para la configuración "más tiempo = menos puntos", el Tiempo 1 debe ser mayor que el Tiempo 2' 
        };
      }
    } else if ((evatieran_op_cero === '<' || evatieran_op_cero === '<=') && 
               (evatieran_op_full === '>' || evatieran_op_full === '>=')) {
      // "Menos tiempo = menos puntos" scenario  
      // Lower threshold (0 points) should have lower time than upper threshold (full points)
      if (evatieran_tiempo_cero >= evatieran_tiempo_full) {
        return { 
          isValid: false, 
          message: 'Para la configuración "menos tiempo = menos puntos", el Tiempo 1 debe ser menor que el Tiempo 2' 
        };
      }
    }

    return { isValid: true, message: 'Configuración válida: Los tiempos entre operadores se interpolarán linealmente' };
  };

  const validation = validateTimeRelation();
  
  // Notify parent component about validation state change
  React.useEffect(() => {
    if (onValidationChange) {
      onValidationChange(validation.isValid);
    }
  }, [validation.isValid, onValidationChange]);

  const lowerOperator = timeRange?.evatieran_op_cero || '';
  const upperOperator = timeRange?.evatieran_op_full || '';
  const compatibleUpperOperators = getCompatibleUpperOperators(lowerOperator);

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Configuración de rango de tiempo</Label>
      
      <div className="p-4 bg-gray-50 rounded-md border space-y-4">
        <div className="text-sm text-gray-700 mb-3">
          Define el rango de tiempo para la puntuación. Los tiempos se interpolan linealmente entre los dos operadores.
        </div>
        
        {/* Min threshold */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-2">
            <Label className="text-xs font-medium dark:text-black">Operador 1 (0 puntos)</Label>
            <Select 
              value={lowerOperator} 
              onValueChange={handleLowerOperatorChange}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Seleccione un operador" />
              </SelectTrigger>
              <SelectContent className="bg-white border shadow-lg z-50 dark:bg-gray-700">
                <SelectItem value=">=">
                  {getOperatorLabel('>=')}
                </SelectItem>
                <SelectItem value=">">
                  {getOperatorLabel('>')}
                </SelectItem>
                <SelectItem value="<=">
                  {getOperatorLabel('<=')}
                </SelectItem>
                <SelectItem value="<">
                  {getOperatorLabel('<')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs font-medium dark:text-black">Tiempo 1 (h:m:s)</Label>
            <Input 
              type="time" 
              step="1" 
              value={timeRange ? formatTime(timeRange.evatieran_tiempo_cero) : "00:01:00"} 
              onChange={(e) => handleTimeChange('evatieran_tiempo_cero', e.target.value)} 
              className="h-8 font-mono" 
            />
          </div>
          
          <div className="text-xs text-gray-600">= 0 puntos</div>
        </div>

        {/* Max threshold */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-2">
            <Label className="text-xs font-medium dark:text-black">Operador 2 (Puntos Máximos)</Label>
            <Select 
              value={upperOperator} 
              onValueChange={(value) => updateField('evatieran_op_full', value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Seleccione un operador" />
              </SelectTrigger>
              <SelectContent className="bg-white border shadow-lg z-50 dark:bg-gray-700">
                <SelectItem 
                  value="<=" 
                  disabled={lowerOperator !== '' && !compatibleUpperOperators.includes('<=')}
                  className={lowerOperator !== '' && !compatibleUpperOperators.includes('<=') ? 'opacity-50 cursor-not-allowed text-gray-400' : ''}
                >
                  {getOperatorLabel('<=')}
                </SelectItem>
                <SelectItem 
                  value="<" 
                  disabled={lowerOperator !== '' && !compatibleUpperOperators.includes('<')}
                  className={lowerOperator !== '' && !compatibleUpperOperators.includes('<') ? 'opacity-50 cursor-not-allowed text-gray-400' : ''}
                >
                  {getOperatorLabel('<')}
                </SelectItem>
                <SelectItem 
                  value=">=" 
                  disabled={lowerOperator !== '' && !compatibleUpperOperators.includes('>=')}
                  className={lowerOperator !== '' && !compatibleUpperOperators.includes('>=') ? 'opacity-50 cursor-not-allowed text-gray-400' : ''}
                >
                  {getOperatorLabel('>=')}
                </SelectItem>
                <SelectItem 
                  value=">" 
                  disabled={lowerOperator !== '' && !compatibleUpperOperators.includes('>')}
                  className={lowerOperator !== '' && !compatibleUpperOperators.includes('>') ? 'opacity-50 cursor-not-allowed text-gray-400' : ''}
                >
                  {getOperatorLabel('>')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs font-medium dark:text-black">Tiempo 2 (h:m:s)</Label>
            <Input 
              type="time" 
              step="1" 
              value={timeRange ? formatTime(timeRange.evatieran_tiempo_full) : "00:00:30"} 
              onChange={(e) => handleTimeChange('evatieran_tiempo_full', e.target.value)} 
              className="h-8 font-mono" 
            />
          </div>
          
          <div className="text-xs text-gray-600">= Puntos Máximos</div>
        </div>

        {/* Validation message */}
        <div className="text-xs">
          {validation.isValid ? (
            <div className="text-green-600">✓ {validation.message}</div>
          ) : (
            <div className="text-red-600">⚠ {validation.message}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeRangeConfig;
