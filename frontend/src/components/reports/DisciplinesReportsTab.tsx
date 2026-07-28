
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';

const DisciplinesReportsTab = () => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  
  const [selectedSchool, setSelectedSchool] = useState('todos');
  const [selectedActivity, setSelectedActivity] = useState('todas');
  const [selectedDay, setSelectedDay] = useState('todos');
  const [selectedStatus, setSelectedStatus] = useState('todos');
  const [viewWithCoaches, setViewWithCoaches] = useState(true);

  // Fetch schools
  const { data: schools } = useQuery({
    queryKey: ['schools-for-disciplines-export'],
    queryFn: async () => {
      const { data } = await supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .order('col_nombre');
      return data || [];
    }
  });

  // Fetch activities
  const { data: activities } = useQuery({
    queryKey: ['activities-for-disciplines-export'],
    queryFn: async () => {
      const { data } = await supabase
        .from('actividad')
        .select('act_id, act_nombre')
        .order('act_nombre');
      return data || [];
    }
  });

  // Fetch days
  const { data: days } = useQuery({
    queryKey: ['days-for-disciplines-export'],
    queryFn: async () => {
      const { data } = await supabase
        .from('dia')
        .select('dia_id, dia_nombre')
        .order('dia_id');
      return data || [];
    }
  });

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      if (viewWithCoaches) {
        // Query with coaches LEFT JOIN
        let query = supabase
          .from('colegio_actividad_horario')
          .select(`
            colacthor_hora_inicio,
            colacthor_hora_fin,
            colegio:col_id (
              col_nombre
            ),
            actividad:act_id (
              act_nombre
            ),
            dia:dia_id (
              dia_nombre
            ),
            estado:est_id (
              est_nombre
            ),
            entrenador_asignacion!left (
              ent_id,
              entrenador:ent_id (
                ent_cedula,
                usuario!entrenador_ent_id_fkey (
                  usu_nombre,
                  usu_telefono,
                  usu_correo
                )
              )
            )
          `)
          .eq('entrenador_asignacion.est_id', 1)
          .is('entrenador_asignacion.entasig_fecha_fin', null);

        // Apply filters
        if (selectedSchool !== 'todos') {
          query = query.eq('col_id', parseInt(selectedSchool));
        }
        if (selectedActivity !== 'todas') {
          query = query.eq('act_id', parseInt(selectedActivity));
        }
        if (selectedDay !== 'todos') {
          query = query.eq('dia_id', parseInt(selectedDay));
        }
        if (selectedStatus !== 'todos') {
          query = query.eq('est_id', parseInt(selectedStatus));
        }

        const { data: disciplinesData, error } = await query
          .order('col_id')
          .order('act_id')
          .order('dia_id')
          .order('colacthor_hora_inicio');

        if (error) throw error;

        const excelData: any[] = [];

        disciplinesData?.forEach(discipline => {
          const schoolData = discipline.colegio as any;
          const activityData = discipline.actividad as any;
          const dayData = discipline.dia as any;
          const statusData = discipline.estado as any;

          const baseRow = {
            'Colegio': schoolData?.col_nombre || '',
            'Actividad': activityData?.act_nombre || '',
            'Día': dayData?.dia_nombre || '',
            'Hora Inicio': discipline.colacthor_hora_inicio || '',
            'Hora Fin': discipline.colacthor_hora_fin || '',
            'Estado': statusData?.est_nombre || ''
          };

          const assignments = discipline.entrenador_asignacion as any[];
          
          if (assignments && assignments.length > 0) {
            // Create one row per active coach
            assignments.forEach(assignment => {
              if (assignment && assignment.entrenador) {
                const entrenadorData = assignment.entrenador;
                const usuarioData = entrenadorData.usuario;
                
                excelData.push({
                  ...baseRow,
                  'Entrenador': usuarioData?.usu_nombre || '',
                  'Cédula': entrenadorData?.ent_cedula || '',
                  'Teléfono': usuarioData?.usu_telefono || '',
                  'Correo': usuarioData?.usu_correo || ''
                });
              }
            });
          } else {
            // No active coaches - keep row with empty coach fields
            excelData.push({
              ...baseRow,
              'Entrenador': '',
              'Cédula': '',
              'Teléfono': '',
              'Correo': ''
            });
          }
        });

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Disciplinas con Entrenadores');

        const currentDate = new Date().toISOString().split('T')[0];
        const filename = `disciplines_with_coaches_${currentDate}.xlsx`;

        XLSX.writeFile(workbook, filename);

        toast({
          title: "Éxito",
          description: `Reporte exportado como ${filename}`
        });

      } else {
        // Original query without coaches
        let query = supabase
          .from('colegio_actividad_horario')
          .select(`
            colacthor_hora_inicio,
            colacthor_hora_fin,
            colegio:col_id (
              col_nombre
            ),
            actividad:act_id (
              act_nombre
            ),
            dia:dia_id (
              dia_nombre
            ),
            estado:est_id (
              est_nombre
            )
          `);

        // Apply filters
        if (selectedSchool !== 'todos') {
          query = query.eq('col_id', parseInt(selectedSchool));
        }
        if (selectedActivity !== 'todas') {
          query = query.eq('act_id', parseInt(selectedActivity));
        }
        if (selectedDay !== 'todos') {
          query = query.eq('dia_id', parseInt(selectedDay));
        }
        if (selectedStatus !== 'todos') {
          query = query.eq('est_id', parseInt(selectedStatus));
        }

        const { data: disciplinesData, error } = await query
          .order('col_id')
          .order('act_id')
          .order('dia_id')
          .order('colacthor_hora_inicio');

        if (error) throw error;

        const excelData = disciplinesData?.map(discipline => {
          const schoolData = discipline.colegio as any;
          const activityData = discipline.actividad as any;
          const dayData = discipline.dia as any;
          const statusData = discipline.estado as any;

          return {
            'Colegio': schoolData?.col_nombre || '',
            'Actividad': activityData?.act_nombre || '',
            'Día': dayData?.dia_nombre || '',
            'Hora Inicio': discipline.colacthor_hora_inicio || '',
            'Hora Fin': discipline.colacthor_hora_fin || '',
            'Estado': statusData?.est_nombre || ''
          };
        }) || [];

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Disciplinas');

        const currentDate = new Date().toISOString().split('T')[0];
        const filename = `disciplines_${currentDate}.xlsx`;

        XLSX.writeFile(workbook, filename);

        toast({
          title: "Éxito",
          description: `Reporte exportado como ${filename}`
        });
      }
    } catch (error) {
      console.error('Error exporting disciplines:', error);
      toast({
        title: "Error",
        description: "Error al exportar el reporte de disciplinas",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Filtros de Reportería
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* School Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Colegio</label>
              <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar colegio" />
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
            </div>

            {/* Activity Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Actividad</label>
              <Select value={selectedActivity} onValueChange={setSelectedActivity}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar actividad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {activities?.map((activity) => (
                    <SelectItem key={activity.act_id} value={activity.act_id.toString()}>
                      {activity.act_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Día</label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar día" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {days?.map((day) => (
                    <SelectItem key={day.dia_id} value={day.dia_id.toString()}>
                      {day.dia_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter - Limited to Active/Inactive only */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="1">Activo</SelectItem>
                  <SelectItem value="2">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* View with Coaches Checkbox */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="viewWithCoaches" 
              checked={viewWithCoaches}
              className="dark:text-black"
              onCheckedChange={(checked) => {
                setViewWithCoaches(checked === true);
              }}
            />
            <label 
              htmlFor="viewWithCoaches" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Ver con Entrenadores Asignados
            </label>
          </div>
          
          {/* Export Button */}
          <div className="flex justify-start pt-4">
            <Button
              onClick={handleExportToExcel}
              disabled={isExporting}
              className="bg-[#FD5757] hover:bg-[#E04747]"
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? 'Exportando...' : 'Exportar a Excel'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DisciplinesReportsTab;
