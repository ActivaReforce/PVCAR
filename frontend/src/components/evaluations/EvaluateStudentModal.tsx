import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { EvaluateStudentHeader } from './EvaluateStudentHeader';
import { calculateMobakPoints } from './mobakUtils';
import { calculateTimeBasedScore, parseTimeToSeconds, TimeRangeRule } from './timeScoring';
import { MobileTimeInput } from './MobileTimeInput';

interface StudentEvaluation {
  nino_nombre: string;
  evaninopen_id: number;
  est_id: number;
}

interface EvaluationParameter {
  evaparam_id: number;
  evaparam_nombre: string;
  evaparam_nota: string | null;
  evatipometo_id: number;
  evaparam_escala_min: number | null;
  evaparam_escala_max: number | null;
  evaparam_intentos: number;
  evaparam_puntaje: number | null;
}

interface AttemptValue {
  evaparam_id: number;
  attempt: number;
  timeValue?: string;
  logroValue?: boolean;
  escalaValue?: number;
  mobakValue?: number;
}

interface ExistingAttempt {
  evaint_id: number;
  evaparam_id: number;
  evaint_intento: number;
  evaint_tiempo: number | null;
  evaint_logro: boolean | null;
  evaint_num: number | null;
  evaint_mobak: number | null;
}

// Preview mode interfaces
interface PreviewEvaluationData {
  eva_id?: number;
  eva_titulo: string;
  eva_descripcion: string | null;
  eva_categoria: string | null;
  parameters: EvaluationParameter[];
}

interface EvaluateStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: StudentEvaluation;
  evaluationId?: number;
  evaluationTitle?: string;
  disciplineName?: string;
  onEvaluationComplete?: () => void;
  isModifying?: boolean;
  // Preview mode props
  isPreviewMode?: boolean;
  previewData?: PreviewEvaluationData;
}

interface EvaluationData {
  eva_id: number;
  eva_titulo: string;
  eva_descripcion: string | null;
  eva_categoria: string | null;
  eva_puntaje_total: number | null;
}

