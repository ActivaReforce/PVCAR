import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Activity, TrendingUp, Tag, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#0000ff'];

const ActivitiesAnalysisTab = () => {
  // Fetch KPI data
  const { data: kpiData } = useQuery({
    queryKey: ['activities-kpis'],
    queryFn: async () => {
      // Total activities
      const { count: totalActivities } = await supabase
        .from('actividad')
        .select('*', { count: 'exact', head: true });

      // Get disciplines per activity for average calculation
      const { data: disciplinesData } = await supabase
        .from('colegio_actividad_horario')
        .select('act_id')
        .eq('est_id', 1);

      // Calculate average disciplines per activity
      const activityCounts: Record<number, number> = {};
      if (disciplinesData) {
        disciplinesData.forEach(disc => {
          activityCounts[disc.act_id] = (activityCounts[disc.act_id] || 0) + 1;
        });
      }
      const counts = Object.values(activityCounts);
      const avgDisciplines = counts.length > 0 
        ? Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length * 100) / 100 
        : 0;

      // Category with most activities
      const { data: categoryData } = await supabase
        .from('actividad')
        .select(`
          cat_id,
          categoria!inner(cat_nombre)
        `);

      let topCategory = 'Sin categoría';
      if (categoryData) {
        const categoryCounts: Record<string, number> = {};
        categoryData.forEach(activity => {
          const categoryData = activity.categoria as any;
          const categoryName = categoryData?.cat_nombre || 'Sin categoría';
          categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
        });
        
        // Find category with most activities, break ties alphabetically
        const sortedCategories = Object.entries(categoryCounts)
          .sort(([nameA, countA], [nameB, countB]) => {
            if (countB !== countA) return countB - countA;
            return nameA.localeCompare(nameB);
          });
        
        if (sortedCategories.length > 0) {
          topCategory = sortedCategories[0][0];
        }
      }

      return {
        totalActivities: totalActivities || 0,
        avgDisciplines,
        topCategory
      };
    }
  });

  // Fetch activities by category for donut chart
  const { data: activitiesByCategory } = useQuery({
    queryKey: ['activities-by-category'],
    queryFn: async () => {
      const { data: activities } = await supabase
        .from('actividad')
        .select('cat_id, categoria!inner(cat_nombre)')
        .order('cat_id');

      // Group by category
      const categoryGroups: Record<string, number> = {};
      if (activities) {
        activities.forEach(activity => {
          const categoryData = activity.categoria as any;
          const categoryName = categoryData?.cat_nombre || 'Sin categoría';
          categoryGroups[categoryName] = (categoryGroups[categoryName] || 0) + 1;
        });
      }

      return Object.entries(categoryGroups).map(([categoria, actividades]) => ({
        categoria,
        actividades
      }));
    }
  });

  // Fetch disciplines per activity for bar chart (ALL activities, no limit)
  const { data: disciplinesPerActivity } = useQuery({
    queryKey: ['disciplines-per-activity-all'],
    queryFn: async () => {
      const { data: activities } = await supabase
        .from('actividad')
        .select('act_id, act_nombre')
        .order('act_nombre');

      const { data: disciplines } = await supabase
        .from('colegio_actividad_horario')
        .select('act_id')
        .eq('est_id', 1);

      // Count disciplines per activity
      const disciplineCounts: Record<number, number> = {};
      if (disciplines) {
        disciplines.forEach(disc => {
          disciplineCounts[disc.act_id] = (disciplineCounts[disc.act_id] || 0) + 1;
        });
      }

      const result = activities?.map(activity => ({
        act_nombre: activity.act_nombre,
        total_disciplines: disciplineCounts[activity.act_id] || 0
      })).sort((a, b) => {
        if (b.total_disciplines !== a.total_disciplines) {
          return b.total_disciplines - a.total_disciplines;
        }
        return a.act_nombre.localeCompare(b.act_nombre);
      }) || [];

      return result;
    }
  });

  // Fetch top 3 activities by number of disciplines
  const { data: topActivitiesByDisciplines } = useQuery({
    queryKey: ['top-activities-by-disciplines'],
    queryFn: async () => {
      const { data: activities } = await supabase
        .from('actividad')
        .select('act_id, act_nombre')
        .order('act_nombre');

      const { data: disciplines } = await supabase
        .from('colegio_actividad_horario')
        .select('act_id')
        .eq('est_id', 1);

      // Count disciplines per activity
      const disciplineCounts: Record<number, number> = {};
      if (disciplines) {
        disciplines.forEach(disc => {
          disciplineCounts[disc.act_id] = (disciplineCounts[disc.act_id] || 0) + 1;
        });
      }

      return activities?.map(activity => ({
        act_nombre: activity.act_nombre,
        disciplinas: disciplineCounts[activity.act_id] || 0
      })).sort((a, b) => {
        if (b.disciplinas !== a.disciplinas) {
          return b.disciplinas - a.disciplinas;
        }
        return a.act_nombre.localeCompare(b.act_nombre);
      }).slice(0, 3) || [];
    }
  });

  const chartConfig = {
    actividades: {
      label: "Actividades",
      color: "hsl(var(--chart-1))"
    },
    total_disciplines: {
      label: "Disciplinas",
      color: "hsl(var(--chart-2))"
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Actividades</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData?.totalActivities || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio Disciplinas por Actividad</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData?.avgDisciplines || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categoría con más actividades</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData?.topCategory || 'Sin categoría'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top 3 activities by disciplines */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topActivitiesByDisciplines?.map((activity, index) => (
          <Card key={activity.act_nombre} className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Top {index + 1} Actividad</p>
                  <p className="text-lg font-semibold text-gray-900 truncate">{activity.act_nombre}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-2xl font-bold text-blue-600">{activity.disciplinas}</span>
                  </div>
                  <p className="text-xs text-gray-500">disciplinas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activities by Category Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Actividades por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center w-full max-w-[600px] mx-auto">
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={activitiesByCategory} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={100} 
                      paddingAngle={5} 
                      dataKey="actividades" 
                      label={({ categoria, percent }) => `${categoria} ${Math.round(percent * 100)}%`}
                      animationDuration={400}
                    >
                      {activitiesByCategory?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        return (
                          <div className="bg-background border border-border rounded-lg shadow-md p-3">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: data.color }}
                              />
                              <span className="font-medium">{data.payload.categoria}</span>
                            </div>
                            <p className="text-sm mt-1">
                              Actividades → {data.value}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }} />
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

        {/* Disciplines per Activity Bar Chart - ALL activities */}
        <Card>
          <CardHeader>
            <CardTitle>Disciplinas por Actividad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center w-full max-w-[600px] mx-auto">
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={disciplinesPerActivity} 
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <XAxis 
                      dataKey="act_nombre" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100} 
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border border-border rounded-lg shadow-md p-3">
                            <p className="font-medium">{label}</p>
                            <p className="text-sm">
                              <span className="text-muted-foreground">Disciplinas: </span>
                              <span className="font-medium">{payload[0].value}</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar 
                      dataKey="total_disciplines" 
                      fill="var(--color-total_disciplines)" 
                      radius={[4, 4, 0, 0]} 
                    />
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

export default ActivitiesAnalysisTab;
