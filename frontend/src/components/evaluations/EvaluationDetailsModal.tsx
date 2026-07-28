
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EvaluationParameter {
  evaparam_id: number;
  evaparam_nombre: string;
  evaparam_nota: string | null;
  evaparam_puntaje: number | null;
  evaparam_intentos: number;
  evatipometo_id: number;
  evaparam_escala_min: number | null;
  evaparam_escala_max: number | null;
  metodo_nombre?: string;
}

interface LinkedDiscipline {
  colacthor_id: number;
  colegio_nombre: string;
  actividad_nombre: string;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
}

interface EvaluationDetails {
  eva_id: number;
  eva_titulo: string;
  eva_descripcion: string | null;
  eva_categoria: string | null;
  eva_puntaje_total?: number | null;
  est_id: number;
  parameters: EvaluationParameter[];
}

interface EvaluationDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluation: EvaluationDetails | null;
}

const EvaluationDetailsModal: React.FC<EvaluationDetailsModalProps> = ({
  open,
  onOpenChange,
  evaluation
}) => {
  const [linkedDisciplines, setLinkedDisciplines] = useState<LinkedDiscipline[]>([]);
  const [parameters, setParameters] = useState<EvaluationParameter[]>([]);
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [loadingDisciplines, setLoadingDisciplines] = useState(false);
  const [loadingParameters, setLoadingParameters] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && evaluation) {
      loadLinkedDisciplines();
      loadParameters();
      loadTotalScore();
    }
  }, [open, evaluation]);

  const loadTotalScore = async () => {
    if (!evaluation) return;
    
    try {
      const { data, error } = await supabase
        .from('evaluacion')
        .select('eva_puntaje_total')
        .eq('eva_id', evaluation.eva_id)
        .single();

      if (error) throw error;

      setTotalScore(data?.eva_puntaje_total || 0);
    } catch (error) {
      console.error('Error loading total score:', error);
      setTotalScore(0);
    }
  };

  const loadLinkedDisciplines = async () => {
    if (!evaluation) return;
    
    try {
      setLoadingDisciplines(true);
      
      const { data, error } = await supabase
        .from('evaluacion_asignacion')
        .select(`
          colacthor_id,
          colegio_actividad_horario!inner (
            colacthor_id,
            colacthor_hora_inicio,
            colacthor_hora_fin,
            colegio!inner (
              col_nombre
            ),
            actividad!inner (
              act_nombre
            ),
            dia!inner (
              dia_nombre
            )
          )
        `)
        .eq('eva_id', evaluation.eva_id)
        .eq('est_id', 1);

      if (error) throw error;

      const disciplines = data?.map(item => ({
        colacthor_id: item.colacthor_id,
        colegio_nombre: item.colegio_actividad_horario?.colegio?.col_nombre || '',
        actividad_nombre: item.colegio_actividad_horario?.actividad?.act_nombre || '',
        dia_nombre: item.colegio_actividad_horario?.dia?.dia_nombre || '',
        hora_inicio: item.colegio_actividad_horario?.colacthor_hora_inicio || '',
        hora_fin: item.colegio_actividad_horario?.colacthor_hora_fin || ''
      })) || [];

      setLinkedDisciplines(disciplines);
    } catch (error) {
      console.error('Error loading linked disciplines:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las disciplinas asignadas.",
        variant: "destructive",
      });
    } finally {
      setLoadingDisciplines(false);
    }
  };

  const loadParameters = async () => {
    if (!evaluation) return;
    
    try {
      setLoadingParameters(true);
      
      const { data, error } = await supabase
        .from('evaluacion_parametro')
        .select('evaparam_id, evaparam_nombre, evaparam_nota, evaparam_puntaje, evaparam_intentos, evatipometo_id, evaparam_escala_min, evaparam_escala_max')
        .eq('eva_id', evaluation.eva_id)
        .order('evaparam_id');

      if (error) throw error;

      // Transform the data to match our interface
      const transformedData: EvaluationParameter[] = (data || []).map(param => ({
        evaparam_id: param.evaparam_id,
        evaparam_nombre: param.evaparam_nombre,
        evaparam_nota: param.evaparam_nota,
        evaparam_puntaje: param.evaparam_puntaje,
        evaparam_intentos: param.evaparam_intentos,
        evatipometo_id: param.evatipometo_id,
        evaparam_escala_min: param.evaparam_escala_min,
        evaparam_escala_max: param.evaparam_escala_max
      }));

      setParameters(transformedData);
    } catch (error) {
      console.error('Error loading parameters:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los parámetros de evaluación.",
        variant: "destructive",
      });
    } finally {
      setLoadingParameters(false);
    }
  };

  if (!evaluation) return null;

  const getStatusBadge = (estId: number) => {
    switch (estId) {
      case 1:
        return <Badge variant="default">Activo</Badge>;
      case 2:
        return <Badge variant="secondary">Inactivo</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const getMethodDetails = (parameter: EvaluationParameter) => {
    switch (parameter.evatipometo_id) {
      case 1: // Tiempo
        return "Tiempo";
      case 2: // Booleano (Completo/Incompleto)
        return "Completo / Incompleto";
      case 3: // Escala
        return `Escala (${parameter.evaparam_escala_min} - ${parameter.evaparam_escala_max})`;
      case 4: // Mobak (0-6 scale)
        return "Mobak (6 intentos)";
      case 5: // Mobak (0-2 scale)
        return "Mobak (2 intentos)";
      default:
        return parameter.metodo_nombre || 'Desconocido';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalles de la evaluación</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Top Section: Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Información General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <span className="font-medium text-sm text-muted-foreground">Título:</span>
                  <p className="text-sm font-medium">{evaluation.eva_titulo}</p>
                </div>
                <div>
                  <span className="font-medium text-sm text-muted-foreground">Categoría:</span>
                  <p className="text-sm">{evaluation.eva_categoria || 'Sin categoría'}</p>
                </div>
                <div>
                  <span className="font-medium text-sm text-muted-foreground">Estado:</span>
                  <div className="mt-1">{getStatusBadge(evaluation.est_id)}</div>
                </div>
                <div>
                  <span className="font-medium text-sm text-muted-foreground">Puntaje Total de la Evaluación:</span>
                  <div className="mt-1">
                    <Badge variant="outline" className="font-semibold">
                      {totalScore !== null ? totalScore : '0'} pts
                    </Badge>
                  </div>
                </div>
              </div>
              {evaluation.eva_descripcion && (
                <div>
                  <span className="font-medium text-sm text-muted-foreground">Descripción:</span>
                  <p className="text-sm mt-1">{evaluation.eva_descripcion}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disciplinas Asignadas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Disciplinas Asignadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-40 overflow-y-auto">
                {loadingDisciplines ? (
                  <div className="text-sm text-muted-foreground">Cargando disciplinas...</div>
                ) : linkedDisciplines.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No hay disciplinas asignadas</div>
                ) : (
                  <div className="space-y-2">
                    {linkedDisciplines.map((discipline) => (
                      <div 
                        key={discipline.colacthor_id} 
                        className="p-2 border rounded-md bg-muted/20"
                      >
                        <div className="font-medium text-sm">{discipline.actividad_nombre}</div>
                        <div className="text-xs text-muted-foreground">
                          {discipline.colegio_nombre} • {discipline.dia_nombre} {discipline.hora_inicio}-{discipline.hora_fin}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Parameters Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Parámetros de Evaluación</h3>
            {loadingParameters ? (
              <p className="text-muted-foreground text-center py-8">
                Cargando parámetros...
              </p>
            ) : parameters.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No hay parámetros definidos para esta evaluación
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {parameters.map((parameter) => (
                  <Card key={parameter.evaparam_id} className="bg-muted/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">{parameter.evaparam_nombre}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Método:</span> {getMethodDetails(parameter)}
                      </div>
                      {parameter.evaparam_nota && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Nota:</span> {parameter.evaparam_nota}
                        </div>
                      )}
                      <div className="flex justify-between text-xs text-muted-foreground">
                        {parameter.evaparam_puntaje && (
                          <span><span className="font-medium">Puntaje:</span> {parameter.evaparam_puntaje}</span>
                        )}
                        <span><span className="font-medium">Intentos:</span> {parameter.evaparam_intentos}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EvaluationDetailsModal;
