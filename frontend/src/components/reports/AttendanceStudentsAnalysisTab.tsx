import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer, LabelList } from 'recharts';
import { Users, UserX, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
interface AttendanceStats {
  presente: {
    count: number;
    percentage: number;
  };
  ausente: {
    count: number;
    percentage: number;
  };
  tarde: {
    count: number;
    percentage: number;
  };
  justificado: {
    count: number;
    percentage: number;
  };
  total: number;
}
interface School {
  col_id: number;
  col_nombre: string;
}
interface Discipline {
  colacthor_id: number;
  label: string;
  act_nombre: string;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
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
const AttendanceStudentsAnalysisTab = () => {
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [disciplinesLoading, setDisciplinesLoading] = useState(false);

  // Load schools on component mount
  useEffect(() => {
    loadSchools();
  }, []);

  // Load attendance stats when filters change
  useEffect(() => {
    loadAttendanceStats();
  }, [selectedSchool, selectedDiscipline]);

  // Load disciplines when school changes
  useEffect(() => {
    if (selectedSchool !== 'all') {
      loadDisciplines();
    } else {
      setDisciplines([]);
      setSelectedDiscipline('all');
    }
  }, [selectedSchool]);

  // Update chart data when filters change
  useEffect(() => {
    loadFilteredAttendanceData();
  }, [selectedSchool, selectedDiscipline]);
  const loadSchools = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('colegio').select('col_id, col_nombre').order('col_nombre');
      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      console.error('Error loading schools:', error);
    }
  };
  const loadDisciplines = async () => {
    if (selectedSchool === 'all') {
      setDisciplines([]);
      setSelectedDiscipline('all');
      return;
    }
    setDisciplinesLoading(true);
    try {
      const {
        data: disciplinesData,
        error
      } = await supabase.from('colegio_actividad_horario').select(`
          colacthor_id,
          colacthor_hora_inicio,
          colacthor_hora_fin,
          actividad!inner (act_nombre),
          dia!inner (dia_nombre)
        `).eq('col_id', parseInt(selectedSchool)).eq('est_id', 1).order('colacthor_hora_inicio');
      if (error) throw error;
      const formattedDisciplines: Discipline[] = (disciplinesData || []).map(d => {
        return {
          colacthor_id: d.colacthor_id,
          act_nombre: d.actividad?.act_nombre || 'Sin nombre',
          dia_nombre: d.dia?.dia_nombre || 'Sin día',
          hora_inicio: d.colacthor_hora_inicio?.substring(0, 5) || '',
          hora_fin: d.colacthor_hora_fin?.substring(0, 5) || '',
          label: `${d.actividad?.act_nombre || 'Sin nombre'} - ${d.dia?.dia_nombre || 'Sin día'} (${d.colacthor_hora_inicio?.substring(0, 5) || ''} - ${d.colacthor_hora_fin?.substring(0, 5) || ''})`
        };
      });
      setDisciplines(formattedDisciplines);
      setSelectedDiscipline('all'); // Reset discipline filter when school changes
    } catch (error) {
      console.error('Error loading disciplines:', error);
      setDisciplines([]);
    } finally {
      setDisciplinesLoading(false);
    }
  };
  const loadAttendanceStats = async () => {
    try {
      // Apply the same filtering logic as the chart
      let query = supabase
        .from('asistencia_nino')
        .select(`
          asisest_id,
          nino!inner (
            nino_nombre,
            col_id,
            colegio!inner (
              col_nombre
            )
          ),
          colegio_actividad_horario!inner (
            colacthor_id
          )
        `);

      // Apply school filter
      if (selectedSchool !== 'all') {
        query = query.eq('nino.col_id', parseInt(selectedSchool));
      }

      // Apply discipline filter
      if (selectedDiscipline !== 'all') {
        query = query.eq('colacthor_id', parseInt(selectedDiscipline));
      }

      const { data, error } = await query;
      if (error) throw error;

      const total = data?.length || 0;
      const presente = data?.filter(row => row.asisest_id === 1).length || 0;
      const ausente = data?.filter(row => row.asisest_id === 2).length || 0;
      const tarde = data?.filter(row => row.asisest_id === 3).length || 0;
      const justificado = data?.filter(row => row.asisest_id === 4).length || 0;

      setAttendanceStats({
        presente: {
          count: presente,
          percentage: total > 0 ? (presente / total) * 100 : 0
        },
        ausente: {
          count: ausente,
          percentage: total > 0 ? (ausente / total) * 100 : 0
        },
        tarde: {
          count: tarde,
          percentage: total > 0 ? (tarde / total) * 100 : 0
        },
        justificado: {
          count: justificado,
          percentage: total > 0 ? (justificado / total) * 100 : 0
        },
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
      let query = supabase.from('asistencia_nino').select(`
          asisest_id,
          nino!inner (
            nino_nombre,
            col_id,
            colegio!inner (
              col_nombre
            )
          ),
          colegio_actividad_horario!inner (
            colacthor_id
          )
        `);

      // Apply school filter
      if (selectedSchool !== 'all') {
        query = query.eq('nino.col_id', parseInt(selectedSchool));
      }

      // Apply discipline filter
      if (selectedDiscipline !== 'all') {
        query = query.eq('colacthor_id', parseInt(selectedDiscipline));
      }
      const { data, error } = await query;
      if (error) throw error;

      const total = data?.length || 0;
      const presente = data?.filter(row => row.asisest_id === 1).length || 0;
      const ausente = data?.filter(row => row.asisest_id === 2).length || 0;
      const tarde = data?.filter(row => row.asisest_id === 3).length || 0;
      const justificado = data?.filter(row => row.asisest_id === 4).length || 0;
      const chartData: ChartData[] = [{
        name: 'Presente',
        value: total > 0 ? presente / total * 100 : 0,
        count: presente,
        color: ATTENDANCE_COLORS.presente
      }, {
        name: 'Ausente',
        value: total > 0 ? ausente / total * 100 : 0,
        count: ausente,
        color: ATTENDANCE_COLORS.ausente
      }, {
        name: 'Tarde',
        value: total > 0 ? tarde / total * 100 : 0,
        count: tarde,
        color: ATTENDANCE_COLORS.tarde
      }, {
        name: 'Justificado',
        value: total > 0 ? justificado / total * 100 : 0,
        count: justificado,
        color: ATTENDANCE_COLORS.justificado
      }].filter(item => item.count > 0); // Only show categories with data

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
    return <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-16"></div>
                </div>
              </CardContent>
            </Card>)}
        </div>
      </div>;
  }
  return <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Donut Chart with Filters */}
      <Card className="w-full max-w-full">
        <CardHeader>
          <CardTitle className="mb-5 whitespace-nowrap overflow-hidden text-ellipsis">Asistencia por Colegio por Disciplina</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-4">
            <div className="space-y-2 w-full sm:w-auto">
              <label className="text-sm font-medium">Colegio</label>
              <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Seleccionar colegio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {schools.map(school => <SelectItem key={school.col_id} value={school.col_id.toString()}>
                      {school.col_nombre}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 w-full sm:w-auto">
              <label className="text-sm font-medium">Disciplina</label>
              <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline} disabled={selectedSchool === 'all' || disciplinesLoading}>
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder={disciplinesLoading ? "Cargando disciplinas..." : selectedSchool === 'all' ? "Seleccione un colegio primero" : "Seleccionar disciplina"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {disciplines.map(discipline => <SelectItem key={discipline.colacthor_id} value={discipline.colacthor_id.toString()}>
                      {discipline.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="w-full max-w-full overflow-x-hidden">
          <div className="h-[400px] w-full max-w-full">
            {chartData.length > 0 ? <ChartContainer config={{}} className="h-full w-full max-w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" outerRadius={120} innerRadius={60} dataKey="value" label={renderCustomLabel} labelLine={true}>
                      {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => [`${name}: ${formatPercentage(Number(value))} — ${chartData.find(d => d.name === name)?.count ?? 0} registros`, ""]} />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer> : <div className="h-full flex items-center justify-center text-muted-foreground">
                No hay datos de asistencia para los filtros seleccionados
              </div>}
          </div>
        </CardContent>
      </Card>
    </div>;
};
export default AttendanceStudentsAnalysisTab;