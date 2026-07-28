
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { formatTimeForDisplay } from '@/components/attendance/TimezoneUtils';

const AttendanceCoachesReportsTab = () => {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: new Date().toISOString().split('T')[0],
    school: 'all',
    status: 'all',
    dayOfWeek: 'all'
  });
  const [includeRegisteredUser, setIncludeRegisteredUser] = useState(false);
  const [includeRegistrationDate, setIncludeRegistrationDate] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Fetch schools for filter
  const { data: schools } = useQuery({
    queryKey: ['schools-for-trainer-reports'],
    queryFn: async () => {
      const { data } = await supabase
        .from('entrenador_asignacion')
        .select(`
          colegio_actividad_horario!inner(
            colegio!inner(col_id, col_nombre)
          )
        `)
        .eq('est_id', 1);

      if (!data) return [];

      const uniqueSchools = data.reduce((acc: any[], curr) => {
        const colegio = (curr.colegio_actividad_horario as any)?.colegio;
        if (colegio && !acc.find(s => s.col_id === colegio.col_id)) {
          acc.push(colegio);
        }
        return acc;
      }, []);

      return uniqueSchools.sort((a, b) => a.col_nombre.localeCompare(b.col_nombre));
    }
  });

  // Fetch attendance statuses for filter
  const { data: attendanceStatuses } = useQuery({
    queryKey: ['attendance-statuses'],
    queryFn: async () => {
      const { data } = await supabase
        .from('asistencia_estado')
        .select('asisest_id, asisest_nombre')
        .order('asisest_id');
      return data || [];
    }
  });

  // Fetch days of week for filter
  const { data: daysOfWeek } = useQuery({
    queryKey: ['days-of-week'],
    queryFn: async () => {
      const { data } = await supabase
        .from('dia')
        .select('dia_id, dia_nombre')
        .order('dia_id');
      return data || [];
    }
  });

  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const exportToExcel = async () => {
    if (!filters.dateFrom || !filters.dateTo) {
      toast({
        title: "Error",
        description: "Por favor selecciona las fechas de inicio y fin",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      // Build query for trainer attendance data
      let query = supabase
        .from('asistencia_entrenador')
        .select(`
          asisent_fecha,
          asisent_hora_tarde,
          asisent_razon_justificado,
          asisent_fecha_registrado,
          usu_registrador,
          ent_id,
          asisest_id,
          col_id
        `);

      // Apply date filters
      query = query
        .gte('asisent_fecha', filters.dateFrom)
        .lte('asisent_fecha', filters.dateTo);

      // Get trainer-to-school mapping for filtering
      const trainerSchoolMap: { [key: number]: number } = {};
      if (filters.school !== 'all' || filters.dayOfWeek !== 'all') {
        const { data: assignments } = await supabase
          .from('entrenador_asignacion')
          .select(`
            ent_id,
            colegio_actividad_horario!inner(
              col_id,
              dia_id
            )
          `)
          .eq('est_id', 1);

        if (assignments) {
          assignments.forEach(assignment => {
            const cah = assignment.colegio_actividad_horario as any;
            if (filters.school === 'all' || cah.col_id.toString() === filters.school) {
              if (filters.dayOfWeek === 'all' || cah.dia_id.toString() === filters.dayOfWeek) {
                trainerSchoolMap[assignment.ent_id] = cah.col_id;
              }
            }
          });
        }
      }

      const { data: attendanceData, error } = await query.order('asisent_fecha', { ascending: false });

      if (error) throw error;

      if (!attendanceData || attendanceData.length === 0) {
        toast({
          title: "Sin datos",
          description: "No hay registros de asistencia que coincidan con los filtros seleccionados",
          variant: "destructive",
        });
        return;
      }

      // Get trainer names directly from usuario table using ent_id
      const trainerIds = [...new Set(attendanceData.map(record => record.ent_id).filter(Boolean))];
      const { data: trainers } = await supabase
        .from('usuario')
        .select('usu_id, usu_nombre')
        .in('usu_id', trainerIds);

      const trainerNames: { [key: number]: string } = {};
      if (trainers) {
        trainers.forEach(trainer => {
          trainerNames[trainer.usu_id] = trainer.usu_nombre;
        });
      }

      // Get attendance status names
      const statusNames: { [key: number]: string } = {};
      if (attendanceStatuses) {
        attendanceStatuses.forEach(status => {
          statusNames[status.asisest_id] = status.asisest_nombre;
        });
      }

      // Get registering user names separately if needed
      const registradorNames: { [key: number]: string } = {};
      if (includeRegisteredUser) {
        const registradorIds = [...new Set(attendanceData.map(record => record.usu_registrador).filter(Boolean))];
        if (registradorIds.length > 0) {
          const { data: registradores } = await supabase
            .from('usuario')
            .select('usu_id, usu_nombre')
            .in('usu_id', registradorIds);

          if (registradores) {
            registradores.forEach(reg => {
              registradorNames[reg.usu_id] = reg.usu_nombre;
            });
          }
        }
      }

      // Get school names for col_ids found in attendance records
      const schoolIds = [...new Set(attendanceData.map(record => record.col_id).filter(Boolean))];
      const { data: schoolsData } = await supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .in('col_id', schoolIds);

      const schoolNames: { [key: number]: string } = {};
      if (schoolsData) {
        schoolsData.forEach(school => {
          schoolNames[school.col_id] = school.col_nombre;
        });
      }

      // Helper function to get day name from date
      const getDayNameFromDate = (dateString: string): string => {
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        if (!dateString) return '';
        // Parse date components manually to avoid timezone issues
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return dayNames[date.getDay()] || '';
      };

      // Filter data based on school and day filters
      let filteredData = attendanceData;
      if (filters.school !== 'all' || filters.dayOfWeek !== 'all') {
        filteredData = attendanceData.filter(record => {
          const entId = record.ent_id;
          return entId && trainerSchoolMap[entId];
        });
      }

      // Filter by attendance status
      if (filters.status !== 'all') {
        filteredData = filteredData.filter(record => 
          record.asisest_id.toString() === filters.status
        );
      }

      // Prepare export data
      const exportData = filteredData.map(record => {
        const rowData: any = {
          'Fecha de Asistencia': record.asisent_fecha || '',
          'Colegio': schoolNames[record.col_id] || 'Sin asignar',
          'Día': getDayNameFromDate(record.asisent_fecha),
          'Nombre del Entrenador': trainerNames[record.ent_id] || '',
          'Estado de Asistencia': statusNames[record.asisest_id] || '',
          'Hora de Llegada Tarde': record.asisent_hora_tarde ? formatTimeForDisplay(record.asisent_hora_tarde) : '',
          'Justificación': record.asisent_razon_justificado || ''
        };

        if (includeRegisteredUser) {
          rowData['Usuario Registrador'] = registradorNames[record.usu_registrador] || '';
        }

        if (includeRegistrationDate) {
          rowData['Fecha de Registro'] = record.asisent_fecha_registrado ? 
            new Date(record.asisent_fecha_registrado).toLocaleString('es-EC', {
              timeZone: 'America/Guayaquil',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }) : '';
        }

        return rowData;
      });

      // Create workbook and export
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, 'Asistencia Entrenadores');
      
      const filename = `asistencia_entrenadores_${filters.dateFrom}_${filters.dateTo}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast({
        title: "Éxito",
        description: `Reporte exportado: ${exportData.length} registros`,
      });
    } catch (error) {
      console.error("Error exporting trainer attendance report:", error);
      toast({
        title: "Error",
        description: "Error al exportar el reporte de asistencia de entrenadores",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Reporte de Asistencia - Entrenadores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Filters - First Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-from">Fecha Desde *</Label>
              <Input
                id="date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-to">Fecha Hasta *</Label>
              <Input
                id="date-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Other Filters - Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* School Filter */}
            <div className="space-y-2">
              <Label>Colegio</Label>
              <Select value={filters.school} onValueChange={(value) => handleFilterChange('school', value)}>
                <SelectTrigger>
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

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Estado de Asistencia</Label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {attendanceStatuses?.map((status) => (
                    <SelectItem key={status.asisest_id} value={status.asisest_id.toString()}>
                      {status.asisest_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day of Week Filter */}
            <div className="space-y-2">
              <Label>Día de la Semana</Label>
              <Select value={filters.dayOfWeek} onValueChange={(value) => handleFilterChange('dayOfWeek', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar día" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {daysOfWeek?.map((day) => (
                    <SelectItem key={day.dia_id} value={day.dia_id.toString()}>
                      {day.dia_nombre.charAt(0).toUpperCase() + day.dia_nombre.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="include-registered-user"
                checked={includeRegisteredUser}
                onCheckedChange={(checked) => setIncludeRegisteredUser(checked === true)}
              />
              <Label 
                htmlFor="include-registered-user" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Incluir Usuario Registrador
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="include-registration-date"
                checked={includeRegistrationDate}
                onCheckedChange={(checked) => setIncludeRegistrationDate(checked === true)}
              />
              <Label 
                htmlFor="include-registration-date" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Incluir Fecha de Registro
              </Label>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex justify-start">
            <Button 
              onClick={exportToExcel}
              disabled={exporting || !filters.dateFrom || !filters.dateTo}
              className="bg-[#FD5757] hover:bg-[#E04747] flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exportando...' : 'Exportar a Excel'}
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceCoachesReportsTab;
