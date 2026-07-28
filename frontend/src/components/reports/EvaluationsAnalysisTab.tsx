import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList, Users, Target } from 'lucide-react';

interface School {
  col_id: number;
  col_nombre: string;
}

interface Discipline {
  colacthor_id: number;
  label: string;
  actividad_nombre: string;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
}

interface Evaluation {
  eva_id: number;
  eva_titulo: string;
}

interface DonutData {
  name: string;
  value: number;
  fill: string;
}

interface GradeData {
  name: string;
  value: number;
  evaluacion_titulo?: string;
  promedio_puntos?: number;
  total_puntos?: number;
  count?: number;
  porcentaje?: number;
}

const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const EvaluationsAnalysisTab = () => {
  const [selectedSchool, setSelectedSchool] = useState<string>('todos');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('todas');
  const [selectedEvaluation, setSelectedEvaluation] = useState<string>('todas');

  // KPI Card A: Evaluaciones Creadas
  const {
    data: evaluationsCreated
  } = useQuery({
    queryKey: ['evaluations-created'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('evaluacion').select('est_id');
      if (error) throw error;
      const active = data?.filter(e => e.est_id === 1).length || 0;
      const inactive = data?.filter(e => e.est_id === 2).length || 0;
      const total = active + inactive;
      return {
        active,
        inactive,
        total
      };
    }
  });

  // KPI Card B: Total Evaluaciones Asignadas
  const {
    data: evaluationsAssigned
  } = useQuery({
    queryKey: ['evaluations-assigned'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('evaluacion_asignacion').select('evaasig_id').eq('est_id', 1);
      if (error) throw error;
      return data?.length || 0;
    }
  });

  // KPI Card C: Estudiantes Evaluados Global
  const {
    data: studentsEvaluated
  } = useQuery({
    queryKey: ['students-evaluated'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('evaluacion_nino_pendiente').select('est_id').in('est_id', [6, 7]);
      if (error) throw error;
      const completed = data?.filter(e => e.est_id === 7).length || 0;
      const pending = data?.filter(e => e.est_id === 6).length || 0;
      const total = completed + pending;
      const percentage = total > 0 ? Math.round(completed / total * 100) : 0;
      return {
        completed,
        pending,
        total,
        percentage
      };
    }
  });

  // Fetch schools
  const {
    data: schools
  } = useQuery({
    queryKey: ['schools-for-evaluations'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('colegio').select('col_id, col_nombre').order('col_nombre');
      if (error) throw error;
      return data as School[];
    }
  });

  // Fetch disciplines for selected school
  const {
    data: disciplines
  } = useQuery({
    queryKey: ['disciplines-for-school', selectedSchool],
    queryFn: async () => {
      if (selectedSchool === 'todos') {
        // Get all disciplines from all schools that have evaluations
        const {
          data,
          error
        } = await supabase.from('evaluacion_asignacion').select(`
            colacthor_id,
            colegio_actividad_horario!inner(
              col_id,
              colacthor_hora_inicio,
              colacthor_hora_fin,
              actividad!inner(act_nombre),
              dia!inner(dia_nombre),
              colegio!inner(col_nombre)
            )
          `).eq('est_id', 1);
        if (error) throw error;
        const uniqueDisciplines = new Map();
        data?.forEach(item => {
          const cah = item.colegio_actividad_horario as any;
          const actividadNombre = cah?.actividad?.act_nombre || '';
          const diaNombre = cah?.dia?.dia_nombre || '';
          const horaInicio = cah?.colacthor_hora_inicio || '';
          const horaFin = cah?.colacthor_hora_fin || '';
          const colegioNombre = cah?.colegio?.col_nombre || '';
          const label = `${actividadNombre} — ${diaNombre.charAt(0).toUpperCase() + diaNombre.slice(1)} (${horaInicio}–${horaFin}) - ${colegioNombre}`;
          if (!uniqueDisciplines.has(item.colacthor_id)) {
            uniqueDisciplines.set(item.colacthor_id, {
              colacthor_id: item.colacthor_id,
              label,
              actividad_nombre: actividadNombre,
              dia_nombre: diaNombre,
              hora_inicio: horaInicio,
              hora_fin: horaFin
            });
          }
        });
        return Array.from(uniqueDisciplines.values()) as Discipline[];
      }
      const {
        data,
        error
      } = await supabase.from('evaluacion_asignacion').select(`
          colacthor_id,
          colegio_actividad_horario!inner(
            col_id,
            colacthor_hora_inicio,
            colacthor_hora_fin,
            actividad!inner(act_nombre),
            dia!inner(dia_nombre)
          )
        `).eq('est_id', 1).eq('colegio_actividad_horario.col_id', parseInt(selectedSchool));
      if (error) throw error;
      const uniqueDisciplines = new Map();
      data?.forEach(item => {
        const cah = item.colegio_actividad_horario as any;
        const actividadNombre = cah?.actividad?.act_nombre || '';
        const diaNombre = cah?.dia?.dia_nombre || '';
        const horaInicio = cah?.colacthor_hora_inicio || '';
        const horaFin = cah?.colacthor_hora_fin || '';
        const label = `${actividadNombre} — ${diaNombre.charAt(0).toUpperCase() + diaNombre.slice(1)} (${horaInicio}–${horaFin})`;
        if (!uniqueDisciplines.has(item.colacthor_id)) {
          uniqueDisciplines.set(item.colacthor_id, {
            colacthor_id: item.colacthor_id,
            label,
            actividad_nombre: actividadNombre,
            dia_nombre: diaNombre,
            hora_inicio: horaInicio,
            hora_fin: horaFin
          });
        }
      });
      return Array.from(uniqueDisciplines.values()) as Discipline[];
    },
    enabled: true
  });

  // Fetch evaluations for selected discipline
  const {
    data: evaluations
  } = useQuery({
    queryKey: ['evaluations-for-discipline', selectedDiscipline, selectedSchool],
    queryFn: async () => {
      if (selectedDiscipline === 'todas') {
        if (selectedSchool === 'todos') {
          // Get all evaluations from all schools
          const {
            data,
            error
          } = await supabase.from('evaluacion_asignacion').select(`
              eva_id,
              evaluacion!inner(eva_titulo)
            `).eq('est_id', 1);
          if (error) throw error;
          const uniqueEvaluations = new Map();
          data?.forEach(item => {
            const evaluation = item.evaluacion as any;
            if (!uniqueEvaluations.has(item.eva_id)) {
              uniqueEvaluations.set(item.eva_id, {
                eva_id: item.eva_id,
                eva_titulo: evaluation?.eva_titulo || ''
              });
            }
          });
          return Array.from(uniqueEvaluations.values()) as Evaluation[];
        } else {
          // Get all evaluations for selected school
          const {
            data,
            error
          } = await supabase.from('evaluacion_asignacion').select(`
              eva_id,
              evaluacion!inner(eva_titulo),
              colegio_actividad_horario!inner(col_id)
            `).eq('est_id', 1).eq('colegio_actividad_horario.col_id', parseInt(selectedSchool));
          if (error) throw error;
          const uniqueEvaluations = new Map();
          data?.forEach(item => {
            const evaluation = item.evaluacion as any;
            if (!uniqueEvaluations.has(item.eva_id)) {
              uniqueEvaluations.set(item.eva_id, {
                eva_id: item.eva_id,
                eva_titulo: evaluation?.eva_titulo || ''
              });
            }
          });
          return Array.from(uniqueEvaluations.values()) as Evaluation[];
        }
      }
      const {
        data,
        error
      } = await supabase.from('evaluacion_asignacion').select(`
          eva_id,
          evaluacion!inner(eva_titulo)
        `).eq('est_id', 1).eq('colacthor_id', parseInt(selectedDiscipline));
      if (error) throw error;
      const uniqueEvaluations = new Map();
      data?.forEach(item => {
        const evaluation = item.evaluacion as any;
        if (!uniqueEvaluations.has(item.eva_id)) {
          uniqueEvaluations.set(item.eva_id, {
            eva_id: item.eva_id,
            eva_titulo: evaluation?.eva_titulo || ''
          });
        }
      });
      return Array.from(uniqueEvaluations.values()) as Evaluation[];
    },
    enabled: true
  });

  // Fetch donut chart data
  const {
    data: donutData
  } = useQuery({
    queryKey: ['donut-data', selectedSchool, selectedDiscipline, selectedEvaluation],
    queryFn: async () => {
      let query = supabase.from('evaluacion_nino_pendiente').select(`
          est_id,
          ninoasig_id,
          eva_id,
          nino_asignacion!inner(
            colacthor_id,
            colegio_actividad_horario!inner(col_id)
          )
        `).in('est_id', [6, 7]);

      // Apply filters based on selections
      if (selectedEvaluation !== 'todas') {
        query = query.eq('eva_id', parseInt(selectedEvaluation));
      }
      if (selectedDiscipline !== 'todas') {
        query = query.eq('nino_asignacion.colacthor_id', parseInt(selectedDiscipline));
      }
      if (selectedSchool !== 'todos') {
        query = query.eq('nino_asignacion.colegio_actividad_horario.col_id', parseInt(selectedSchool));
      }
      const {
        data,
        error
      } = await query;
      if (error) throw error;
      const completed = data?.filter(item => item.est_id === 7).length || 0;
      const pending = data?.filter(item => item.est_id === 6).length || 0;
      const chartData: DonutData[] = [];
      if (completed > 0) {
        chartData.push({
          name: 'Completadas',
          value: completed,
          fill: COLORS[0]
        });
      }
      if (pending > 0) {
        chartData.push({
          name: 'Pendientes',
          value: pending,
          fill: COLORS[1]
        });
      }
      return chartData;
    },
    enabled: true
  });

  // Fetch grades chart data
  const {
    data: gradesData
  } = useQuery({
    queryKey: ['grades-data', selectedSchool, selectedDiscipline, selectedEvaluation],
    queryFn: async () => {
      // Start with completed evaluations (est_id = 7)
      let query = supabase.from('evaluacion_nino_pendiente').select(`
          evaninopen_id,
          eva_id,
          ninoasig_id,
          nino_asignacion!inner(
            nino_id,
            colacthor_id,
            colegio_actividad_horario!inner(col_id),
            nino!inner(nino_nombre)
          )
        `).eq('est_id', 7);

      // Apply filters based on selections
      if (selectedEvaluation !== 'todas') {
        query = query.eq('eva_id', parseInt(selectedEvaluation));
      }
      if (selectedDiscipline !== 'todas') {
        query = query.eq('nino_asignacion.colacthor_id', parseInt(selectedDiscipline));
      }
      if (selectedSchool !== 'todos') {
        query = query.eq('nino_asignacion.colegio_actividad_horario.col_id', parseInt(selectedSchool));
      }

      const { data: completedEvals, error: completedError } = await query;
      if (completedError) throw completedError;

      if (!completedEvals?.length) return [];

      // Get evaluation details for totals
      const evalIds = [...new Set(completedEvals.map(e => e.eva_id))];
      const { data: evaluationDetails, error: evalError } = await supabase
        .from('evaluacion')
        .select('eva_id, eva_titulo, eva_puntaje_total')
        .in('eva_id', evalIds);
      
      if (evalError) throw evalError;

      const evalMap = new Map(evaluationDetails?.map(e => [e.eva_id, e]) || []);

      // Get all attempts for these evaluations
      const evaninOpenIds = completedEvals.map(e => e.evaninopen_id);
      const { data: attempts, error: attemptsError } = await supabase
        .from('evaluacion_intento')
        .select('evaninopen_id, evaint_puntaje_obtenido')
        .in('evaninopen_id', evaninOpenIds);
      
      if (attemptsError) throw attemptsError;

      // Group attempts by evaninopen_id and sum scores
      const scoresByStudent = new Map<number, number>();
      attempts?.forEach(attempt => {
        const current = scoresByStudent.get(attempt.evaninopen_id) || 0;
        scoresByStudent.set(attempt.evaninopen_id, current + (attempt.evaint_puntaje_obtenido || 0));
      });

      if (selectedEvaluation !== 'todas') {
        // Student mode: show individual students for the selected evaluation
        const studentData: GradeData[] = [];
        const selectedEvalId = parseInt(selectedEvaluation);
        const evalDetail = evalMap.get(selectedEvalId);
        
        if (!evalDetail) return [];

        completedEvals
          .filter(e => e.eva_id === selectedEvalId)
          .forEach(evalRecord => {
            const studentScore = scoresByStudent.get(evalRecord.evaninopen_id) || 0;
            const nino = (evalRecord.nino_asignacion as any)?.nino;
            const percentage = evalDetail.eva_puntaje_total ? (studentScore / evalDetail.eva_puntaje_total) * 100 : 0;
            
            studentData.push({
              name: nino?.nino_nombre || 'Alumno',
              value: studentScore,
              evaluacion_titulo: evalDetail.eva_titulo,
              total_puntos: evalDetail.eva_puntaje_total,
              porcentaje: percentage
            });
          });

        return studentData.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        // Default mode: show averages by evaluation
        const evalAverages = new Map<number, { total: number, count: number, evalDetail: any }>();

        completedEvals.forEach(evalRecord => {
          const studentScore = scoresByStudent.get(evalRecord.evaninopen_id) || 0;
          const evalDetail = evalMap.get(evalRecord.eva_id);
          
          if (!evalDetail || !evalDetail.eva_puntaje_total) return;

          const percentage = (studentScore / evalDetail.eva_puntaje_total) * 100;
          
          if (!evalAverages.has(evalRecord.eva_id)) {
            evalAverages.set(evalRecord.eva_id, { total: 0, count: 0, evalDetail });
          }
          
          const current = evalAverages.get(evalRecord.eva_id)!;
          current.total += percentage;
          current.count += 1;
        });

        const chartData: GradeData[] = [];
        evalAverages.forEach(({ total, count, evalDetail }, evaId) => {
          const averagePercentage = count > 0 ? total / count : 0;
          const averagePoints = evalDetail.eva_puntaje_total ? (averagePercentage / 100) * evalDetail.eva_puntaje_total : 0;
          
          chartData.push({
            name: evalDetail.eva_titulo,
            value: Number(averagePercentage.toFixed(1)),
            promedio_puntos: Number(averagePoints.toFixed(1)),
            total_puntos: evalDetail.eva_puntaje_total,
            count: count
          });
        });

        return chartData.sort((a, b) => a.name.localeCompare(b.name));
      }
    },
    enabled: true
  });

  const handleSchoolChange = (value: string) => {
    setSelectedSchool(value);
    setSelectedDiscipline('todas');
    setSelectedEvaluation('todas');
  };

  const handleDisciplineChange = (value: string) => {
    setSelectedDiscipline(value);
    setSelectedEvaluation('todas');
  };

  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    value,
    name
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    const chartDataItem = donutData?.find(item => item.name === name);
    const count = chartDataItem?.value || 0;
    const total = donutData?.reduce((sum, entry) => sum + entry.value, 0) || 0;
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
    
    return (
      <text 
        x={x} 
        y={y} 
        fill="currentColor" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        className="text-muted-foreground"
      >
        {`${name} ${percentage}% — ${count} registros`}
      </text>
    );
  };

  const total = donutData?.reduce((sum, entry) => sum + entry.value, 0) || 0;
  const isStudentMode = selectedEvaluation !== 'todas';

  const renderGradesTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      if (isStudentMode) {
        return (
          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
            <p className="font-medium">{`Alumno: ${label}`}</p>
            <p className="text-sm">{`Puntos: ${data.value} / ${data.total_puntos}`}</p>
            <p className="text-sm">{`Porcentaje: ${data.porcentaje?.toFixed(1)}%`}</p>
          </div>
        );
      } else {
        return (
          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
            <p className="font-medium">{`Evaluación: ${label}`}</p>
            <p className="text-sm">{`Promedio: ${data.value}%`}</p>
            <p className="text-sm">{`Promedio puntos: ${data.promedio_puntos} / ${data.total_puntos}`}</p>
            <p className="text-sm">{`n: ${data.count}`}</p>
          </div>
        );
      }
    }
    return null;
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="w-full max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              Evaluaciones Creadas
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{evaluationsCreated?.total || 0}</div>
            <p className="text-xs text-muted-foreground break-words">
              Activas: {evaluationsCreated?.active || 0} | Inactivas: {evaluationsCreated?.inactive || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="w-full max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              Total Evaluaciones Asignadas
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{evaluationsAssigned || 0}</div>
            <p className="text-xs text-muted-foreground break-words">
              Asignaciones activas
            </p>
          </CardContent>
        </Card>

        <Card className="w-full max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              Alumnos Evaluados Global
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{studentsEvaluated?.percentage || 0}%</div>
            <p className="text-xs text-muted-foreground break-words">
              Completadas: {studentsEvaluated?.completed || 0} / Pendientes: {studentsEvaluated?.pending || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Donut Chart */}
      <Card className="w-full max-w-full">
        <CardHeader>
          <CardTitle className="mb-5 whitespace-nowrap overflow-hidden text-ellipsis">Progreso de las Evaluaciones (Pendientes vs Completas)</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-4">
            <Select value={selectedSchool} onValueChange={handleSchoolChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {schools?.map((school) => (
                  <SelectItem key={school.col_id} value={school.col_id.toString()}>
                    {school.col_nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedDiscipline} onValueChange={handleDisciplineChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {disciplines?.map((discipline) => (
                  <SelectItem key={discipline.colacthor_id} value={discipline.colacthor_id.toString()}>
                    {discipline.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedEvaluation} onValueChange={setSelectedEvaluation}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {evaluations?.map((evaluation) => (
                  <SelectItem key={evaluation.eva_id} value={evaluation.eva_id.toString()}>
                    {evaluation.eva_titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="w-full max-w-full overflow-x-hidden">
          <div className="flex justify-center items-center w-full max-w-[650px] mx-auto">
            {donutData && donutData.length > 0 ? (
              <div className="h-[300px] w-full max-w-full">
              <ChartContainer
                config={{
                  completadas: {
                    label: "Completadas",
                    color: COLORS[0],
                  },
                  pendientes: {
                    label: "Pendientes",
                    color: COLORS[1],
                  },
                }}
                className="h-full w-full max-w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={renderCustomLabel}
                      outerRadius={120}
                      innerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground break-words">
                  Total de alumnos asignados a una evaluación: {total}
                </p>
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay datos de evaluaciones para los filtros seleccionados
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grades Bar Chart */}
      <Card className="w-full max-w-full">
        <CardHeader>
          <CardTitle className="whitespace-nowrap overflow-hidden text-ellipsis">Calificaciones por Colegio por Disciplina por Evaluación</CardTitle>
        </CardHeader>
        <CardContent className="w-full max-w-full overflow-x-hidden">
          <div className="flex justify-center items-center w-full max-w-[650px] mx-auto">
            {gradesData && gradesData.length > 0 ? (
              <div className="h-[300px] w-full max-w-full">
              <ChartContainer
                config={{
                  value: {
                    label: isStudentMode ? "Puntos" : "Promedio %",
                    color: COLORS[0],
                  },
                }}
                className="h-full w-full max-w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradesData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={12}
                    />
                    <YAxis 
                      domain={isStudentMode ? [0, 'dataMax'] : [0, 100]}
                      tickFormatter={(value) => isStudentMode ? `${value}` : `${value}%`}
                    />
                    <ChartTooltip content={renderGradesTooltip} />
                    <Bar dataKey="value" fill={COLORS[0]} />
                  </BarChart>
                </ResponsiveContainer>
                </ChartContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay datos de calificaciones para los filtros seleccionados
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EvaluationsAnalysisTab;
