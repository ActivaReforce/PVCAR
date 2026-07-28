
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { School, UserCog } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#0000ff'];

const SchoolAnalysisTab = () => {
  // Fetch KPI data with simplified queries
  const { data: kpiData } = useQuery({
    queryKey: ['school-kpis'],
    queryFn: async () => {
      // Get total active schools
      const { count: totalSchools } = await supabase
        .from('colegio')
        .select('*', { count: 'exact', head: true });

      // Get coordinators count
      const { count: coordinatorsCount } = await supabase
        .from('colegio_coordinador')
        .select('*', { count: 'exact', head: true });

      return {
        total: totalSchools || 0,
        coordinators: coordinatorsCount || 0
      };
    }
  });

  // Fetch students per school for pie chart
  const { data: studentsPerSchool } = useQuery({
    queryKey: ['students-per-school'],
    queryFn: async () => {
      // Get active schools
      const { data: schools } = await supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .order('col_nombre');

      // Get active student assignments with school info
      const { data: assignments } = await supabase
        .from('nino_asignacion')
        .select(`
          colacthor_id,
          colegio_actividad_horario!inner(
            col_id
          )
        `)
        .eq('est_id', 1)
        .eq('colegio_actividad_horario.est_id', 1);

      // Count students per school
      const studentCounts: Record<number, number> = {};
      if (assignments) {
        assignments.forEach(assignment => {
          const scheduleData = assignment.colegio_actividad_horario as any;
          if (scheduleData && scheduleData.col_id) {
            studentCounts[scheduleData.col_id] = (studentCounts[scheduleData.col_id] || 0) + 1;
          }
        });
      }

      const result = schools?.map(school => ({
        name: school.col_nombre,
        value: studentCounts[school.col_id] || 0
      })).filter(school => school.value > 0) || [];

      return result;
    }
  });

  // Fetch disciplines per school with status for bar chart
  const { data: disciplinesPerSchool } = useQuery({
    queryKey: ['disciplines-per-school-status'],
    queryFn: async () => {
      // Get all school-discipline combinations with status
      const { data: scheduleData } = await supabase
        .from('colegio_actividad_horario')
        .select(`
          col_id,
          act_id,
          est_id,
          colegio!inner(col_nombre),
          actividad!inner(act_nombre)
        `);

      if (!scheduleData) return [];

      // Group by school and discipline, applying deduplication and status collapse rules
      const schoolDisciplineMap: Record<string, Record<string, { 
        schoolName: string, 
        disciplineName: string, 
        hasActive: boolean, 
        hasInactive: boolean 
      }>> = {};

      scheduleData.forEach(schedule => {
        const schoolData = schedule.colegio as any;
        const activityData = schedule.actividad as any;
        const schoolName = schoolData?.col_nombre || 'Sin nombre';
        const disciplineName = activityData?.act_nombre || 'Sin actividad';
        const key = `${schedule.col_id}-${schedule.act_id}`;

        if (!schoolDisciplineMap[schoolName]) {
          schoolDisciplineMap[schoolName] = {};
        }

        if (!schoolDisciplineMap[schoolName][key]) {
          schoolDisciplineMap[schoolName][key] = {
            schoolName,
            disciplineName,
            hasActive: false,
            hasInactive: false
          };
        }

        // Track if this discipline has active or inactive schedules
        if (schedule.est_id === 1) {
          schoolDisciplineMap[schoolName][key].hasActive = true;
        } else if (schedule.est_id === 2) {
          schoolDisciplineMap[schoolName][key].hasInactive = true;
        }
      });

      // Count disciplines per school by status
      const schoolCounts: Record<string, { 
        name: string, 
        active: number, 
        inactive: number,
        disciplines: Array<{ name: string, status: 'Activa' | 'Inactiva' }>
      }> = {};

      Object.entries(schoolDisciplineMap).forEach(([schoolName, disciplines]) => {
        if (!schoolCounts[schoolName]) {
          schoolCounts[schoolName] = { 
            name: schoolName, 
            active: 0, 
            inactive: 0,
            disciplines: []
          };
        }

        Object.values(disciplines).forEach(discipline => {
          // If any schedule is active, consider the discipline active
          if (discipline.hasActive) {
            schoolCounts[schoolName].active += 1;
            schoolCounts[schoolName].disciplines.push({
              name: discipline.disciplineName,
              status: 'Activa'
            });
          } else {
            schoolCounts[schoolName].inactive += 1;
            schoolCounts[schoolName].disciplines.push({
              name: discipline.disciplineName,
              status: 'Inactiva'
            });
          }
        });
      });

      // Sort by total disciplines and take top 10
      return Object.values(schoolCounts)
        .sort((a, b) => (b.active + b.inactive) - (a.active + a.inactive))
        .slice(0, 10);
    }
  });

  const chartConfig = {
    active: {
      label: "Activas",
      color: "hsl(var(--chart-1))"
    },
    inactive: {
      label: "Inactivas",
      color: "hsl(var(--destructive))"
    },
    value: {
      label: "Alumnos",
      color: "hsl(var(--chart-2))"
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Colegios</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coordinadores de colegio</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData?.coordinators || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students per School Donut Chart - First */}
        <Card>
          <CardHeader>
            <CardTitle>Alumnos por Colegio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center w-full max-w-[600px] mx-auto">
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={studentsPerSchool} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={100} 
                      paddingAngle={5} 
                      dataKey="value" 
                      label={({
                        name,
                        percent
                      }) => `${name} ${Math.round(percent * 100)}%`} 
                      animationDuration={400}
                    >
                      {studentsPerSchool?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
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

        {/* Disciplines per School Bar Chart - Second */}
        <Card>
          <CardHeader>
            <CardTitle>Disciplinas por colegio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center w-full max-w-[600px] mx-auto">
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={disciplinesPerSchool} margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 60
                  }}>
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <Tooltip content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border border-border rounded-lg shadow-md p-3 max-w-xs">
                            <p className="font-medium mb-2">{label}</p>
                            <div className="space-y-1 mb-3">
                              <p className="text-sm">
                                <span className="text-muted-foreground">Activas: </span>
                                <span className="font-medium" style={{ color: 'var(--color-active)' }}>
                                  {data.active || 0}
                                </span>
                              </p>
                              <p className="text-sm">
                                <span className="text-muted-foreground">Inactivas: </span>
                                <span className="font-medium" style={{ color: 'var(--color-inactive)' }}>
                                  {data.inactive || 0}
                                </span>
                              </p>
                            </div>
                            {data.disciplines && data.disciplines.length > 0 && (
                              <div>
                                <p className="text-xs font-medium mb-1">Disciplinas:</p>
                                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                                  {data.disciplines.map((discipline: any, index: number) => (
                                    <div key={index} className="flex items-center gap-1 text-xs">
                                      <span className={`inline-block w-2 h-2 rounded-full ${
                                        discipline.status === 'Activa' ? 'bg-chart-1' : 'bg-destructive'
                                      }`}></span>
                                      <span>{discipline.name}</span>
                                      <span className="text-muted-foreground">({discipline.status})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
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
                    <Bar 
                      dataKey="active" 
                      stackId="status"
                      name="Activas"
                      fill="var(--color-active)"
                    />
                    <Bar 
                      dataKey="inactive" 
                      stackId="status"
                      name="Inactivas"
                      fill="var(--color-inactive)"
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

export default SchoolAnalysisTab;
