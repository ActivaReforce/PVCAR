
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';
import { Users, Calendar, Bus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

const StudentsAnalysisTab = () => {
  const { toast } = useToast();
  const [selectedSchoolForDisciplines, setSelectedSchoolForDisciplines] = useState('all');
  const [selectedSchoolForAge, setSelectedSchoolForAge] = useState('all');
  const [selectedSchoolForGrade, setSelectedSchoolForGrade] = useState('all');

  // Distinct categorical color palette
  const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#84cc16'];

  // Custom label function for donut charts
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Only show label if percentage is above 3% to avoid overlap
    if (percent < 0.03) return null;

    return (
      <text 
        x={x} 
        y={y} 
        fill="#374151" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="500"
      >
        {`${name} ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Fetch schools for filters
  const { data: schools } = useQuery({
    queryKey: ['schools-for-students-analysis'],
    queryFn: async () => {
      const { data } = await supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .order('col_nombre');
      return data || [];
    }
  });

  // KPI 1: Active students count
  const { data: activeStudentsData } = useQuery({
    queryKey: ['active-students-count'],
    queryFn: async () => {
      const { count: activeCount } = await supabase
        .from('nino')
        .select('*', { count: 'exact', head: true })
        .eq('est_id', 1);

      const { count: inactiveCount } = await supabase
        .from('nino')
        .select('*', { count: 'exact', head: true })
        .eq('est_id', 2);

      return {
        active: activeCount || 0,
        inactive: inactiveCount || 0
      };
    }
  });

  // KPI 2: Age range
  const { data: ageRangeData } = useQuery({
    queryKey: ['age-range'],
    queryFn: async () => {
      const { data } = await supabase
        .from('nino')
        .select('nino_edad')
        .eq('est_id', 1)
        .not('nino_edad', 'is', null);

      if (!data || data.length === 0) return { min: 0, max: 0 };

      const ages = data.map(n => n.nino_edad).filter(age => age !== null);
      return {
        min: Math.min(...ages),
        max: Math.max(...ages)
      };
    }
  });

  // KPI 3: Transport percentage
  const { data: transportData } = useQuery({
    queryKey: ['transport-percentage'],
    queryFn: async () => {
      const { count: totalActive } = await supabase
        .from('nino')
        .select('*', { count: 'exact', head: true })
        .eq('est_id', 1);

      const { count: transportTrue } = await supabase
        .from('nino')
        .select('*', { count: 'exact', head: true })
        .eq('est_id', 1)
        .eq('nino_toma_transporte', true);

      const percentage = totalActive && totalActive > 0 ? Math.round((transportTrue || 0) * 100 / totalActive) : 0;
      return percentage;
    }
  });

  // Donut 1: Students by School
  const { data: schoolData } = useQuery({
    queryKey: ['students-by-school'],
    queryFn: async () => {
      const { data } = await supabase
        .from('nino_asignacion')
        .select(`
          colegio_actividad_horario!inner(
            colegio!inner(col_nombre)
          )
        `)
        .eq('est_id', 1);

      const schoolCounts: Record<string, number> = {};
      
      data?.forEach(assignment => {
        const schoolData = assignment.colegio_actividad_horario as any;
        const schoolName = schoolData?.colegio?.col_nombre;
        if (schoolName) {
          schoolCounts[schoolName] = (schoolCounts[schoolName] || 0) + 1;
        }
      });

      return Object.entries(schoolCounts).map(([name, value]) => ({
        name,
        value
      }));
    }
  });

  // Donut 2: Students by Discipline (with school filter)
  const { data: disciplineData } = useQuery({
    queryKey: ['students-by-discipline', selectedSchoolForDisciplines],
    queryFn: async () => {
      let query = supabase
        .from('nino_asignacion')
        .select(`
          colegio_actividad_horario!inner(
            col_id,
            actividad!inner(act_nombre),
            colegio!inner(col_nombre)
          )
        `)
        .eq('est_id', 1);

      if (selectedSchoolForDisciplines !== 'all') {
        query = query.eq('colegio_actividad_horario.col_id', parseInt(selectedSchoolForDisciplines));
      }

      const { data } = await query;

      const disciplineCounts: Record<string, number> = {};
      
      data?.forEach(assignment => {
        const cahData = assignment.colegio_actividad_horario as any;
        const activityName = cahData?.actividad?.act_nombre;
        if (activityName) {
          disciplineCounts[activityName] = (disciplineCounts[activityName] || 0) + 1;
        }
      });

      return Object.entries(disciplineCounts).map(([name, value]) => ({
        name,
        value
      }));
    }
  });

  // Bar 1: Students by Age (with school filter) - Fixed to use nino.col_id
  const { data: ageData } = useQuery({
    queryKey: ['students-by-age', selectedSchoolForAge],
    queryFn: async () => {
      let query = supabase
        .from('nino')
        .select('nino_edad')
        .eq('est_id', 1)
        .not('nino_edad', 'is', null);

      if (selectedSchoolForAge !== 'all') {
        query = query.eq('col_id', parseInt(selectedSchoolForAge));
      }

      const { data } = await query;

      const ageCounts: Record<number, number> = {};
      
      data?.forEach(student => {
        const age = student.nino_edad;
        if (age !== null) {
          ageCounts[age] = (ageCounts[age] || 0) + 1;
        }
      });

      return Object.entries(ageCounts)
        .map(([age, count]) => ({
          age: parseInt(age),
          count
        }))
        .sort((a, b) => a.age - b.age);
    }
  });

  // Bar 2: Students by Grade (with school filter) - Fixed to use nino.col_id
  const { data: gradeData } = useQuery({
    queryKey: ['students-by-grade', selectedSchoolForGrade],
    queryFn: async () => {
      let query = supabase
        .from('nino')
        .select(`
          categoria_nino_grado!inner(catninograd_nombre)
        `)
        .eq('est_id', 1);

      if (selectedSchoolForGrade !== 'all') {
        query = query.eq('col_id', parseInt(selectedSchoolForGrade));
      }

      const { data } = await query;

      const gradeCounts: Record<string, number> = {};
      
      data?.forEach(student => {
        const gradeData = student.categoria_nino_grado as any;
        const gradeName = gradeData?.catninograd_nombre;
        if (gradeName) {
          gradeCounts[gradeName] = (gradeCounts[gradeName] || 0) + 1;
        }
      });

      return Object.entries(gradeCounts).map(([name, count]) => ({
        name,
        count
      }));
    }
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alumnos Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStudentsData?.active || 0}</div>
            <p className="text-xs text-muted-foreground">
              Alumnos Inactivos: {activeStudentsData?.inactive || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rangos de Edad</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ageRangeData ? `${ageRangeData.min} – ${ageRangeData.max}` : '0 – 0'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toma Transporte</CardTitle>
            <Bus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transportData || 0}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Donut Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students by School - Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Alumnos por Colegio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center w-full max-w-[650px] mx-auto">
              <ChartContainer config={{}} className="h-[300px] w-full">
                <PieChart>
                  <Pie
                    data={schoolData || []}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={renderCustomizedLabel}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    animationDuration={400}
                  >
                    {(schoolData || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        return (
                          <div className="bg-background border rounded-lg p-2 shadow-md">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-sm" 
                                style={{ backgroundColor: data.color }}
                              />
                              <span className="font-medium">{data.payload.name}</span>
                            </div>
                            <div className="text-sm">
                              Alumnos → {data.value}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Students by Discipline - Donut Chart with School Filter */}
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>Alumnos por Disciplina</CardTitle>
            <div className="space-y-2">
              <label className="text-sm font-medium">Colegio</label>
              <Select value={selectedSchoolForDisciplines} onValueChange={setSelectedSchoolForDisciplines}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar colegio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {schools?.map((school) => (
                    <SelectItem key={school.col_id} value={school.col_id.toString()}>
                      {school.col_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center w-full max-w-[650px] mx-auto">
              <ChartContainer config={{}} className="h-[300px] w-full">
                <PieChart>
                  <Pie
                    data={disciplineData || []}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={renderCustomizedLabel}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    animationDuration={400}
                  >
                    {(disciplineData || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students by Age */}
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>Alumnos por Edad</CardTitle>
            <div className="space-y-2">
              <label className="text-sm font-medium">Colegio</label>
              <Select value={selectedSchoolForAge} onValueChange={setSelectedSchoolForAge}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar colegio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {schools?.map((school) => (
                    <SelectItem key={school.col_id} value={school.col_id.toString()}>
                      {school.col_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center w-full max-w-[650px] mx-auto">
              <ChartContainer config={{}} className="h-[300px] w-full">
                <BarChart data={ageData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="age" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="#8b5cf6">
                    <LabelList dataKey="count" position="top" fontSize={12} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Students by Grade */}
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>Alumnos por Grado</CardTitle>
            <div className="space-y-2">
              <label className="text-sm font-medium">Colegio</label>
              <Select value={selectedSchoolForGrade} onValueChange={setSelectedSchoolForGrade}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar colegio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {schools?.map((school) => (
                    <SelectItem key={school.col_id} value={school.col_id.toString()}>
                      {school.col_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center w-full max-w-[650px] mx-auto">
              <ChartContainer config={{}} className="h-[300px] w-full">
                <BarChart data={gradeData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="#8b5cf6">
                    <LabelList dataKey="count" position="top" fontSize={12} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentsAnalysisTab;
