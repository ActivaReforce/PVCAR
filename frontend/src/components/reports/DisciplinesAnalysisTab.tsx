
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Activity, School, Users, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#0000ff'];

const DisciplinesAnalysisTab = () => {
  const [selectedSchool, setSelectedSchool] = useState('todos');

  // Orden correcto de días
  const daysOrder = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo'
  ];
  
  // Fetch KPI data
  const { data: kpiData } = useQuery({
    queryKey: ['disciplines-kpis'],
    queryFn: async () => {
      // Total disciplines
      const { count: totalDisciplines } = await supabase
        .from('colegio_actividad_horario')
        .select('*', { count: 'exact', head: true })
        .eq('est_id', 1);

      // School with most disciplines
      const { data: schoolData } = await supabase
        .from('colegio_actividad_horario')
        .select(`
          col_id,
          colegio!inner(col_nombre)
        `)
        .eq('est_id', 1);

      let topSchoolName = '';
      if (schoolData) {
        const schoolCounts: Record<string, number> = {};
        schoolData.forEach(item => {
          const schoolData = item.colegio as any;
          const schoolName = schoolData?.col_nombre || 'Sin colegio';
          schoolCounts[schoolName] = (schoolCounts[schoolName] || 0) + 1;
        });

        const sortedSchools = Object.entries(schoolCounts)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        
        topSchoolName = sortedSchools[0]?.[0] || '';
      }

      return {
        totalDisciplines: totalDisciplines || 0,
        topSchoolName
      };
    }
  });

  // Fetch disciplines by activity for donut chart
  const { data: disciplinesByActivity } = useQuery({
    queryKey: ['disciplines-by-activity'],
    queryFn: async () => {
      const { data: scheduleData } = await supabase
        .from('colegio_actividad_horario')
        .select(`
          act_id,
          actividad!inner(act_nombre)
        `)
        .eq('est_id', 1);

      // Group by activity
      const activityGroups: Record<string, number> = {};
      if (scheduleData) {
        scheduleData.forEach(schedule => {
          const activityData = schedule.actividad as any;
          const activityName = activityData?.act_nombre || 'Sin actividad';
          activityGroups[activityName] = (activityGroups[activityName] || 0) + 1;
        });
      }

      return Object.entries(activityGroups).map(([activity, total]) => ({
        activity,
        total
      }));
    }
  });

  // Fetch top 3 disciplines by enrolled students
  const { data: topDisciplinesByStudents } = useQuery({
    queryKey: ['top-disciplines-by-students'],
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from('nino_asignacion')
        .select(`
          colacthor_id,
          colegio_actividad_horario!inner(
            act_id,
            actividad!inner(act_nombre)
          )
        `)
        .eq('est_id', 1)
        .eq('colegio_actividad_horario.est_id', 1);

      // Count students per activity
      const activityCounts: Record<string, number> = {};
      if (assignments) {
        assignments.forEach(assignment => {
          const scheduleData = assignment.colegio_actividad_horario as any;
          if (scheduleData && scheduleData.actividad) {
            const actName = scheduleData.actividad.act_nombre;
            activityCounts[actName] = (activityCounts[actName] || 0) + 1;
          }
        });
      }

      return Object.entries(activityCounts)
        .map(([disc_nombre, total_students]) => ({ disc_nombre, total_students }))
        .sort((a, b) => b.total_students - a.total_students)
        .slice(0, 3);
    }
  });

  // Fetch schools for weekly schedule dropdown
  const { data: schools } = useQuery({
    queryKey: ['schools-for-weekly'],
    queryFn: async () => {
      const { data } = await supabase
        .from('colegio_actividad_horario')
        .select(`
          col_id,
          colegio!inner(col_nombre)
        `)
        .eq('est_id', 1);

      const uniqueSchools = new Map();
      data?.forEach(item => {
        const schoolData = item.colegio as any;
        if (schoolData) {
          uniqueSchools.set(item.col_id, schoolData.col_nombre);
        }
      });

      return Array.from(uniqueSchools.entries()).map(([id, name]) => ({
        id: id as number,
        name: name as string
      })).sort((a, b) => a.name.localeCompare(b.name));
    }
  });

  // Fetch weekly schedule data
  const { data: weeklyScheduleData } = useQuery({
    queryKey: ['weekly-schedule', selectedSchool],
    queryFn: async () => {
      let query = supabase
        .from('colegio_actividad_horario')
        .select(`
          col_id,
          dia_id,
          colegio!inner(col_nombre),
          dia!inner(dia_nombre)
        `)
        .eq('est_id', 1);

      if (selectedSchool !== 'todos') {
        query = query.eq('col_id', parseInt(selectedSchool));
      }

      const { data } = await query;

      if (selectedSchool === 'todos') {
        // Overview: sessions per weekday across all schools
        const dayCounts: Record<string, number> = {};
        data?.forEach(item => {
          const dayData = item.dia as any;
          const dayName = dayData?.dia_nombre || 'Sin día';
          dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
        });

        return Object.entries(dayCounts).map(([day, sessions]) => ({
          day,
          sessions
        }));
      } else {
        // Single school: sessions per weekday
        const dayCounts: Record<string, number> = {};
        data?.forEach(item => {
          const dayData = item.dia as any;
          const dayName = dayData?.dia_nombre || 'Sin día';
          dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
        });

        return Object.entries(dayCounts).map(([day, sessions]) => ({
          day,
          sessions
        }));
      }
    }
  });

  const chartConfig = {
    total: {
      label: "Total",
      color: "hsl(var(--chart-1))"
    },
    sessions: {
      label: "Sesiones",
      color: "hsl(var(--chart-2))"
    }
  };

  // Custom tooltip for disciplines by activity
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-background border border-border rounded-lg shadow-md p-3">
          <p className="font-medium">Actividad → {data.payload.activity}</p>
          <p className="text-sm flex items-center gap-2">
            <span>Disciplinas → {data.value}</span>
            <div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: data.color }}
            />
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Disciplinas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData?.totalDisciplines || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Colegio con más disciplinas</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{kpiData?.topSchoolName || 'N/A'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Mini-card strip - Top 3 disciplines by students */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topDisciplinesByStudents?.map((discipline, index) => (
          <Card key={discipline.disc_nombre} className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Top {index + 1} Disciplina</p>
                  <p className="text-lg font-semibold text-gray-900 truncate">{discipline.disc_nombre}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-2xl font-bold text-blue-600">{discipline.total_students}</span>
                  </div>
                  <p className="text-xs text-gray-500">alumnos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Disciplines by Activity Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Disciplinas por Actividad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center w-full max-w-[650px] mx-auto">
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={disciplinesByActivity} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={100} 
                      paddingAngle={5} 
                      dataKey="total" 
                      label={({ activity, percent }) => `${activity} ${Math.round(percent * 100)}%`}
                      animationDuration={400}
                    >
                      {disciplinesByActivity?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      content={<ChartLegendContent />}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Schedule Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Cronograma Semanal de Disciplinas
            </CardTitle>
            <div className="pt-2">
              <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Seleccionar colegio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {schools?.map((school) => (
                    <SelectItem key={school.id} value={school.id.toString()}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center w-full max-w-[650px] mx-auto">
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  
                  <BarChart 
                    data={weeklyScheduleData?.sort((a, b) => 
                      daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day)
                    )}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 5
                    }}
                  >
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 12 }} 
                    />
                    <YAxis />
                    <Tooltip content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border border-border rounded-lg shadow-md p-3">
                            <p className="font-medium">{label}</p>
                            <p className="text-sm">
                              <span className="text-muted-foreground">Sesiones: </span>
                              <span className="font-medium">{payload[0].value}</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="sessions" fill="var(--color-sessions)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DisciplinesAnalysisTab;
