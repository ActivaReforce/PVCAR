
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Timer, RotateCcw, Save } from 'lucide-react';

interface EvaluationParameter {
  evaparam_id: number;
  evaparam_nombre: string;
  evaparam_nota: string | null;
  evaparam_intentos: number;
  evatipometo_id: number;
  evaparam_escala_min: number | null;
  evaparam_escala_max: number | null;
  metodo_nombre?: string;
}

interface EvaluationParameterPreviewProps {
  parameter: EvaluationParameter;
  index: number;
  state: any;
  onStateChange: (newState: any) => void;
}

const EvaluationParameterPreview: React.FC<EvaluationParameterPreviewProps> = ({
  parameter,
  index,
  state,
  onStateChange
}) => {
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [timer, setTimer] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const getParameterDisplayTitle = () => {
    const isMobakMethod = parameter.evatipometo_id === 4 || parameter.evatipometo_id === 5;
    
    if (isMobakMethod) {
      // For Mobak methods, don't show "— Intento" label
      return `${index}. ${parameter.evaparam_nombre}`;
    } else {
      // For other methods, show attempt number if there are multiple attempts
      if (parameter.evaparam_intentos > 1) {
        return `${index}. ${parameter.evaparam_nombre} — Intento ${currentAttempt}`;
      } else {
        return `${index}. ${parameter.evaparam_nombre} — Intento 1`;
      }
    }
  };

  const renderMobakScoringHint = () => {
    if (parameter.evatipometo_id === 4) {
      return (
        <div className="absolute top-4 right-4 bg-blue-50 border border-blue-200 rounded-md p-2 text-xs text-blue-700 leading-tight">
          <div className="font-medium mb-1">Puntuación:</div>
          <div>0–2 = 0 pts</div>
          <div>3–4 = 1 pt</div>
          <div>5–6 = 2 pts</div>
        </div>
      );
    } else if (parameter.evatipometo_id === 5) {
      return (
        <div className="absolute top-4 right-4 bg-blue-50 border border-blue-200 rounded-md p-2 text-xs text-blue-700 leading-tight">
          <div className="font-medium mb-1">Puntuación:</div>
          <div>0 = 0 pts</div>
          <div>1 = 1 pt</div>
          <div>2 = 2 pts</div>
        </div>
      );
    }
    return null;
  };

  const renderTimeScoringHint = () => {
    // Only show for time-based parameters (evatipometo_id === 1)
    if (parameter.evatipometo_id !== 1) return null;

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700 leading-relaxed mb-4">
        <div className="font-medium mb-2">ℹ️ Información de puntuación por tiempo:</div>
        <div>
          La puntuación se calcula automáticamente basándose en los rangos de tiempo configurados para este parámetro. 
          Los tiempos se interpolan linealmente entre los umbrales mínimo y máximo para determinar la puntuación final.
        </div>
      </div>
    );
  };

  const renderMethodSpecificInput = () => {
    const methodName = parameter.metodo_nombre?.toLowerCase();
    
    // Handle Mobak methods by ID since they might have the same name
    const isMobakMethod = parameter.evatipometo_id === 4 || parameter.evatipometo_id === 5;
    
    if (isMobakMethod) {
      // Determine scale based on method ID
      const scaleMax = parameter.evatipometo_id === 5 ? 2 : 6;
      const options = Array.from({ length: scaleMax + 1 }, (_, i) => i);
      
      return (
        <div className="space-y-3">
          <Label>Calificación Mobak (escala 0 - {scaleMax})</Label>
          <RadioGroup
            value={state.mobakValue || ''}
            onValueChange={(value) => onStateChange({ mobakValue: value })}
            className="flex flex-wrap gap-3"
          >
            {options.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option.toString()} id={`${parameter.evaparam_id}-mobak-${option}`} />
                <label htmlFor={`${parameter.evaparam_id}-mobak-${option}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {option}
                </label>
              </div>
            ))}
          </RadioGroup>
        </div>
      );
    }
    
    switch (methodName) {
      case 'numérico':
        return (
          <div className="space-y-3">
            <Label>Valor numérico</Label>
            <Input
              type="number"
              placeholder="Ingrese el valor"
              value={state.numericValue || ''}
              onChange={(e) => onStateChange({ numericValue: e.target.value })}
              className="w-full"
            />
          </div>
        );

      case 'booleano':
        return (
          <div className="space-y-3">
            <Label>Resultado</Label>
            <RadioGroup
              value={state.booleanValue || ''}
              onValueChange={(value) => onStateChange({ booleanValue: value })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id={`${parameter.evaparam_id}-true`} />
                <label htmlFor={`${parameter.evaparam_id}-true`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  ✓ Completado
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id={`${parameter.evaparam_id}-false`} />
                <label htmlFor={`${parameter.evaparam_id}-false`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  ✗ Incompleto
                </label>
              </div>
            </RadioGroup>
          </div>
        );

      case 'tiempo':
        return (
          <div className="space-y-3">
            <Label>Cronómetro</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-2 justify-center">
                <div className="text-2xl font-mono bg-gray-100 px-3 py-2 rounded">
                  {String(timer.hours).padStart(2, '0')}
                </div>
                <span className="text-xl">:</span>
                <div className="text-2xl font-mono bg-gray-100 px-3 py-2 rounded">
                  {String(timer.minutes).padStart(2, '0')}
                </div>
                <span className="text-xl">:</span>
                <div className="text-2xl font-mono bg-gray-100 px-3 py-2 rounded">
                  {String(timer.seconds).padStart(2, '0')}
                </div>
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  variant={isTimerRunning ? "destructive" : "default"}
                  size="sm"
                  onClick={() => {
                    setIsTimerRunning(!isTimerRunning);
                    onStateChange({ timerRunning: !isTimerRunning });
                  }}
                >
                  <Timer className="h-4 w-4 mr-2" />
                  {isTimerRunning ? 'Detener' : 'Iniciar'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTimer({ hours: 0, minutes: 0, seconds: 0 });
                    setIsTimerRunning(false);
                    onStateChange({ timer: { hours: 0, minutes: 0, seconds: 0 }, timerRunning: false });
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reiniciar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStateChange({ timerSaved: true })}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        );

      case 'escala':
        if (parameter.evaparam_escala_min !== null && parameter.evaparam_escala_max !== null) {
          const options = [];
          for (let i = parameter.evaparam_escala_min; i <= parameter.evaparam_escala_max; i++) {
            options.push(i);
          }
          
          return (
            <div className="space-y-3">
              <Label>Calificación (escala {parameter.evaparam_escala_min} - {parameter.evaparam_escala_max})</Label>
              <RadioGroup
                value={state.scaleValue || ''}
                onValueChange={(value) => onStateChange({ scaleValue: value })}
                className="flex flex-wrap gap-3"
              >
                {options.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.toString()} id={`${parameter.evaparam_id}-${option}`} />
                    <label htmlFor={`${parameter.evaparam_id}-${option}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {option}
                    </label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          );
        }
        return null;

      default:
        return (
          <div className="space-y-3">
            <Label>Tipo de parámetro no soportado</Label>
            <div className="text-sm text-muted-foreground">
              Método: {parameter.metodo_nombre || 'Desconocido'} (ID: {parameter.evatipometo_id})
            </div>
          </div>
        );
    }
  };

  return (
    <Card className="w-full relative">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {getParameterDisplayTitle()}
          </CardTitle>
          <Badge variant="outline">{parameter.metodo_nombre || 'Desconocido'}</Badge>
        </div>
        {parameter.evaparam_nota && (
          <p className="text-sm text-muted-foreground mt-2">{parameter.evaparam_nota}</p>
        )}
      </CardHeader>
      
      {/* Mobak scoring hint box */}
      {renderMobakScoringHint()}
      
      <CardContent className="space-y-4">
        {/* Time-based scoring hint */}
        {renderTimeScoringHint()}

        {/* Attempt selector */}
        {parameter.evaparam_intentos > 1 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Intento</Label>
            <div className="flex gap-2">
              {Array.from({ length: parameter.evaparam_intentos }, (_, i) => i + 1).map(attempt => (
                <Button
                  key={attempt}
                  variant={currentAttempt === attempt ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setCurrentAttempt(attempt);
                    onStateChange({ currentAttempt: attempt });
                  }}
                >
                  {attempt}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Method-specific input */}
        {renderMethodSpecificInput()}

        {/* Notes section */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Observaciones (opcional)</Label>
          <Input
            placeholder="Notas adicionales..."
            value={state.notes || ''}
            onChange={(e) => onStateChange({ notes: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default EvaluationParameterPreview;
