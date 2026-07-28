
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

const SchoolReportsTab = () => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  
  // Filter states
  const [includeFullInfo, setIncludeFullInfo] = useState(true);
  const [includeCoordinators, setIncludeCoordinators] = useState(true);
  const [includeDisciplinesCount, setIncludeDisciplinesCount] = useState(true);

  // Handler functions to convert CheckedState to boolean
  const handleFullInfoChange = (checked: boolean | "indeterminate") => {
    setIncludeFullInfo(checked === true);
  };

  const handleCoordinatorsChange = (checked: boolean | "indeterminate") => {
    setIncludeCoordinators(checked === true);
  };

  const handleDisciplinesCountChange = (checked: boolean | "indeterminate") => {
    setIncludeDisciplinesCount(checked === true);
  };

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      // Base schools query
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('colegio')
        .select('*')
        .order('col_fecha_creacion', { ascending: false });

      if (schoolsError) throw schoolsError;

      let excelData = schoolsData?.map(school => {
        const baseData: any = {};
        
        // Include full info if enabled
        if (includeFullInfo) {
          baseData['ID Colegio'] = school.col_id;
          baseData['Nombre'] = school.col_nombre;
          baseData['Dirección'] = school.col_direccion;
          baseData['Representante Nombre'] = school.col_rep_nombre || '';
          baseData['Representante Email'] = school.col_rep_email || '';
          baseData['Representante Teléfono'] = school.col_rep_telefono || '';
          baseData['Representante Foto'] = school.col_rep_foto || '';
          baseData['Fecha Creación'] = school.col_fecha_creacion ? new Date(school.col_fecha_creacion).toLocaleDateString() : '';
          baseData['Fecha Modificación'] = school.col_fecha_modificacion ? new Date(school.col_fecha_modificacion).toLocaleDateString() : '';
        }
        
        return baseData;
      }) || [];

      // Add coordinators if enabled
      if (includeCoordinators) {
        const { data: coordinatorsData, error: coordinatorsError } = await supabase
          .from('colegio_coordinador')
          .select(`
            col_id,
            usuario:usu_id (
              usu_nombre
            )
          `);

        if (coordinatorsError) throw coordinatorsError;

        // Group coordinators by school
        const coordinatorsBySchool: Record<number, string[]> = {};
        coordinatorsData?.forEach(coordinator => {
          const userData = coordinator.usuario as any;
          if (!coordinatorsBySchool[coordinator.col_id]) {
            coordinatorsBySchool[coordinator.col_id] = [];
          }
          if (userData?.usu_nombre) {
            coordinatorsBySchool[coordinator.col_id].push(userData.usu_nombre);
          }
        });

        // Add coordinators column
        excelData = excelData.map((row, index) => {
          const schoolId = schoolsData?.[index]?.col_id;
          const coordinators = schoolId ? coordinatorsBySchool[schoolId] || [] : [];
          return {
            ...row,
            'Coordinadores de colegio': coordinators.join(' | ')
          };
        });
      }

      // Add disciplines count if enabled
      if (includeDisciplinesCount) {
        const { data: disciplinesData, error: disciplinesError } = await supabase
          .from('colegio_actividad_horario')
          .select('col_id, act_id');

        if (disciplinesError) throw disciplinesError;

        // Count distinct disciplines per school
        const disciplinesBySchool: Record<number, Set<number>> = {};
        disciplinesData?.forEach(item => {
          if (!disciplinesBySchool[item.col_id]) {
            disciplinesBySchool[item.col_id] = new Set();
          }
          disciplinesBySchool[item.col_id].add(item.act_id);
        });

        // Add disciplines count column
        excelData = excelData.map((row, index) => {
          const schoolId = schoolsData?.[index]?.col_id;
          const disciplinesCount = schoolId ? disciplinesBySchool[schoolId]?.size || 0 : 0;
          return {
            ...row,
            'Cantidad de disciplinas': disciplinesCount
          };
        });
      }

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Colegios');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `schools_${currentDate}.xlsx`;

      // Write and download the file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Éxito",
        description: `Reporte exportado como ${filename}`
      });
    } catch (error) {
      console.error('Error exporting schools:', error);
      toast({
        title: "Error",
        description: "Error al exportar el reporte de colegios",
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
            Exportar Datos de Colegios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filtros de Reportería */}
          <div className="space-y-4">
            <h4 className="font-medium">Filtros de Reportería</h4>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="full-info"
                  checked={includeFullInfo}
                  onCheckedChange={handleFullInfoChange}
                  className="dark:text-black"
                />
                <label
                  htmlFor="full-info"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Reporte de información completa de los colegios
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="coordinators"
                  checked={includeCoordinators}
                  onCheckedChange={handleCoordinatorsChange}
                  className="dark:text-black"
                />
                <label
                  htmlFor="coordinators"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Ver coordinadores
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="disciplines-count"
                  checked={includeDisciplinesCount}
                  onCheckedChange={handleDisciplinesCountChange}
                  className="dark:text-black"
                />
                <label
                  htmlFor="disciplines-count"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Ver cantidad de disciplinas
                </label>
              </div>
            </div>
          </div>
          
          <Button
            onClick={handleExportToExcel}
            disabled={isExporting}
            className="bg-[#FD5757] hover:bg-[#E04747]"
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Exportando...' : 'Exportar a Excel'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolReportsTab;