const EvaluateStudentModal: React.FC<EvaluateStudentModalProps> = ({
  open,
  onOpenChange,
  student,
  evaluationId,
  evaluationTitle,
  disciplineName,
  onEvaluationComplete,
  isModifying = false,
  // Preview mode props
  isPreviewMode = false,
  previewData
}) => {
  const [parameters, setParameters] = useState<EvaluationParameter[]>([]);
  const [attemptValues, setAttemptValues] = useState<AttemptValue[]>([]);
  const [existingAttempts, setExistingAttempts] = useState<ExistingAttempt[]>([]);
  const [evaluationData, setEvaluationData] = useState<EvaluationData | null>(null);
  const [timeRanges, setTimeRanges] = useState<Record<number, TimeRangeRule>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [openCollapsibles, setOpenCollapsibles] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      if (isPreviewMode && previewData) {
        // Preview mode: use provided data
        setParameters(previewData.parameters);
        initializePreviewState(previewData.parameters);
      } else if (evaluationId) {
        // Normal mode: fetch evaluation data
        loadEvaluationData();
        getCurrentUser();
      }
    }
  }, [open, evaluationId, isPreviewMode, previewData]);

  const getCurrentUser = async () => {
    try {
      if (!user) {
        console.error('No user found in AuthContext');
        toast({
          title: "Error de autenticación",
          description: "No se pudo obtener la información del usuario actual.",
          variant: "destructive",
        });
        return;
      }
      
      setCurrentUserId(user.usu_id);
    } catch (error) {
      console.error('Unexpected error getting current user:', error);
      toast({
        title: "Error",
        description: "Error inesperado al obtener usuario actual.",
        variant: "destructive",
      });
    }
  };

  const loadEvaluationData = async () => {
    try {
      setLoading(true);

      // First, fetch evaluation details including eva_puntaje_total
      const { data: evaluation, error: evalError } = await supabase
        .from('evaluacion')
        .select('eva_id, eva_titulo, eva_descripcion, eva_categoria, eva_puntaje_total')
        .eq('eva_id', evaluationId)
        .single();

      if (evalError) {
        console.error('Error loading evaluation:', evalError);
        toast({
          title: "Error",
          description: "No se pudo cargar la evaluación.",
          variant: "destructive",
        });
        return;
      }

      setEvaluationData(evaluation);

      // Then fetch parameters
      const { data, error } = await supabase
        .from('evaluacion_parametro')
        .select('*')
        .eq('eva_id', evaluationId)
        .order('evaparam_id');

      if (error) {
        console.error('Error loading evaluation parameters:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los parámetros de evaluación.",
          variant: "destructive",
        });
        return;
      }

      setParameters(data || []);

      // Load time ranges for time-based parameters
      await loadTimeRanges(data || []);
      
      // Initialize attempt values for all parameters and attempts
      const initialValues: AttemptValue[] = [];
      (data || []).forEach(param => {
        const attempts = param.evaparam_intentos || 1;
        for (let i = 1; i <= attempts; i++) {
          initialValues.push({
            evaparam_id: param.evaparam_id,
            attempt: i
          });
        }
      });

      // If modifying, load ALL existing attempts
      if (isModifying) {
        await loadAllExistingAttempts(initialValues, data || []);
      } else {
        setAttemptValues(initialValues);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTimeRanges = async (parametersData: EvaluationParameter[]) => {
    const timeParams = parametersData.filter(param => param.evatipometo_id === 1);
    if (timeParams.length === 0) return;

    const paramIds = timeParams.map(param => param.evaparam_id);
    
    try {
      const { data: ranges, error } = await supabase
        .from('evaluacion_tiempo_rangos')
        .select('*')
        .in('evaparam_id', paramIds);

      if (error) {
        console.error('Error loading time ranges:', error);
        return;
      }

      const rangesMap: Record<number, TimeRangeRule> = {};
      (ranges || []).forEach(range => {
        rangesMap[range.evaparam_id] = {
          evatieran_op_cero: range.evatieran_op_cero,
          evatieran_tiempo_cero: range.evatieran_tiempo_cero,
          evatieran_op_full: range.evatieran_op_full,
          evatieran_tiempo_full: range.evatieran_tiempo_full
        };
      });

      setTimeRanges(rangesMap);
    } catch (error) {
      console.error('Error loading time ranges:', error);
    }
  };

  const initializePreviewState = (parameters: EvaluationParameter[]) => {
    const initialValues: AttemptValue[] = [];
    parameters.forEach(param => {
      const attempts = param.evaparam_intentos || 1;
      for (let i = 1; i <= attempts; i++) {
        initialValues.push({
          evaparam_id: param.evaparam_id,
          attempt: i
        });
      }
    });
    setAttemptValues(initialValues);
    
    // Open all collapsibles in preview mode for better visibility
    if (isPreviewMode) {
      const parameterIds = new Set(parameters.map(p => p.evaparam_id));
      setOpenCollapsibles(parameterIds);
    }
  };

  const loadAllExistingAttempts = async (initialValues: AttemptValue[], parametersData: EvaluationParameter[]) => {
    try {
      // Fetch ALL attempts for this evaluation
      const { data: allAttempts, error } = await supabase
        .from('evaluacion_intento')
        .select('*')
        .eq('evaninopen_id', student?.evaninopen_id)
        .order('evaparam_id, evaint_intento');

      if (error) {
        console.error('Error loading existing attempts:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los intentos existentes.",
          variant: "destructive",
        });
        setAttemptValues(initialValues);
        return;
      }

      setExistingAttempts(allAttempts || []);

      // Initialize all collapsibles as open when modifying
      const parameterIds = new Set(parametersData.map(p => p.evaparam_id));
      setOpenCollapsibles(parameterIds);

      // Map ALL existing attempts to initial values
      const updatedValues = initialValues.map(initialValue => {
        const existingAttempt = (allAttempts || []).find(
          attempt => attempt.evaparam_id === initialValue.evaparam_id && 
                    attempt.evaint_intento === initialValue.attempt
        );

        if (existingAttempt) {
          const parameter = parametersData.find(p => p.evaparam_id === initialValue.evaparam_id);
          const updatedValue = { ...initialValue };

          // Convert based on parameter type
          if (parameter?.evatipometo_id === 1 && existingAttempt.evaint_tiempo) {
            // Convert seconds back to HH:MM:SS format
            const totalSeconds = existingAttempt.evaint_tiempo;
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            updatedValue.timeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
          } else if (parameter?.evatipometo_id === 2 && existingAttempt.evaint_logro !== null) {
            updatedValue.logroValue = existingAttempt.evaint_logro;
          } else if (parameter?.evatipometo_id === 3 && existingAttempt.evaint_num !== null) {
            updatedValue.escalaValue = existingAttempt.evaint_num;
          } else if ((parameter?.evatipometo_id === 4 || parameter?.evatipometo_id === 5) && existingAttempt.evaint_mobak !== null) {
            updatedValue.mobakValue = existingAttempt.evaint_mobak;
          }

          return updatedValue;
        }

        return initialValue;
      });

      setAttemptValues(updatedValues);
    } catch (error) {
      console.error('Error loading all existing attempts:', error);
      setAttemptValues(initialValues);
    }
  };

  const updateAttemptValue = (paramId: number, attempt: number, field: string, value: any) => {
    setAttemptValues(prev => prev.map(av => 
      av.evaparam_id === paramId && av.attempt === attempt 
        ? { ...av, [field]: value }
        : av
    ));
  };

  const getAttemptValue = (paramId: number, attempt: number) => {
    return attemptValues.find(av => av.evaparam_id === paramId && av.attempt === attempt);
  };

  const getExistingAttempt = (paramId: number, attempt: number) => {
    return existingAttempts.find(ea => ea.evaparam_id === paramId && ea.evaint_intento === attempt);
  };

  const toggleCollapsible = (paramId: number) => {
    setOpenCollapsibles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paramId)) {
        newSet.delete(paramId);
      } else {
        newSet.add(paramId);
      }
      return newSet;
    });
  };

  const isFormValid = () => {
    // In preview mode, form validation is not required
    if (isPreviewMode) return true;
    
    for (const param of parameters) {
      const attempts = param.evaparam_intentos || 1;
      for (let i = 1; i <= attempts; i++) {
        const attemptValue = getAttemptValue(param.evaparam_id, i);
        if (!attemptValue) return false;
        
        // Check if there's a value for this attempt based on parameter type
        const hasValue = attemptValue.timeValue || 
                        attemptValue.logroValue !== undefined || 
                        attemptValue.escalaValue !== undefined ||
                        attemptValue.mobakValue !== undefined;
        
        if (!hasValue) return false;
      }
    }
    return true;
  };

  const getMissingAttempts = () => {
    const missing: string[] = [];
    for (const param of parameters) {
      const attempts = param.evaparam_intentos || 1;
      for (let i = 1; i <= attempts; i++) {
        const attemptValue = getAttemptValue(param.evaparam_id, i);
        if (!attemptValue) continue;
        
        const hasValue = attemptValue.timeValue || 
                        attemptValue.logroValue !== undefined || 
                        attemptValue.escalaValue !== undefined ||
                        attemptValue.mobakValue !== undefined;
        
        if (!hasValue) {
          missing.push(`${param.evaparam_nombre} - Intento ${i}`);
        }
      }
    }
    return missing;
  };

  const getScalePointsForAttempt = (param: EvaluationParameter, attempt: number) => {
    const attemptValue = getAttemptValue(param.evaparam_id, attempt);
    if (param.evatipometo_id === 3 && attemptValue?.escalaValue !== undefined) {
      // Handle NULL evaparam_escala_min by defaulting to 0
      const min = param.evaparam_escala_min ?? 0;
      const max = param.evaparam_escala_max ?? 10;
      const totalParamPoints = param.evaparam_puntaje || 0;
      const attempts = param.evaparam_intentos || 1;
      const pointsPerAttempt = totalParamPoints / attempts;
      
      // Safety check for invalid range
      if (max <= min) {
        return 0;
      }
      
      // Calculate points using linear interpolation
      const range = max - min;
      const stepValue = pointsPerAttempt / range;
      const pointsObtained = (attemptValue.escalaValue - min) * stepValue;
      
      // Clamp to bounds and return
      const finalPoints = Math.max(0, Math.min(pointsPerAttempt, pointsObtained));
      return finalPoints;
    }
    return 0;
  };

  const getMobakPointsForAttempt = (param: EvaluationParameter, attempt: number) => {
    const attemptValue = getAttemptValue(param.evaparam_id, attempt);
    
    if (attemptValue?.mobakValue !== undefined) {
      const points = calculateMobakPoints(param.evatipometo_id, attemptValue.mobakValue);
      return points;
    }
    return 0;
  };

  const getLogroPointsForAttempt = (param: EvaluationParameter, attempt: number) => {
    const attemptValue = getAttemptValue(param.evaparam_id, attempt);
    if (param.evatipometo_id === 2 && attemptValue?.logroValue !== undefined) {
      if (!attemptValue.logroValue) return 0;
      
      const totalParamPoints = param.evaparam_puntaje || 0;
      const attempts = param.evaparam_intentos || 1;
      
      if (attempts === 1) {
        return totalParamPoints;
      } else {
        return Math.round((totalParamPoints / attempts) * 10) / 10; // Round to 1 decimal
      }
    }
    return 0;
  };

  const getTimePointsForAttempt = (param: EvaluationParameter, attempt: number) => {
    if (param.evatipometo_id !== 1) return 0;
    
    const attemptValue = getAttemptValue(param.evaparam_id, attempt);
    const timeRange = timeRanges[param.evaparam_id];
    
    if (!attemptValue?.timeValue || !timeRange) return 0;
    
    const timeInSeconds = parseTimeToSeconds(attemptValue.timeValue);
    if (timeInSeconds <= 0) return 0;
    
    const totalParamPoints = param.evaparam_puntaje || 0;
    const attempts = param.evaparam_intentos || 1;
    const maxPointsPerAttempt = totalParamPoints / attempts;
    
    return calculateTimeBasedScore(timeInSeconds, timeRange, maxPointsPerAttempt);
  };

  const renderMobakScoringHint = (param: EvaluationParameter, attempt?: number) => {
    if (param.evatipometo_id === 4) {
      return (
        <div className="absolute top-2 right-2 pointer-events-none">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-2 text-xs text-blue-700 leading-tight">
            <div className="font-medium mb-1">Puntuación:</div>
            <div>0–2 = 0 pts</div>
            <div>3–4 = 1 pt</div>
            <div>5–6 = 2 pts</div>
          </div>
        </div>
      );
    } else if (param.evatipometo_id === 5) {
      return (
        <div className="absolute top-2 right-2 pointer-events-none">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-2 text-xs text-blue-700 leading-tight">
            <div className="font-medium mb-1">Puntuación:</div>
            <div>0 = 0 pts</div>
            <div>1 = 1 pt</div>
            <div>2 = 2 pts</div>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderTimeScoringHint = (param: EvaluationParameter) => {
    if (param.evatipometo_id !== 1) return null;
    
    const timeRange = timeRanges[param.evaparam_id];
    if (!timeRange) return null;

    const getOperatorText = (operator: string): string => {
      switch (operator) {
        case '>':
          return 'mayor que';
        case '>=':
          return 'mayor o igual que';
        case '<':
          return 'menor que';
        case '<=':
          return 'menor o igual que';
        default:
          return operator;
      }
    };

    // Formateador: 125 -> "2 minutos 5 segundos"
    const formatSeconds = (total: number) => {
      const m = Math.floor(total / 60);
      const s = total % 60;
    
      if (s === 0) {
        return `${m} ${m === 1 ? 'minuto' : 'minutos'}`;
      }
      if (m === 0) {
        return `${s} ${s === 1 ? 'segundo' : 'segundos'}`;
      }
      return `${m} ${m === 1 ? 'minuto' : 'minutos'} ${s} ${s === 1 ? 'segundo' : 'segundos'}`;
    };


    const opCeroText = getOperatorText(timeRange.evatieran_op_cero);
    const opFullText = getOperatorText(timeRange.evatieran_op_full);

    return (
      <div className="text-xs text-muted-foreground mt-2 mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
        <div className="font-medium mb-1">Puntuación:</div>
        <div>Si el tiempo es {opCeroText} {formatSeconds(timeRange.evatieran_tiempo_cero)} → 0 pts</div>
        <div>Si el tiempo es {opFullText} {formatSeconds(timeRange.evatieran_tiempo_full)} → máx. pts</div>
      </div>
    );
  };

  const renderParameterAttemptInput = (param: EvaluationParameter, attempt: number) => {
    const attemptValue = getAttemptValue(param.evaparam_id, attempt);

    switch (param.evatipometo_id) {
      case 1: // Time - Use new MobileTimeInput
        return (
          <MobileTimeInput
            value={attemptValue?.timeValue || ''}
            onChange={(value) => updateAttemptValue(param.evaparam_id, attempt, 'timeValue', value)}
            className="inline-block"
          />
        );

      case 2: // Completion (Boolean)
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={attemptValue?.logroValue || false}
              onCheckedChange={(checked) => updateAttemptValue(param.evaparam_id, attempt, 'logroValue', checked)}
            />
            <Label>{attemptValue?.logroValue ? 'Completado' : 'Incompleto'}</Label>
          </div>
        );

      case 3: { // Scale (Number) - Using radio buttons with proper min/max handling
        const min = param.evaparam_escala_min ?? 0; // Handle NULL by defaulting to 0
        const max = param.evaparam_escala_max ?? 10; // Handle NULL by defaulting to 10
        const options = [];
        for (let i = min; i <= max; i++) {
          options.push(i);
        }

        return (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Selecciona una puntuación ({min} - {max}):
            </div>
            <RadioGroup
              value={attemptValue?.escalaValue?.toString() || ''}
              onValueChange={(value) => updateAttemptValue(param.evaparam_id, attempt, 'escalaValue', Number(value))}
              className="flex flex-wrap gap-4"
            >
              {options.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.toString()} id={`${param.evaparam_id}-${attempt}-${option}`} />
                  <Label htmlFor={`${param.evaparam_id}-${attempt}-${option}`} className="text-sm">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      }

      case 4: // Mobak (0-6 scale)
        return (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Selecciona puntuación Mobak (0-6):
            </div>
            <RadioGroup
              value={attemptValue?.mobakValue?.toString() || ''}
              onValueChange={(value) => updateAttemptValue(param.evaparam_id, attempt, 'mobakValue', Number(value))}
              className="flex flex-wrap gap-4"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.toString()} id={`${param.evaparam_id}-${attempt}-mobak-${option}`} />
                  <Label htmlFor={`${param.evaparam_id}-${attempt}-mobak-${option}`} className="text-sm font-medium">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 5: // Mobak (0-2 scale)
        return (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Selecciona puntuación Mobak (0-2):
            </div>
            <RadioGroup
              value={attemptValue?.mobakValue?.toString() || ''}
              onValueChange={(value) => updateAttemptValue(param.evaparam_id, attempt, 'mobakValue', Number(value))}
              className="flex flex-wrap gap-4"
            >
              {[0, 1, 2].map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.toString()} id={`${param.evaparam_id}-${attempt}-mobak-${option}`} />
                  <Label htmlFor={`${param.evaparam_id}-${attempt}-mobak-${option}`} className="text-sm font-medium">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      default:
        return <Input disabled placeholder="Tipo de parámetro no soportado" />;
    }
  };

  const getParameterDisplayTitle = (param: EvaluationParameter, attempt: number) => {
    const isMobakMethod = param.evatipometo_id === 4 || param.evatipometo_id === 5;
    
    if (isMobakMethod) {
      // For Mobak methods, don't show "— Intento" label
      return param.evaparam_nombre;
    } else {
      // For other methods, show attempt number
      return `${param.evaparam_nombre} — Intento ${attempt}`;
    }
  };

  const renderParameterAttempts = (param: EvaluationParameter) => {
    const attempts = param.evaparam_intentos || 1;
    const isMobakMethod = param.evatipometo_id === 4 || param.evatipometo_id === 5;
    const isLogroMethod = param.evatipometo_id === 2;
    const isTimeMethod = param.evatipometo_id === 1;
    const isScaleMethod = param.evatipometo_id === 3;
    const totalPoints = param.evaparam_puntaje || 0;
    const perAttemptPoints = Math.round((totalPoints / attempts) * 10) / 10; // Round to 1 decimal

    // Use accordion for parameters with multiple attempts
    if (attempts > 1) {
      // Calculate aggregate points for accordion header
      let aggregatePoints = 0;
      if (isMobakMethod) {
        for (let i = 1; i <= attempts; i++) {
          const attemptPoints = getMobakPointsForAttempt(param, i);
          aggregatePoints += attemptPoints;
        }
      } else if (isLogroMethod) {
        for (let i = 1; i <= attempts; i++) {
          aggregatePoints += getLogroPointsForAttempt(param, i);
        }
      } else if (isTimeMethod) {
        for (let i = 1; i <= attempts; i++) {
          aggregatePoints += getTimePointsForAttempt(param, i);
        }
      } else if (isScaleMethod) {
        for (let i = 1; i <= attempts; i++) {
          aggregatePoints += getScalePointsForAttempt(param, i);
        }
      }
      
      return (
        <Accordion key={param.evaparam_id} type="single" collapsible className="w-full">
          <AccordionItem value={`param-${param.evaparam_id}`}>
            <AccordionTrigger className="text-left relative">
              <div className="flex flex-col items-start flex-1">
                <div className="flex justify-between items-center w-full pr-6">
                  <Label className="text-base font-medium">{param.evaparam_nombre}</Label>
                  {(isMobakMethod || isLogroMethod || isTimeMethod || isScaleMethod) ? (
                    <span className="text-sm text-muted-foreground font-medium">
                      [{(Math.round(aggregatePoints * 100) / 100).toFixed(2)}] /{totalPoints} pts
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground font-medium">
                      [ ] /{totalPoints} pts
                    </span>
                  )}
                </div>
                {param.evaparam_nota && (
                  <p className="text-sm text-muted-foreground">{param.evaparam_nota}</p>
                )}
                {/* Time scoring hint for multi-attempt parameters */}
                {renderTimeScoringHint(param)}
              </div>
              {/* Mobak scoring hint for accordion header - positioned on left to avoid overlap */}
              {isMobakMethod && renderMobakScoringHint(param)}
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              {Array.from({ length: attempts }, (_, i) => i + 1).map(attempt => {
                const attemptValue = getAttemptValue(param.evaparam_id, attempt);
                const hasValue = attemptValue?.timeValue || 
                                attemptValue?.logroValue !== undefined || 
                                attemptValue?.escalaValue !== undefined ||
                                attemptValue?.mobakValue !== undefined;
                const isMissing = !hasValue && !isPreviewMode;

                // Calculate points for this specific attempt
                let attemptPoints = 0;
                if (isMobakMethod) {
                  attemptPoints = getMobakPointsForAttempt(param, attempt);
                } else if (isLogroMethod) {
                  attemptPoints = getLogroPointsForAttempt(param, attempt);
                } else if (isTimeMethod) {
                  attemptPoints = getTimePointsForAttempt(param, attempt);
                } else if (isScaleMethod) {
                  attemptPoints = getScalePointsForAttempt(param, attempt);
                }

                return (
                  <div key={`${param.evaparam_id}-${attempt}`} className={`space-y-2 p-4 border rounded-lg relative ${isMissing ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <div className={`flex justify-between items-center ${isMobakMethod ? 'pr-40' : 'pr-4'}`}>
                      <Label className="text-base font-medium">
                        Intento {attempt}
                      </Label>
                      {(isMobakMethod || isLogroMethod || isTimeMethod || isScaleMethod) ? (
                        <span className="text-sm text-muted-foreground font-medium">
                          [{(Math.round(attemptPoints * 100) / 100).toFixed(2)}] /{perAttemptPoints} pts
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground font-medium">
                          [ ] /{perAttemptPoints} pts
                        </span>
                      )}
                    </div>
                    {/* Mobak scoring hint positioned on left with more margin */}
                    {isMobakMethod && renderMobakScoringHint(param, attempt)}
                    {renderParameterAttemptInput(param, attempt)}
                    {isMissing && (
                      <p className="text-sm text-red-600">Este campo es obligatorio</p>
                    )}
                  </div>
                );
              })}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      );
    } else {
      // Render normal layout for single attempts
      const attemptValue = getAttemptValue(param.evaparam_id, 1);
      const hasValue = attemptValue?.timeValue || 
                      attemptValue?.logroValue !== undefined || 
                      attemptValue?.escalaValue !== undefined ||
                      attemptValue?.mobakValue !== undefined;
      const isMissing = !hasValue && !isPreviewMode;

      // Calculate points for single attempt
      let paramPointsObtained = 0;
      if (isMobakMethod) {
        paramPointsObtained = getMobakPointsForAttempt(param, 1);
      } else if (isLogroMethod) {
        paramPointsObtained = getLogroPointsForAttempt(param, 1);
      } else if (isTimeMethod) {
        paramPointsObtained = getTimePointsForAttempt(param, 1);
      } else if (isScaleMethod) {
        paramPointsObtained = getScalePointsForAttempt(param, 1);
      }

      return (
        <div key={`${param.evaparam_id}-1`} className={`space-y-2 p-4 border rounded-lg relative ${isMissing ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
          <div className={`flex justify-between items-center ${isMobakMethod ? 'pr-28' : 'pr-4'}`}>
            <Label className="text-base font-medium">
              {getParameterDisplayTitle(param, 1)}
            </Label>
            {(isMobakMethod || isLogroMethod || isTimeMethod || isScaleMethod) ? (
              <span className="text-sm text-muted-foreground font-medium">
                [{(Math.round(paramPointsObtained * 100) / 100).toFixed(2)}] /{totalPoints} pts
              </span>
            ) : (
              <span className="text-sm text-muted-foreground font-medium">
                [ ] /{totalPoints} pts
              </span>
            )}
          </div>
          {param.evaparam_nota && (
            <p className="text-sm text-muted-foreground">
              {param.evaparam_nota}
            </p>
          )}
          {/* Time scoring hint for single-attempt parameters */}
          {renderTimeScoringHint(param)}
          {/* Mobak scoring hint for single parameter blocks - positioned on left with margin */}
          {isMobakMethod && renderMobakScoringHint(param, 1)}
          {renderParameterAttemptInput(param, 1)}
          {isMissing && (
            <p className="text-sm text-red-600">Este campo es obligatorio</p>
          )}
        </div>
      );
    }
  };

  const getModalTitle = () => {
    if (isPreviewMode) {
      return 'Vista Previa de Evaluación';
    }
    return isModifying ? 'Modificar Evaluación' : 'Evaluar Alumno';
  };

  const getModalSubtitle = () => {
    if (isPreviewMode && previewData) {
      return (
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>Evaluación:</strong> {previewData.eva_titulo}</p>
          {previewData.eva_descripcion && (
            <p><strong>Descripción:</strong> {previewData.eva_descripcion}</p>
          )}
          {previewData.eva_categoria && (
            <p><strong>Categoría:</strong> {previewData.eva_categoria}</p>
          )}
        </div>
      );
    }
    
    return null;
  };

  // Prepare data for EvaluateStudentHeader
  const getStudentData = () => {
    if (!student || isPreviewMode) return null;
    return {
      nino_id: 0, // We don't have this in StudentEvaluation interface
      nino_nombre: student.nino_nombre,
      nino_foto: undefined
    };
  };

  const getEvaluationDataForHeader = () => {
    if (isPreviewMode && previewData) {
      return {
        eva_id: previewData.eva_id || 0,
        eva_titulo: previewData.eva_titulo,
        eva_puntaje_total: undefined
      };
    }
    
    if (evaluationData) {
      return {
        eva_id: evaluationData.eva_id,
        eva_titulo: evaluationData.eva_titulo,
        eva_puntaje_total: evaluationData.eva_puntaje_total
      };
    }

    // Fallback for when we only have props
    return {
      eva_id: evaluationId || 0,
      eva_titulo: evaluationTitle || '',
      eva_puntaje_total: undefined
    };
  };

  const getDisciplineData = () => {
    return {
      act_nombre: disciplineName || ''
    };
  };

  const handleSave = async () => {
    if (!isFormValid()) {
      const missing = getMissingAttempts();
      toast({
        title: "Campos incompletos",
        description: `Faltan por completar: ${missing.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    // Validate currentUserId before proceeding
    if (!currentUserId) {
      console.error('Current user ID is null');
      toast({
        title: "Error de autenticación",
        description: "No se pudo identificar al usuario actual. Por favor, inicie sesión nuevamente.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Save each attempt value
      for (const attemptValue of attemptValues) {
        const param = parameters.find(p => p.evaparam_id === attemptValue.evaparam_id);
        if (!param) continue;

        // Check if there's a value to save for this attempt
        const hasValue = attemptValue.timeValue || 
                        attemptValue.logroValue !== undefined || 
                        attemptValue.escalaValue !== undefined ||
                        attemptValue.mobakValue !== undefined;

        if (!hasValue) continue;

        // Convert time to seconds if needed
        let timeInSeconds = null;
        if (attemptValue.timeValue && param.evatipometo_id === 1) {
          const [hours, minutes, seconds] = attemptValue.timeValue.split(':').map(Number);
          timeInSeconds = (hours * 3600) + (minutes * 60) + (seconds || 0);
        }

        // Calculate points for different method types
        let puntajeObtenido = null;
        
        // Mobak methods
        if ((param.evatipometo_id === 4 || param.evatipometo_id === 5) && attemptValue.mobakValue !== undefined) {
          puntajeObtenido = calculateMobakPoints(param.evatipometo_id, attemptValue.mobakValue);
        }

        // Logro methods
        if (param.evatipometo_id === 2 && attemptValue.logroValue !== undefined) {
          puntajeObtenido = getLogroPointsForAttempt(param, attemptValue.attempt);
        }

        // Time methods
        if (param.evatipometo_id === 1 && attemptValue.timeValue) {
          puntajeObtenido = getTimePointsForAttempt(param, attemptValue.attempt);
        }

        // Scale methods - FIXED calculation and persistence
        if (param.evatipometo_id === 3 && attemptValue.escalaValue !== undefined) {
          puntajeObtenido = getScalePointsForAttempt(param, attemptValue.attempt);
        }

        if (isModifying) {
          // Find the existing attempt to update by primary key
          const existingAttempt = getExistingAttempt(attemptValue.evaparam_id, attemptValue.attempt);

          if (existingAttempt) {
            // Update existing attempt using the primary key evaint_id
            const updateData: any = {
              evaint_tiempo: timeInSeconds,
              evaint_logro: attemptValue.logroValue ?? null,
              evaint_num: attemptValue.escalaValue ?? null,
              evaint_mobak: attemptValue.mobakValue ?? null
            };
            
            // Add calculated points for ALL methods that compute them
            if (puntajeObtenido !== null) {
              updateData.evaint_puntaje_obtenido = puntajeObtenido;
            }

            const { error: updateError } = await supabase
              .from('evaluacion_intento')
              .update(updateData)
              .eq('evaint_id', existingAttempt.evaint_id);

            if (updateError) {
              console.error('Error updating attempt:', updateError);
              throw updateError;
            }
          }
        } else {
          // Insert new attempt
          const insertData: any = {
            evaninopen_id: student?.evaninopen_id,
            evaparam_id: attemptValue.evaparam_id,
            evaint_intento: attemptValue.attempt,
            evaint_tiempo: timeInSeconds,
            evaint_logro: attemptValue.logroValue ?? null,
            evaint_num: attemptValue.escalaValue ?? null,
            evaint_mobak: attemptValue.mobakValue ?? null
          };

          // Add calculated points for ALL methods that compute them
          if (puntajeObtenido !== null) {
            insertData.evaint_puntaje_obtenido = puntajeObtenido;
          }

          const { error: insertError } = await supabase
            .from('evaluacion_intento')
            .insert(insertData);

          if (insertError) {
            console.error('Error saving attempt:', insertError);
            throw insertError;
          }
        }
      }

      // Update the student's status to "evaluated" (est_id = 7) and set evaluator and completion date
      const updateData: any = {
        est_id: 7,
        usu_id_registrador: currentUserId,
        evaninopen_fecha_finalizacion: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('evaluacion_nino_pendiente')
        .update(updateData)
        .eq('evaninopen_id', student?.evaninopen_id);

      if (updateError) {
        console.error('Error updating student status:', updateError);
        throw updateError;
      }

      toast({
        title: "Éxito",
        description: isModifying ? "Evaluación modificada exitosamente." : "Evaluación guardada exitosamente.",
      });

      if (onEvaluationComplete) {
        onEvaluationComplete();
      }
    } catch (error: any) {
      console.error('Error saving evaluation:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la evaluación.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {getModalTitle()}
          </DialogTitle>
          {getModalSubtitle()}
        </DialogHeader>

        <div className="space-y-6">
          {/* Render EvaluateStudentHeader for non-preview mode */}
          {!isPreviewMode && getStudentData() && (
            <EvaluateStudentHeader
              student={getStudentData()!}
              evaluation={getEvaluationDataForHeader()}
              discipline={getDisciplineData()}
            />
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Cargando parámetros...</span>
            </div>
          ) : (
            <>
              {parameters.map((param) => (
                <div key={param.evaparam_id} className="space-y-4">
                  {renderParameterAttempts(param)}
                </div>
              ))}

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  Cerrar
                </Button>
                {!isPreviewMode && (
                  <Button
                    onClick={handleSave}
                    disabled={saving || !isFormValid()}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {isModifying ? 'Modificando...' : 'Guardando...'}
                      </>
                    ) : (
                      isModifying ? 'Modificar Evaluación' : 'Guardar Evaluación'
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EvaluateStudentModal;
