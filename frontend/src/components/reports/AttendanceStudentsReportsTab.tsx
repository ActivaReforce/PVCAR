import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Download, FileSpreadsheet, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface School {
  col_id: number;
  col_nombre: string;
}

interface AttendanceStatus {
  asisest_id: number;
  asisest_nombre: string;
}

interface Day {
  dia_id: number;
  dia_nombre: string;
}

interface Discipline {
  colacthor_id: number;
  label: string;
  act_nombre: string;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
}

interface AttendanceRecord {
  asisnino_fecha: string;
  col_nombre: string;
  act_nombre: string;
  dia_nombre: string;
  colacthor_hora_inicio: string;
  colacthor_hora_fin: string;
  nino_nombre: string;
  asisest_nombre: string;
  asisnino_hora_tarde?: string;
  asisnino_razon_justificado?: string;
  usu_nombre?: string;
  asisnino_fecha_registrado?: string;
}

const AttendanceStudentsReportsTab = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [attendanceStatuses, setAttendanceStatuses] = useState<AttendanceStatus[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [includeRegistrar, setIncludeRegistrar] = useState(false);
  const [includeRegisteredAt, setIncludeRegisteredAt] = useState(false);
  
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedSchool && selectedSchool !== 'all') {
      loadDisciplines();
    } else {
      setDisciplines([]);
      setSelectedDiscipline('all');
    }
  }, [selectedSchool]);

  const loadInitialData = async () => {
    try {
      // Load schools
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .order('col_nombre');

      if (schoolsError) throw schoolsError;
      setSchools(schoolsData || []);

      // Load attendance statuses
      const { data: statusesData, error: statusesError } = await supabase
        .from('asistencia_estado')
        .select('asisest_id, asisest_nombre')
        .order('asisest_nombre');

      if (statusesError) throw statusesError;
      setAttendanceStatuses(statusesData || []);

      // Load days
      const { data: daysData, error: daysError } = await supabase
        .from('dia')
        .select('dia_id, dia_nombre')
        .order('dia_id');

      if (daysError) throw daysError;
      setDays(daysData || []);

    } catch (error) {
      console.error('Error loading initial data:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar los datos iniciales',
        variant: 'destructive'
      });
    }
  };

  const loadDisciplines = async () => {
    if (!selectedSchool || selectedSchool === 'all') return;

    try {
      const { data: disciplinesData, error } = await supabase
        .from('colegio_actividad_horario')
        .select(`
          colacthor_id,
          colacthor_hora_inicio,
          colacthor_hora_fin,
          actividad!inner (act_nombre),
          dia!inner (dia_nombre)
        `)
        .eq('col_id', parseInt(selectedSchool))
        .eq('est_id', 1)
        .order('dia_id')
        .order('colacthor_hora_inicio');

      if (error) throw error;

      const formattedDisciplines: Discipline[] = (disciplinesData || []).map(d => ({
        colacthor_id: d.colacthor_id,
        act_nombre: d.actividad.act_nombre,
        dia_nombre: d.dia.dia_nombre,
        hora_inicio: d.colacthor_hora_inicio?.substring(0, 5) || '',
        hora_fin: d.colacthor_hora_fin?.substring(0, 5) || '',
        label: `${d.actividad.act_nombre} — ${d.dia.dia_nombre} — ${d.colacthor_hora_inicio?.substring(0, 5) || ''}–${d.colacthor_hora_fin?.substring(0, 5) || ''}`
      }));

      setDisciplines(formattedDisciplines);

    } catch (error) {
      console.error('Error loading disciplines:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar las disciplinas',
        variant: 'destructive'
      });
    }
  };

  const loadAttendanceDataAndExport = async () => {
    if (!fromDate || !toDate) {
      toast({
        title: 'Validación',
        description: 'Por favor selecciona ambas fechas (Desde y Hasta)',
        variant: 'destructive'
      });
      return;
    }

    setExporting(true);
    try {
      // Build a fresh query with all active filters (reused per page)
      const buildQuery = () => {
        let q = supabase
          .from('asistencia_nino')
          .select(`
            asisnino_fecha,
            asisnino_hora_tarde,
            asisnino_razon_justificado,
            asisnino_fecha_registrado,
            usu_registrador,
            nino!inner (
              nino_nombre,
              col_id,
              colegio!inner (
                col_nombre
              )
            ),
            asistencia_estado!inner (
              asisest_nombre
            ),
            colegio_actividad_horario!inner (
              colacthor_hora_inicio,
              colacthor_hora_fin,
              actividad!inner (
                act_nombre
              ),
              dia!inner (
                dia_nombre,
                dia_id
              )
            )
          `)
          .gte('asisnino_fecha', format(fromDate, 'yyyy-MM-dd'))
          .lte('asisnino_fecha', format(toDate, 'yyyy-MM-dd'))
          .order('asisnino_fecha', { ascending: true });

        if (selectedSchool !== 'all') {
          q = q.eq('nino.col_id', parseInt(selectedSchool));
        }
        if (selectedDiscipline !== 'all') {
          q = q.eq('colacthor_id', parseInt(selectedDiscipline));
        }
        if (selectedStatus !== 'all') {
          q = q.eq('asisest_id', parseInt(selectedStatus));
        }
        if (selectedDay !== 'all') {
          q = q.eq('colegio_actividad_horario.dia_id', parseInt(selectedDay));
        }
        return q;
      };

      // Paginate to bypass Supabase's 1000-row default cap and fetch all rows
      const PAGE_SIZE = 1000;
      let attendanceRecords: any[] = [];
      let page = 0;
      while (true) {
        const from = page * PAGE_SIZE;
        const { data: pageData, error } = await buildQuery()
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!pageData || pageData.length === 0) break;

        attendanceRecords = attendanceRecords.concat(pageData);
        if (pageData.length < PAGE_SIZE) break;
        page++;
      }

      if (!attendanceRecords || attendanceRecords.length === 0) {
        toast({
          title: 'Sin datos',
          description: 'No hay registros de asistencia que coincidan con los filtros seleccionados',
          variant: 'destructive'
        });
        return;
      }

      // If we need registrar info, fetch it separately
      let registrarData: { [key: number]: string } = {};
      if (includeRegistrar && attendanceRecords && attendanceRecords.length > 0) {
        const registradorIds = [...new Set(attendanceRecords.map(r => r.usu_registrador).filter(Boolean))];
        
        if (registradorIds.length > 0) {
          const { data: usuarios, error: usuariosError } = await supabase
            .from('usuario')
            .select('usu_id, usu_nombre')
            .in('usu_id', registradorIds);

          if (!usuariosError && usuarios) {
            registrarData = usuarios.reduce((acc, user) => {
              acc[user.usu_id] = user.usu_nombre;
              return acc;
            }, {} as { [key: number]: string });
          }
        }
      }

      const formattedData: AttendanceRecord[] = (attendanceRecords || []).map(record => ({
        asisnino_fecha: record.asisnino_fecha,
        col_nombre: record.nino.colegio.col_nombre,
        act_nombre: record.colegio_actividad_horario.actividad.act_nombre,
        dia_nombre: record.colegio_actividad_horario.dia.dia_nombre,
        colacthor_hora_inicio: record.colegio_actividad_horario.colacthor_hora_inicio?.substring(0, 5) || '',
        colacthor_hora_fin: record.colegio_actividad_horario.colacthor_hora_fin?.substring(0, 5) || '',
        nino_nombre: record.nino.nino_nombre,
        asisest_nombre: record.asistencia_estado.asisest_nombre,
        asisnino_hora_tarde: record.asisnino_hora_tarde || '',
        asisnino_razon_justificado: record.asisnino_razon_justificado || '',
        usu_nombre: includeRegistrar ? registrarData[record.usu_registrador] || '' : undefined,
        asisnino_fecha_registrado: record.asisnino_fecha_registrado || undefined
      }));

      // Export to Excel
      const exportData = formattedData.map(record => {
        const baseData = {
          'Fecha de Asistencia': record.asisnino_fecha.split('-').reverse().join('/'),
          'Colegio': record.col_nombre,
          'Actividad': record.act_nombre,
          'Día': record.dia_nombre.charAt(0).toUpperCase() + record.dia_nombre.slice(1),
          'Horario': `${record.colacthor_hora_inicio}–${record.colacthor_hora_fin}`,
          'Nombre del Alumno': record.nino_nombre,
          'Estado de Asistencia': record.asisest_nombre,
          'Hora de Llegada': record.asisnino_hora_tarde || '',
          'Justificación': record.asisnino_razon_justificado || ''
        };

        if (includeRegistrar && record.usu_nombre !== undefined) {
          (baseData as any)['Usuario Registrador'] = record.usu_nombre;
        }

        if (includeRegisteredAt && record.asisnino_fecha_registrado) {
          // Convert to Ecuador timezone for export
          const ecuadorTime = new Date(record.asisnino_fecha_registrado).toLocaleString('es-ES', {
            timeZone: 'America/Guayaquil',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          (baseData as any)['Fecha que se Registró'] = ecuadorTime;
        }

        return baseData;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Asistencia Alumno');

      const fileName = `Reporte_Asistencia_Alumnos_${format(fromDate!, 'yyyy-MM-dd')}_a_${format(toDate!, 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: 'Éxito',
        description: `Reporte exportado correctamente con ${formattedData.length} registros`
      });

    } catch (error) {
      console.error('Error loading attendance data:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar los datos de asistencia',
        variant: 'destructive'
      });
    } finally {
      setExporting(false);
    }
  };

  const handleIncludeRegistrarChange = (checked: boolean | 'indeterminate') => {
    setIncludeRegistrar(checked === true);
  };

  const handleIncludeRegisteredAtChange = (checked: boolean | 'indeterminate') => {
    setIncludeRegisteredAt(checked === true);
  };

  const canExport = fromDate && toDate && !exporting;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Reportes de Asistencia de Alumnos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Range */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha Desde *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fromDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={fromDate}
                    onSelect={setFromDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>Fecha Hasta *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !toDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={toDate}
                    onSelect={setToDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Colegio</Label>
              <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los colegios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los colegios</SelectItem>
                  {schools.map(school => (
                    <SelectItem key={school.col_id} value={school.col_id.toString()}>
                      {school.col_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Disciplina</Label>
              <Select 
                value={selectedDiscipline} 
                onValueChange={setSelectedDiscipline}
                disabled={selectedSchool === 'all'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las disciplinas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las disciplinas</SelectItem>
                  {disciplines.map(discipline => (
                    <SelectItem key={discipline.colacthor_id} value={discipline.colacthor_id.toString()}>
                      {discipline.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estado de Asistencia</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {attendanceStatuses.map(status => (
                    <SelectItem key={status.asisest_id} value={status.asisest_id.toString()}>
                      {status.asisest_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Día de la Semana</Label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los días" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los días</SelectItem>
                  {days.map(day => (
                    <SelectItem key={day.dia_id} value={day.dia_id.toString()}>
                      {day.dia_nombre.charAt(0).toUpperCase() + day.dia_nombre.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional Options */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="include-registrar" 
                checked={includeRegistrar}
                onCheckedChange={handleIncludeRegistrarChange}
              />
              <Label htmlFor="include-registrar">Incluir Usuario Registrador</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="include-registered-at" 
                checked={includeRegisteredAt}
                onCheckedChange={handleIncludeRegisteredAtChange}
              />
              <Label htmlFor="include-registered-at">Incluir Fecha que se Registró</Label>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex justify-start">
            <Button 
              onClick={loadAttendanceDataAndExport} 
              disabled={!canExport}
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

export default AttendanceStudentsReportsTab;
