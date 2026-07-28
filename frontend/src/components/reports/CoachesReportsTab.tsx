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

const CoachesReportsTab = () => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [selectedTrainerState, setSelectedTrainerState] = useState<string>('1'); // Default to Active
  const [incluirAuxiliares, setIncluirAuxiliares] = useState(false);

  // Fetch schools for the filter
  const { data: schools } = useQuery({
    queryKey: ['schools-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .order('col_nombre');

      if (error) throw error;
      return data || [];
    }
  });

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      // First, get coaches that match the filters
      let coachIds: number[] = [];
      
      if (selectedSchool && selectedSchool !== 'all') {
        // If a school is selected, get coaches that have assignments in that school
        const schoolId = parseInt(selectedSchool, 10);
        
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('entrenador_asignacion')
          .select(`
            ent_id,
            colegio_actividad_horario!inner(col_id)
          `)
          .eq('colegio_actividad_horario.col_id', schoolId)
          .eq('est_id', 1); // Only active assignments

        if (assignmentsError) throw assignmentsError;

        // Extract unique coach IDs
        coachIds = [...new Set(assignmentsData?.map(a => a.ent_id).filter(Boolean) || [])];
      }

      // Build the main query for coaches
      let query = supabase
        .from('entrenador')
        .select(`
          ent_id,
          ent_cedula,
          ent_fecha_creacion,
          ent_fecha_modificacion,
          est_id,
          usuario!entrenador_ent_id_fkey (
            usu_nombre,
            usu_correo,
            usu_telefono
          ),
          estado:est_id (
            est_nombre
          )
        `);

      // Apply trainer state filter
      if (selectedTrainerState && selectedTrainerState !== 'all') {
        const stateId = parseInt(selectedTrainerState, 10);
        query = query.eq('est_id', stateId);
      }

      // Apply school filter if specific coaches were found
      if (selectedSchool !== 'all' && coachIds.length > 0) {
        query = query.in('ent_id', coachIds);
      } else if (selectedSchool !== 'all' && coachIds.length === 0) {
        // No coaches found for this school, return empty result
        const excelData: any[] = [];
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Entrenadores');

        const currentDate = new Date().toISOString().split('T')[0];
        const schoolSuffix = `_${schools?.find(s => s.col_id.toString() === selectedSchool)?.col_nombre?.replace(/\s+/g, '_')}`;
        const stateSuffix = selectedTrainerState !== 'all' ? `_${selectedTrainerState === '1' ? 'activos' : 'inactivos'}` : '';
        const filename = `entrenadores${schoolSuffix}${stateSuffix}_${currentDate}.xlsx`;

        XLSX.writeFile(workbook, filename);

        toast({
          title: "Éxito",
          description: `Reporte exportado como ${filename} (sin datos para los filtros seleccionados)`
        });
        return;
      }

      const { data: coachesData, error: coachesError } = await query;

      if (coachesError) throw coachesError;

      // Now get school assignments for each coach to populate the Colegio column
      const excelData: any[] = [];
      
      for (const coach of coachesData || []) {
        const userData = coach.usuario as any;
        const estadoData = coach.estado as any;
        
        let colegioNames = '';
        
        if (selectedSchool !== 'all') {
          // If a specific school is selected, use that school's name
          const selectedSchoolData = schools?.find(s => s.col_id.toString() === selectedSchool);
          colegioNames = selectedSchoolData?.col_nombre || '';
        } else {
          // If "Todos" is selected, get all schools this coach is assigned to
          const { data: assignmentsData } = await supabase
            .from('entrenador_asignacion')
            .select(`
              colegio_actividad_horario!inner(
                colegio!inner(col_nombre)
              )
            `)
            .eq('ent_id', coach.ent_id)
            .eq('est_id', 1); // Only active assignments

          if (assignmentsData && assignmentsData.length > 0) {
            // Extract unique school names
            const schoolNames = [...new Set(
              assignmentsData
                .map(a => (a.colegio_actividad_horario as any)?.colegio?.col_nombre)
                .filter(Boolean)
            )];
            colegioNames = schoolNames.join(', ');
          }
        }

        // Initialize auxiliary data
        let auxiliarNombre = '';
        let auxiliarRol = '';

        // If incluir auxiliares is checked, get auxiliary data
        if (incluirAuxiliares) {
          const { data: auxiliaryData } = await supabase
            .from('entrenador_auxiliar')
            .select(`
              usuario!entrenador_auxiliar_usu_id_fkey (
                usu_nombre
              ),
              rol!entrenador_auxiliar_rol_id_fkey (
                rol_titulo
              )
            `)
            .eq('ent_id', coach.ent_id)
            .eq('est_id', 1)
            .limit(1)
            .single();

          if (auxiliaryData) {
            const usuarioData = auxiliaryData.usuario as any;
            const rolData = auxiliaryData.rol as any;
            auxiliarNombre = usuarioData?.usu_nombre || '';
            auxiliarRol = rolData?.rol_titulo || '';
          }
        }

        const rowData: any = {
          'Entrenador': userData?.usu_nombre || '',
          'Estado Entrenador': estadoData?.est_nombre || '',
          'Colegio': colegioNames,
          'Cédula': coach.ent_cedula || '',
          'Correo': userData?.usu_correo || '',
          'Teléfono': userData?.usu_telefono || '',
          'Fecha Creación': coach.ent_fecha_creacion ? new Date(coach.ent_fecha_creacion).toLocaleDateString() : '',
          'Fecha Modificación': coach.ent_fecha_modificacion ? new Date(coach.ent_fecha_modificacion).toLocaleDateString() : ''
        };

        // Add auxiliary columns if requested
        if (incluirAuxiliares) {
          rowData['Nombre Auxiliar'] = auxiliarNombre;
          rowData['Rol Auxiliar'] = auxiliarRol;
        }
        
        excelData.push(rowData);
      }

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Entrenadores');

      const currentDate = new Date().toISOString().split('T')[0];
      const schoolSuffix = selectedSchool !== 'all' ? `_${schools?.find(s => s.col_id.toString() === selectedSchool)?.col_nombre?.replace(/\s+/g, '_')}` : '';
      const stateSuffix = selectedTrainerState !== 'all' ? `_${selectedTrainerState === '1' ? 'activos' : 'inactivos'}` : '';
      const filename = `entrenadores${schoolSuffix}${stateSuffix}_${currentDate}.xlsx`;

      XLSX.writeFile(workbook, filename);

      toast({
        title: "Éxito",
        description: `Reporte exportado como ${filename}`
      });
    } catch (error) {
      console.error('Error exporting coaches:', error);
      toast({
        title: "Error",
        description: "Error al exportar el reporte de entrenadores",
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
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Filtrar por Colegio
                </label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
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
              
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Estado del Entrenador
                </label>
                <Select value={selectedTrainerState} onValueChange={setSelectedTrainerState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Activos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="1">Activos</SelectItem>
                    <SelectItem value="2">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* New Incluir Auxiliares checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="incluir-auxiliares"
                checked={incluirAuxiliares}
                onCheckedChange={(checked) => setIncluirAuxiliares(checked === true)}
              />
              <label
                htmlFor="incluir-auxiliares"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Incluir Auxiliares
              </label>
            </div>
          </div>
          
          <div className="flex justify-start">
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

export default CoachesReportsTab;
