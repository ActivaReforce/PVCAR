import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { formatInTimeZone } from 'date-fns-tz';

const StudentsReportsTab = () => {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    colegio: 'all',
    edad: 'all',
    transporte: 'all',
    grado: 'all',
    estado: '1' // Default to Active
  });
  const [includeDisciplines, setIncludeDisciplines] = useState(false);
  const [includeRepresentatives, setIncludeRepresentatives] = useState(true); // Default ON
  const [exporting, setExporting] = useState(false);

  // Fetch schools for filter
  const { data: schools } = useQuery({
    queryKey: ['schools-for-students-reports'],
    queryFn: async () => {
      const { data } = await supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .order('col_nombre');
      return data || [];
    }
  });

  // Fetch ages for filter
  const { data: ages } = useQuery({
    queryKey: ['ages-for-students-reports'],
    queryFn: async () => {
      const { data } = await supabase
        .from('nino')
        .select('nino_edad')
        .not('nino_edad', 'is', null)
        .order('nino_edad');
      
      const uniqueAges = [...new Set(data?.map(n => n.nino_edad) || [])];
      return uniqueAges.sort((a, b) => a - b);
    }
  });

  // Fetch grades for filter
  const { data: grades } = useQuery({
    queryKey: ['grades-for-students-reports'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categoria_nino_grado')
        .select('catninograd_id, catninograd_nombre')
        .order('catninograd_nombre');
      return data || [];
    }
  });

  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const buildStudentQuery = () => {
    let query = supabase
      .from('nino')
      .select(`
        nino_id,
        nino_nombre,
        nino_edad,
        nino_toma_transporte,
        nino_info_salud,
        nino_otra_info,
        nino_fecha_creacion,
        est_id,
        colegio!inner(col_nombre),
        categoria_nino_grado(catninograd_nombre)
      `);

    // Apply filters
    if (filters.colegio !== 'all') {
      query = query.eq('col_id', parseInt(filters.colegio));
    }
    if (filters.edad !== 'all') {
      query = query.eq('nino_edad', parseInt(filters.edad));
    }
    if (filters.transporte !== 'all') {
      query = query.eq('nino_toma_transporte', filters.transporte === 'true');
    }
    if (filters.grado !== 'all') {
      query = query.eq('catninograd_id', parseInt(filters.grado));
    }
    if (filters.estado !== 'all') {
      query = query.eq('est_id', parseInt(filters.estado));
    }

    return query.order('nino_nombre');
  };

  const getRepresentativeInfo = async (ninoId: number) => {
    if (!includeRepresentatives) return { representantes: '', sectores: '' };

    const { data: representatives } = await supabase
      .from('nino_padre')
      .select(`
        padre!inner(
          padre_sector_residencia,
          usuario!inner(usu_nombre)
        )
      `)
      .eq('nino_id', ninoId);

    const representativeNames = representatives?.map(rep => rep.padre?.usuario?.usu_nombre).filter(Boolean) || [];
    const sectors = representatives?.map(rep => rep.padre?.padre_sector_residencia).filter(Boolean) || [];
    const uniqueSectors = [...new Set(sectors)];

    return {
      representantes: representativeNames.join(', '),
      sectores: uniqueSectors.join(', ')
    };
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      // Get filtered students
      const { data: students, error: studentsError } = await buildStudentQuery();
      
      if (studentsError) throw studentsError;

      if (!students || students.length === 0) {
        toast({
          title: "Sin datos",
          description: "No hay alumnos que coincidan con los filtros seleccionados",
          variant: "destructive",
        });
        return;
      }

      const exportData = [];

      if (includeDisciplines) {
        // Export with disciplines - one row per discipline
        for (const student of students) {
          const { data: assignments } = await supabase
            .from('nino_asignacion')
            .select(`
              colegio_actividad_horario!inner(
                colacthor_hora_inicio,
                colacthor_hora_fin,
                actividad!inner(act_nombre),
                dia(dia_nombre)
              )
            `)
            .eq('nino_id', student.nino_id)
            .eq('est_id', 1); // Only active assignments

          const repInfo = await getRepresentativeInfo(student.nino_id);

          if (assignments && assignments.length > 0) {
            for (const assignment of assignments) {
              const cahData = assignment.colegio_actividad_horario as any;
              const rowData: any = {
                'Nombre': student.nino_nombre,
                'Edad': student.nino_edad,
                'Colegio': student.colegio?.col_nombre || '',
                'Grado': student.categoria_nino_grado?.catninograd_nombre || '',
                'Toma Transporte': student.nino_toma_transporte ? 'Sí' : 'No',
                'Estado': student.est_id === 1 ? 'Activo' : 'Inactivo',
                'Información de Salud': student.nino_info_salud || '',
                'Otra Información': student.nino_otra_info || '',
                'Fecha de Creación': student.nino_fecha_creacion ? formatInTimeZone(new Date(student.nino_fecha_creacion), 'America/Guayaquil', 'dd/MM/yyyy HH:mm') : '',
                'Actividad': cahData?.actividad?.act_nombre || '',
                'Día': cahData?.dia?.dia_nombre || '',
                'Hora Inicio': cahData?.colacthor_hora_inicio || '',
                'Hora Fin': cahData?.colacthor_hora_fin || ''
              };

              if (includeRepresentatives) {
                rowData['Representante'] = repInfo.representantes;
                rowData['Sector de residencia'] = repInfo.sectores;
              }

              exportData.push(rowData);
            }
          } else {
            // Student with no disciplines
            const rowData: any = {
              'Nombre': student.nino_nombre,
              'Edad': student.nino_edad,
              'Colegio': student.colegio?.col_nombre || '',
              'Grado': student.categoria_nino_grado?.catninograd_nombre || '',
              'Toma Transporte': student.nino_toma_transporte ? 'Sí' : 'No',
              'Estado': student.est_id === 1 ? 'Activo' : 'Inactivo',
              'Información de Salud': student.nino_info_salud || '',
              'Otra Información': student.nino_otra_info || '',
              'Fecha de Creación': student.nino_fecha_creacion ? formatInTimeZone(new Date(student.nino_fecha_creacion), 'America/Guayaquil', 'dd/MM/yyyy HH:mm') : '',
              'Actividad': 'Sin disciplinas',
              'Día': '',
              'Hora Inicio': '',
              'Hora Fin': ''
            };

            if (includeRepresentatives) {
              rowData['Representante'] = repInfo.representantes;
              rowData['Sector de residencia'] = repInfo.sectores;
            }

            exportData.push(rowData);
          }
        }
      } else {
        // Export only student data
        for (const student of students) {
          const repInfo = await getRepresentativeInfo(student.nino_id);
          
          const rowData: any = {
            'Nombre': student.nino_nombre,
            'Edad': student.nino_edad,
            'Colegio': student.colegio?.col_nombre || '',
            'Grado': student.categoria_nino_grado?.catninograd_nombre || '',
            'Toma Transporte': student.nino_toma_transporte ? 'Sí' : 'No',
            'Estado': student.est_id === 1 ? 'Activo' : 'Inactivo',
            'Información de Salud': student.nino_info_salud || '',
            'Otra Información': student.nino_otra_info || '',
            'Fecha de Creación': student.nino_fecha_creacion ? formatInTimeZone(new Date(student.nino_fecha_creacion), 'America/Guayaquil', 'dd/MM/yyyy HH:mm') : ''
          };

          if (includeRepresentatives) {
            rowData['Representante'] = repInfo.representantes;
            rowData['Sector de residencia'] = repInfo.sectores;
          }

          exportData.push(rowData);
        }
      }

      // Create workbook and export
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
      
      const filename = `alumnos_reporte_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast({
        title: "Éxito",
        description: `Reporte exportado: ${exportData.length} registros`,
      });
    } catch (error) {
      console.error("Error exporting students report:", error);
      toast({
        title: "Error",
        description: "Error al exportar el reporte de alumnos",
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
            Reporte de Alumnos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* School Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Colegio</label>
              <Select value={filters.colegio} onValueChange={(value) => handleFilterChange('colegio', value)}>
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

            {/* Age Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Edad</label>
              <Select value={filters.edad} onValueChange={(value) => handleFilterChange('edad', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar edad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {ages?.map((age) => (
                    <SelectItem key={age} value={age.toString()}>
                      {age} años
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transport Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Toma Transporte</label>
              <Select value={filters.transporte} onValueChange={(value) => handleFilterChange('transporte', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar transporte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="true">Sí</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grade Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Grado</label>
              <Select value={filters.grado} onValueChange={(value) => handleFilterChange('grado', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar grado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {grades?.map((grade) => (
                    <SelectItem key={grade.catninograd_id} value={grade.catninograd_id.toString()}>
                      {grade.catninograd_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={filters.estado} onValueChange={(value) => handleFilterChange('estado', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="1">Activo</SelectItem>
                  <SelectItem value="2">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="include-disciplines"
                checked={includeDisciplines}
                onCheckedChange={(checked) => setIncludeDisciplines(checked === true)}
              />
              <label 
                htmlFor="include-disciplines" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Ver disciplinas de cada alumno
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="include-representatives"
                checked={includeRepresentatives}
                onCheckedChange={(checked) => setIncludeRepresentatives(checked === true)}
              />
              <label 
                htmlFor="include-representatives" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Ver representantes
              </label>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex justify-start">
            <Button 
              onClick={exportToExcel}
              disabled={exporting}
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

export default StudentsReportsTab;
