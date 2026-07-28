
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Users, UserCog, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const UserAnalysisTab = () => {
  // Fetch KPI data
  const { data: kpiData } = useQuery({
    queryKey: ['user-kpis'],
    queryFn: async () => {
      const [totalUsers, coaches, parents] = await Promise.all([
        supabase.from('usuario').select('*', { count: 'exact', head: true }),
        supabase.from('usuario').select('*, usuario_rol!inner(rol_id)').eq('usuario_rol.rol_id', 3),
        supabase.from('usuario').select('*, usuario_rol!inner(rol_id)').eq('usuario_rol.rol_id', 4)
      ]);

      return {
        total: totalUsers.count || 0,
        coaches: coaches.data?.length || 0,
        parents: parents.data?.length || 0
      };
    }
  });

  // Fetch role distribution data
  const { data: roleDistribution } = useQuery({
    queryKey: ['role-distribution'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuario')
        .select(`
          usuario_rol!inner(
            rol:rol(rol_nombre)
          )
        `);

      if (error) throw error;

      const roleCounts: Record<string, number> = {};
      data?.forEach(user => {
        user.usuario_rol.forEach((ur: any) => {
          const roleName = ur.rol?.rol_nombre || 'Sin rol';
          roleCounts[roleName] = (roleCounts[roleName] || 0) + 1;
        });
      });

      return Object.entries(roleCounts).map(([name, value]) => ({
        name,
        value
      }));
    }
  });

  // Fetch users by role with active/inactive breakdown
  const { data: usersByRole } = useQuery({
    queryKey: ['users-by-role-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuario')
        .select(`
          est_id,
          usuario_rol!inner(
            rol:rol(rol_nombre)
          )
        `);

      if (error) throw error;

      const roleStats: Record<string, { active: number; inactive: number }> = {};
      
      data?.forEach(user => {
        user.usuario_rol.forEach((ur: any) => {
          const roleName = ur.rol?.rol_nombre || 'Sin rol';
          if (!roleStats[roleName]) {
            roleStats[roleName] = { active: 0, inactive: 0 };
          }
          
          if (user.est_id === 1) {
            roleStats[roleName].active += 1;
          } else if (user.est_id === 2) {
            roleStats[roleName].inactive += 1;
          }
        });
      });

      return Object.entries(roleStats).map(([role, counts]) => ({
        role,
        active: counts.active,
        inactive: counts.inactive
      }));
    }
  });

  const chartConfig = {
    active: {
      label: "Activo",
      color: "hsl(var(--chart-1))",
    },
    inactive: {
      label: "Inactivo",
      color: "hsl(var(--destructive))",
    },
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entrenadores</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData?.coaches || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Representantes</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData?.parents || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role Distribution Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center w-full max-w-[600px] mx-auto">
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                      animationDuration={400}
                    >
                      {roleDistribution?.map((entry, index) => (
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

        {/* Users by Role Status Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Usuarios por Rol</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center w-full max-w-[600px] mx-auto">
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usersByRole} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis 
                      dataKey="role" 
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
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border border-border rounded-lg shadow-md p-3">
                              <p className="font-medium mb-2">{label}</p>
                              {payload.map((entry, index) => (
                                <p key={index} className="text-sm">
                                  <span className="text-muted-foreground">{entry.name}: </span>
                                  <span className="font-medium" style={{ color: entry.color }}>
                                    {entry.value}
                                  </span>
                                </p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      content={<ChartLegendContent />}
                    />
                    <Bar 
                      dataKey="active" 
                      stackId="status"
                      name="Activo"
                      fill="var(--color-active)"
                    />
                    <Bar 
                      dataKey="inactive" 
                      stackId="status"
                      name="Inactivo"
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

export default UserAnalysisTab;
