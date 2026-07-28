
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Users, UserX, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';


interface AttendanceStats {
  presente: { count: number; percentage: number };
  ausente: { count: number; percentage: number };
  tarde: { count: number; percentage: number };
  justificado: { count: number; percentage: number };
  total: number;
}

interface School {
  col_id: number;
  col_nombre: string;
}

interface ChartData {
  name: string;
  value: number;
  count: number;
  color: string;
}

const ATTENDANCE_COLORS = {
  presente: '#22c55e',
  ausente: '#ef4444', 
  tarde: '#f59e0b',
  justificado: '#3b82f6'
};

const AttendanceCoachesAnalysisTab = () => {
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  // Load schools on component mount
  useEffect(() => {
    loadSchools();
  }, []);

  // Load both KPI stats and chart data when filters change
  useEffect(() => {
    loadAttendanceStats();
    loadFilteredAttendanceData();
  }, [selectedSchool]);

  const loadSchools = async () => {
    try {
      const { data, error } = await supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .order('col_nombre');

      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      console.error('Error loading schools:', error);
    }
  };


  const loadAttendanceStats = async () => {
    try {
      // Get all attendance records with col_id for proper filtering
      const { data, error } = await supabase
        .from('asistencia_entrenador')
        .select('asisest_id, ent_id, col_id');

      if (error) throw error;

      // Apply filtering by col_id directly
      let filteredData = data || [];
      
      if (selectedSchool !== 'all') {
        // Filter by selected school using col_id
        const schoolId = parseInt(selectedSchool);
        filteredData = filteredData.filter(record => 
          record.col_id === schoolId
        );
      }

      const total = filteredData.length;
      const presente = filteredData.filter(row => row.asisest_id === 1).length;
      const ausente = filteredData.filter(row => row.asisest_id === 2).length;
      const tarde = filteredData.filter(row => row.asisest_id === 3).length;
      const justificado = filteredData.filter(row => row.asisest_id === 4).length;

      setAttendanceStats({
        presente: { count: presente, percentage: total > 0 ? (presente / total) * 100 : 0 },
        ausente: { count: ausente, percentage: total > 0 ? (ausente / total) * 100 : 0 },
        tarde: { count: tarde, percentage: total > 0 ? (tarde / total) * 100 : 0 },
        justificado: { count: justificado, percentage: total > 0 ? (justificado / total) * 100 : 0 },
        total
      });
    } catch (error) {
      console.error('Error loading attendance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFilteredAttendanceData = async () => {
    try {
      // Get all attendance records with col_id for proper filtering
      const { data, error } = await supabase
        .from('asistencia_entrenador')
        .select('asisest_id, ent_id, col_id');

      if (error) throw error;

      // Apply the same filtering logic as the KPI cards
      let filteredData = data || [];
      
      if (selectedSchool !== 'all') {
        // Filter by selected school using col_id
        const schoolId = parseInt(selectedSchool);
        filteredData = filteredData.filter(record => 
          record.col_id === schoolId
        );
      }

      const total = filteredData.length;
      const presente = filteredData.filter(row => row.asisest_id === 1).length;
      const ausente = filteredData.filter(row => row.asisest_id === 2).length;
      const tarde = filteredData.filter(row => row.asisest_id === 3).length;
      const justificado = filteredData.filter(row => row.asisest_id === 4).length;

      const chartData: ChartData[] = [
        {
          name: 'Presente',
          value: total > 0 ? (presente / total) * 100 : 0,
          count: presente,
          color: ATTENDANCE_COLORS.presente
        },
        {
          name: 'Ausente',
          value: total > 0 ? (ausente / total) * 100 : 0,
          count: ausente,
          color: ATTENDANCE_COLORS.ausente
        },
        {
          name: 'Tarde',
          value: total > 0 ? (tarde / total) * 100 : 0,
          count: tarde,
          color: ATTENDANCE_COLORS.tarde
        },
        {
          name: 'Justificado',
          value: total > 0 ? (justificado / total) * 100 : 0,
          count: justificado,
          color: ATTENDANCE_COLORS.justificado
        }
      ].filter(item => item.count > 0); // Only show categories with data

      setChartData(chartData);
    } catch (error) {
      console.error('Error loading filtered attendance data:', error);
    }
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const renderCustomLabel = (entry: any) => {
    return `${entry.name} ${formatPercentage(entry.value)}`;
  };

  if (loading) {
    return (
      <div className="space-y-6 w-full max-w-full overflow-x-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="w-full max-w-full">
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-16"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="w-full max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              Presente {selectedSchool === 'all' ? 'Global' : schools.find(s => s.col_id.toString() === selectedSchool)?.col_nombre || 'Global'}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatPercentage(attendanceStats?.presente.percentage || 0)}
            </div>
            <p className="text-xs text-muted-foreground break-words">
              {attendanceStats?.presente.count}/{attendanceStats?.total} registros
            </p>
          </CardContent>
        </Card>

        <Card className="w-full max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              Ausente {selectedSchool === 'all' ? 'Global' : schools.find(s => s.col_id.toString() === selectedSchool)?.col_nombre || 'Global'}
            </CardTitle>
            <UserX className="h-4 w-4 text-red-600 flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatPercentage(attendanceStats?.ausente.percentage || 0)}
            </div>
            <p className="text-xs text-muted-foreground break-words">
              {attendanceStats?.ausente.count}/{attendanceStats?.total} registros
            </p>
          </CardContent>
        </Card>

        <Card className="w-full max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              Tarde {selectedSchool === 'all' ? 'Global' : schools.find(s => s.col_id.toString() === selectedSchool)?.col_nombre || 'Global'}
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-600 flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatPercentage(attendanceStats?.tarde.percentage || 0)}
            </div>
            <p className="text-xs text-muted-foreground break-words">
              {attendanceStats?.tarde.count}/{attendanceStats?.total} registros
            </p>
          </CardContent>
        </Card>

        <Card className="w-full max-w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              Justificado {selectedSchool === 'all' ? 'Global' : schools.find(s => s.col_id.toString() === selectedSchool)?.col_nombre || 'Global'}
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600 flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatPercentage(attendanceStats?.justificado.percentage || 0)}
            </div>
            <p className="text-xs text-muted-foreground break-words">
              {attendanceStats?.justificado.count}/{attendanceStats?.total} registros
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Donut Chart with School Filter */}
      <Card className="w-full max-w-full">
        <CardHeader>
          <CardTitle className="whitespace-nowrap overflow-hidden text-ellipsis">Asistencia por Colegio</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-4">
            <div className="space-y-2 w-full sm:w-auto">
              <label className="text-sm font-medium">Colegio</label>
            <Select value={selectedSchool} onValueChange={setSelectedSchool}>
              <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar colegio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.col_id} value={school.col_id.toString()}>
                      {school.col_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="w-full max-w-full overflow-x-hidden">
          <div className="flex justify-center items-center w-full max-w-[650px] mx-auto">
            {chartData.length > 0 ? (
              <ChartContainer config={{}} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      innerRadius={60}
                      dataKey="value"
                      label={renderCustomLabel}
                      labelLine={true}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => [
                            `${name}: ${formatPercentage(Number(value))} — ${
                              chartData.find(d => d.name === name)?.count ?? 0
                            } registros`,
                            ""
                          ]}
                        />
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground break-words text-center px-4">
                No hay datos de asistencia para los filtros seleccionados
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceCoachesAnalysisTab;
