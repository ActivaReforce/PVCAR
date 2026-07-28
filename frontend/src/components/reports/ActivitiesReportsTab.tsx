
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';

const ActivitiesReportsTab = () => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [includeDisciplinesCount, setIncludeDisciplinesCount] = useState(true);

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ['categories-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categoria')
        .select('cat_id, cat_nombre')
        .order('cat_nombre');
      
      if (error) throw error;
      return data || [];
    }
  });

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      // Base query for activities
      let activitiesQuery = supabase
        .from('actividad')
        .select(`
          *,
          categoria:cat_id (
            cat_nombre
          )
        `)
        .order('act_nombre');

      // Apply category filter if selected
      if (selectedCategory !== 'all') {
        activitiesQuery = activitiesQuery.eq('cat_id', parseInt(selectedCategory));
      }

      const { data: activitiesData, error: activitiesError } = await activitiesQuery;
      if (activitiesError) throw activitiesError;

      const disciplinesCount: Record<number, number> = {};

      // Get disciplines count if toggle is ON
      if (includeDisciplinesCount && activitiesData) {
        const disciplinesQuery = supabase
          .from('colegio_actividad_horario')
          .select('act_id');

        const { data: disciplinesData, error: disciplinesError } = await disciplinesQuery;
        if (disciplinesError) throw disciplinesError;

        // Count disciplines per activity
        if (disciplinesData) {
          disciplinesData.forEach(disc => {
            disciplinesCount[disc.act_id] = (disciplinesCount[disc.act_id] || 0) + 1;
          });
        }
      }

      // Transform data for Excel export
      const excelData = activitiesData?.map(activity => {
        const baseData = {
          'ID Actividad': activity.act_id,
          'Nombre': activity.act_nombre,
          'Descripción': activity.act_descripcion || '',
          'Categoría': activity.categoria?.cat_nombre || '',
          'Espacio de Trabajo': activity.act_espacio_trabajo || '',
          'Tipo de Espacio': activity.act_tipo_espacio || '',
          'Espacio Secundario': activity.act_espacio_secundario || '',
          'Tipo de Indumentaria': activity.act_indumentaria_tipo || '',
          'Materiales del Alumno': activity.act_materiales_alumno ? activity.act_materiales_alumno.join(', ') : '',
          'Fecha Creación': activity.act_fecha_creacion ? new Date(activity.act_fecha_creacion).toLocaleDateString() : '',
          'Fecha Modificación': activity.act_fecha_modificacion ? new Date(activity.act_fecha_modificacion).toLocaleDateString() : ''
        };

        // Add disciplines count column if toggle is ON
        if (includeDisciplinesCount) {
          return {
            ...baseData,
            'Cantidad de disciplinas': disciplinesCount[activity.act_id] || 0
          };
        }

        return baseData;
      }) || [];

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Actividades');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `activities_${currentDate}.xlsx`;

      // Write and download the file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Éxito",
        description: `Reporte exportado como ${filename}`
      });
    } catch (error) {
      console.error('Error exporting activities:', error);
      toast({
        title: "Error",
        description: "Error al exportar el reporte de actividades",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid gap-6">
      {/* Filtros de Reportería with Export Button */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Filtros de Reportería</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Filter */}
            <div className="space-y-2">
              <Label htmlFor="category-filter">Filtración por Categorías</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.cat_id} value={category.cat_id.toString()}>
                      {category.cat_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Disciplines Count Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="disciplines-toggle"
                checked={includeDisciplinesCount}
                onCheckedChange={setIncludeDisciplinesCount}
              />
              <Label htmlFor="disciplines-toggle">Ver cantidad de disciplinas</Label>
            </div>
          </div>

          {/* Botón de exportar al final */}
          <div className="pt-2">
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

export default ActivitiesReportsTab;
