
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { UserCog, Users, UserX } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#0000ff'];

const CoachesAnalysisTab = () => {
  // Fetch KPI data
  const { data: kpiData } = useQuery({
    queryKey: ['coaches-kpis'],
    queryFn: async () => {
      // Total coaches
      const { count: totalCoaches } = await supabase
        .from('entrenador')
        .select('*', { count: 'exact', head: true })
        .eq('est_id', 1);

      // Coaches assigned to ≥ 1 discipline
      const { data: assignedCoaches } = await supabase
        .from('entrenador_asignacion')
        .select('ent_id')
        .eq('est_id', 1);

      const uniqueAssignedCoaches = new Set(assignedCoaches?.map(item => item.ent_id) || []);
      const coachesAssigned = uniqueAssignedCoaches.size;

      // Inactive coaches
      const { count: inactiveCoaches } = await supabase
        .from('entrenador')
        .select('*', { count: 'exact', head: true })
        .eq('est_id', 2);

      return {
        totalCoaches: totalCoaches || 0,
        coachesAssigned,
        inactiveCoaches: inactiveCoaches || 0
      };
    }
  });

  // Fetch coaches by school for donut chart
  const { data: coachesBySchool } = useQuery({
    queryKey: ['coaches-by-school-donut'],
    queryFn: async () => {
      const { data: assignmentData } = await supabase
        .from('entrenador_asignacion')
        .select(`
          ent_id,
          colegio_actividad_horario!inner(
            col_id,
            colegio!inner(col_nombre)
          )
        `)
        .eq('est_id', 1);

      // Group by school
      const schoolGroups: Record<string, Set<number>> = {};
      if (assignmentData) {
        assignmentData.forEach(assignment => {
          const cah = assignment.colegio_actividad_horario as any;
          const schoolName = cah?.colegio?.col_nombre || 'Sin colegio';
          if (!schoolGroups[schoolName]) {
            schoolGroups[schoolName] = new Set();
          }
          schoolGroups[schoolName].add(assignment.ent_id);
        });
      }

      return Object.entries(schoolGroups).map(([colegio, coachSet]) => ({
        colegio,
        entrenadores: coachSet.size
      }));
    }
  });

  const chartConfig = {
    entrenadores: {
      label: "Entrenadores",
      color: "hsl(var(--chart-1))"
    }
  };

  // Custom tooltip for coaches by school
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-background border border-border rounded-lg shadow-md p-3">
          <p className="font-medium flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: data.color }}
            />
            {data.payload.colegio}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Entrenadores → </span>
            <span className="font-medium">{data.value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="w-full max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">Total Entrenadores</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData?.totalCoaches || 0}</div>
          </CardContent>
        </Card>

        <Card className="w-full max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">Entrenadores Asignados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData?.coachesAssigned || 0}</div>
          </CardContent>
        </Card>

        <Card className="w-full max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">Entrenadores Inactivos</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData?.inactiveCoaches || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Coaches by School Donut Chart */}
      <Card className="w-full max-w-full">
        <CardHeader>
          <CardTitle className="whitespace-nowrap overflow-hidden text-ellipsis">Entrenadores por Colegio</CardTitle>
        </CardHeader>
        <CardContent className="w-full max-w-full overflow-x-hidden">
          <div className="flex justify-center items-center w-full max-w-full">
            <ChartContainer config={chartConfig} className="h-[400px] w-full max-w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={coachesBySchool} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={100} 
                    paddingAngle={5} 
                    dataKey="entrenadores" 
                    label={({ colegio, percent }) => `${colegio} ${Math.round(percent * 100)}%`}
                    animationDuration={400}
                  >
                    {coachesBySchool?.map((entry, index) => (
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
    </div>
  );
};

export default CoachesAnalysisTab;
