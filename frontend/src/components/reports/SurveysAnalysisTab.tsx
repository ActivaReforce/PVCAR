import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList, CheckCircle, XCircle } from 'lucide-react';
import SurveyResponsesSection from './SurveyResponsesSection';

interface Survey {
  encu_id: number;
  encu_titulo: string;
}

interface DonutData {
  name: string;
  value: number;
  fill: string;
}

const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const SurveysAnalysisTab = () => {
  const [selectedSurvey, setSelectedSurvey] = useState<string>('placeholder');

  // KPI Card A: Total Surveys
  const { data: totalSurveys = 0 } = useQuery({
    queryKey: ['surveys-total-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('encuesta')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    }
  });

  // KPI Card B: Published Surveys
  const { data: publishedSurveys = 0 } = useQuery({
    queryKey: ['surveys-published-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('encuesta')
        .select('*', { count: 'exact', head: true })
        .eq('est_id', 5);
      if (error) throw error;
      return count || 0;
    }
  });

  // KPI Card C: Finished Surveys
  const { data: finishedSurveys = 0 } = useQuery({
    queryKey: ['surveys-finished-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('encuesta')
        .select('*', { count: 'exact', head: true })
        .eq('est_id', 4);
      if (error) throw error;
      return count || 0;
    }
  });

  // Fetch published surveys for dropdown
  const { data: publishedSurveysList = [] } = useQuery({
    queryKey: ['published-surveys-list'],
    queryFn: async (): Promise<Survey[]> => {
      const { data, error } = await supabase
        .from('encuesta')
        .select('encu_id, encu_titulo')
        .eq('est_id', 5)
        .order('encu_titulo');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch donut chart data for selected survey
  const { data: donutData } = useQuery({
    queryKey: ['survey-donut-data', selectedSurvey],
    queryFn: async () => {
      if (selectedSurvey === 'placeholder') return [];

      const surveyId = parseInt(selectedSurvey);

      // Get total expected population (active parents)
      const { count: totalParents, error: parentError } = await supabase
        .from('padre')
        .select(`
          usu_id,
          usuario!inner(est_id)
        `, { count: 'exact', head: true })
        .eq('usuario.est_id', 1);

      if (parentError) throw parentError;
      const expectedTotal = totalParents || 0;

      // Get answered count for this survey
      const { count: answeredCount, error: answeredError } = await supabase
        .from('encuesta_respondida')
        .select('*', { count: 'exact', head: true })
        .eq('encu_id', surveyId);

      if (answeredError) throw answeredError;
      const answered = answeredCount || 0;
      const pending = Math.max(0, expectedTotal - answered);

      const chartData: DonutData[] = [];
      if (answered > 0) {
        chartData.push({
          name: 'Respondidas',
          value: answered,
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
    enabled: selectedSurvey !== 'placeholder'
  });

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
  const selectedSurveyData = publishedSurveysList.find(s => s.encu_id.toString() === selectedSurvey);

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="w-full max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              Total de Encuestas
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSurveys}</div>
            <p className="text-xs text-muted-foreground break-words">
              Encuestas creadas en el sistema
            </p>
          </CardContent>
        </Card>

        <Card className="w-full max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              Encuestas Publicadas
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedSurveys}</div>
            <p className="text-xs text-muted-foreground break-words">
              Disponibles para responder
            </p>
          </CardContent>
        </Card>

        <Card className="w-full max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              Encuestas Finalizadas
            </CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{finishedSurveys}</div>
            <p className="text-xs text-muted-foreground break-words">
              Cerradas completamente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Donut Chart */}
      <Card className="w-full max-w-full">
        <CardHeader>
          <CardTitle className="mb-5 whitespace-nowrap overflow-hidden text-ellipsis">Progreso de Respuestas de Encuestas (Respondidas vs Pendientes)</CardTitle>
          <div className="flex flex-wrap gap-4">
            <Select value={selectedSurvey} onValueChange={setSelectedSurvey}>
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue placeholder="Seleccionar encuesta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder">Seleccionar encuesta</SelectItem>
                {publishedSurveysList.map((survey) => (
                  <SelectItem key={survey.encu_id} value={survey.encu_id.toString()}>
                    {survey.encu_titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="w-full max-w-full overflow-x-hidden">
          {selectedSurvey === 'placeholder' ? (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              Selecciona una encuesta para ver el análisis de respuestas
            </div>
          ) : publishedSurveysList.length === 0 ? (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              No hay encuestas publicadas disponibles
            </div>
          ) : donutData && donutData.length > 0 ? (
            <div className="h-[400px] w-full max-w-full">
              <ChartContainer
                config={{
                  respondidas: {
                    label: "Respondidas",
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
                  Total de padres activos en el sistema: {total}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              No hay datos de respuestas para la encuesta seleccionada
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Survey Responses Section */}
      <SurveyResponsesSection 
        selectedSurvey={selectedSurvey}
        surveyName={selectedSurveyData?.encu_titulo || ''}
      />
    </div>
  );
};

export default SurveysAnalysisTab;
