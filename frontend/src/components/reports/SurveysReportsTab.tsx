
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { formatUtcISOToEcuadorLocal } from '@/lib/datetime';

interface Survey {
  encu_id: number;
  encu_titulo: string;
  encu_descripcion: string | null;
  encu_creador: number;
  encu_fecha_creacion: string;
  est_id: number;
}

const SurveysReportsTab = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [filters, setFilters] = useState({
    survey: 'todas'
  });

  const [exportOptions, setExportOptions] = useState({
    includeUnpublished: true,
    includeRepresentatives: true,
    includeAllResponses: false,
    includeCreator: false,
    includeCreationDate: false
  });

  // Fetch published surveys for dropdown
  const { data: publishedSurveys = [] } = useQuery({
    queryKey: ['published-surveys-for-export'],
    queryFn: async (): Promise<Survey[]> => {
      const { data, error } = await supabase
        .from('encuesta')
        .select('encu_id, encu_titulo, encu_descripcion, encu_creador, encu_fecha_creacion, est_id')
        .eq('est_id', 5)
        .order('encu_titulo');
      if (error) throw error;
      return data || [];
    }
  });

  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const handleExportOptionChange = (option: string, checked: boolean) => {
    if (option === 'includeAllResponses') {
      if (checked) {
        // When includeAllResponses is turned ON, disable and uncheck other options
        setExportOptions(prev => ({
          ...prev,
          includeAllResponses: true,
          includeRepresentatives: false,
          includeCreator: false,
          includeCreationDate: false
        }));
      } else {
        // When includeAllResponses is turned OFF, just update it and re-enable others
        setExportOptions(prev => ({
          ...prev,
          includeAllResponses: false
        }));
      }
    } else {
      setExportOptions(prev => ({
        ...prev,
        [option]: checked
      }));
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Build base query for surveys
      let surveyQuery = supabase
        .from('encuesta')
        .select(`
          encu_id,
          encu_titulo,
          encu_descripcion,
          encu_creador,
          encu_fecha_creacion,
          est_id,
          estado!inner(est_nombre),
          usuario!encuesta_encu_creador_fkey(usu_nombre)
        `);

      // Apply filters
      if (filters.survey === 'todas') {
        if (!exportOptions.includeUnpublished) {
          surveyQuery = surveyQuery.eq('est_id', 5);
        }
      } else {
        surveyQuery = surveyQuery.eq('encu_id', parseInt(filters.survey));
      }

      const { data: surveyData, error: surveyError } = await surveyQuery.order('encu_titulo');
      if (surveyError) {
        console.error('Survey export query error:', surveyError?.message || surveyError);
        throw surveyError;
      }

      // Prepare workbook
      const workbook = XLSX.utils.book_new();
      const worksheetData: any[] = [];

      // Base headers
      let headers = [
        'Título de la Encuesta',
        'Descripción',
        'Estado de Encuesta'
      ];

      // Add optional headers
      if (exportOptions.includeCreator) {
        headers.push('Creador');
      }
      if (exportOptions.includeCreationDate) {
        // Renamed per requirement
        headers.push('Fecha de Creación de la Encuesta');
      }

      // Additional headers based on export options
      if (exportOptions.includeRepresentatives) {
        headers.push('Nombre del Representante', 'Estado de Representante');
      }
      if (exportOptions.includeAllResponses) {
        headers = [
          'Título de la Encuesta',
          'Nombre del Representante',
          'Fecha de Respuesta',
          'Pregunta',
          'Respuesta'
        ];
      }

      if (exportOptions.includeAllResponses) {
        // Export all responses
        for (const survey of surveyData || []) {
          // Get all responses for this survey
          const { data: responses, error: responsesError } = await supabase
            .from('encuesta_respondida')
            .select(`
              encurespo_fecha_registro,
              padre_id,
              padre!inner(
                usu_id,
                usuario!inner(usu_nombre)
              ),
              encuesta_respuesta!inner(
                encupreg_id,
                encurespu_texto,
                encurespu_num,
                encurespu_fecha,
                encurespu_hora,
                encurespu_sino,
                encuesta_pregunta!inner(encupreg_pregunta)
              )
            `)
            .eq('encu_id', survey.encu_id);

          if (responsesError) {
            console.error('Error fetching responses:', responsesError);
            continue;
          }

          responses?.forEach(response => {
            const padre = response.padre as any;
            const usuario = padre?.usuario;
            
            response.encuesta_respuesta?.forEach((respuesta: any) => {
              const pregunta = respuesta.encuesta_pregunta;
              
              // Get the first non-null response value
              const respuestaValue = respuesta.encurespu_texto ||
                                 respuesta.encurespu_num?.toString() ||
                                 respuesta.encurespu_fecha ||
                                 respuesta.encurespu_hora ||
                                 (respuesta.encurespu_sino !== null ? (respuesta.encurespu_sino ? 'Sí' : 'No') : null) ||
                                 '';

              worksheetData.push({
                'Título de la Encuesta': survey.encu_titulo || '',
                'Nombre del Representante': usuario?.usu_nombre || '',
                // Format UTC -> America/Guayaquil, "yyyy-MM-dd HH:mm"
                'Fecha de Respuesta': formatUtcISOToEcuadorLocal(response.encurespo_fecha_registro as string | null),
                'Pregunta': pregunta?.encupreg_pregunta || '',
                'Respuesta': respuestaValue
              });
            });
          });
        }
      } else if (exportOptions.includeRepresentatives) {
        // Export representatives with response status
        for (const survey of surveyData || []) {
          if (survey.est_id === 5) { // Only for published surveys
            // Get all active representatives
            const { data: representatives, error: repsError } = await supabase
              .from('padre')
              .select(`
                padre_id,
                usu_id,
                usuario!inner(usu_nombre, est_id)
              `)
              .eq('usuario.est_id', 1);

            if (repsError) {
              console.error('Error fetching representatives:', repsError);
              continue;
            }

            // Get responses for this survey
            const { data: surveyResponses, error: responsesError } = await supabase
              .from('encuesta_respondida')
              .select('padre_id')
              .eq('encu_id', survey.encu_id);

            if (responsesError) {
              console.error('Error fetching survey responses:', responsesError);
              continue;
            }

            const respondedPadreIds = new Set(surveyResponses?.map(r => r.padre_id) || []);
            const estado = survey.estado as any;
            const creador = survey.usuario as any;

            representatives?.forEach(rep => {
              const usuario = rep.usuario as any;
              const hasResponded = respondedPadreIds.has(rep.padre_id);

              const rowData: any = {
                'Título de la Encuesta': survey.encu_titulo || '',
                'Descripción': survey.encu_descripcion || '',
                'Estado de Encuesta': estado?.est_nombre || ''
              };

              if (exportOptions.includeCreator) {
                rowData['Creador'] = creador?.usu_nombre || '';
              }
              if (exportOptions.includeCreationDate) {
                // Use the new header name and format
                rowData['Fecha de Creación de la Encuesta'] = formatUtcISOToEcuadorLocal(survey.encu_fecha_creacion as string | null);
              }

              rowData['Nombre del Representante'] = usuario?.usu_nombre || '';
              rowData['Estado de Representante'] = hasResponded ? 'Respondido' : 'Pendiente';

              worksheetData.push(rowData);
            });
          } else {
            // For non-published surveys, just show survey data
            const estado = survey.estado as any;
            const creador = survey.usuario as any;

            const rowData: any = {
              'Título de la Encuesta': survey.encu_titulo || '',
              'Descripción': survey.encu_descripcion || '',
              'Estado de Encuesta': estado?.est_nombre || ''
            };

            if (exportOptions.includeCreator) {
              rowData['Creador'] = creador?.usu_nombre || '';
            }
            if (exportOptions.includeCreationDate) {
              // Use the new header name and format
              rowData['Fecha de Creación de la Encuesta'] = formatUtcISOToEcuadorLocal(survey.encu_fecha_creacion as string | null);
            }

            worksheetData.push(rowData);
          }
        }
      } else {
        // Base export - just survey data
        surveyData?.forEach(survey => {
          const estado = survey.estado as any;
          const creador = survey.usuario as any;

          const rowData: any = {
            'Título de la Encuesta': survey.encu_titulo || '',
            'Descripción': survey.encu_descripcion || '',
            'Estado de Encuesta': estado?.est_nombre || ''
          };

          if (exportOptions.includeCreator) {
            rowData['Creador'] = creador?.usu_nombre || '';
          }
          if (exportOptions.includeCreationDate) {
            // Use the new header name and format
            rowData['Fecha de Creación de la Encuesta'] = formatUtcISOToEcuadorLocal(survey.encu_fecha_creacion as string | null);
          }

          worksheetData.push(rowData);
        });
      }

      // Create worksheet with headers
      const worksheet = XLSX.utils.aoa_to_sheet([headers]);
      if (worksheetData.length > 0) {
        XLSX.utils.sheet_add_json(worksheet, worksheetData, {
          header: headers,
          skipHeader: true,
          origin: 'A2',
        });
      }

      const sheetName = 'Encuestas';
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `encuestas-${timestamp}.xlsx`;

      XLSX.writeFile(workbook, filename);

    } catch (error: any) {
      console.error('Surveys export error:', error?.message || error);
    } finally {
      setIsExporting(false);
    }
  };

  // Show/hide checkbox based on survey selection
  const showUnpublishedCheckbox = filters.survey === 'todas';

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Datos de Encuestas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {/* Survey Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Encuestas Publicadas</label>
              <Select value={filters.survey} onValueChange={(value) => handleFilterChange('survey', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar encuesta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {publishedSurveys.map((survey) => (
                    <SelectItem key={survey.encu_id} value={survey.encu_id.toString()}>
                      {survey.encu_titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Include Unpublished Checkbox */}
            {showUnpublishedCheckbox && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeUnpublished"
                  checked={exportOptions.includeUnpublished}
                  disabled={exportOptions.includeAllResponses}
                  onCheckedChange={(checked) => handleExportOptionChange('includeUnpublished', checked as boolean)}
                />
                <label htmlFor="includeUnpublished" className={`text-sm ${exportOptions.includeAllResponses ? 'text-muted-foreground' : ''}`}>
                  Incluir las encuestas que NO están publicadas
                </label>
              </div>
            )}
          </div>
          
          {/* Export Options */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Opciones de Exportación</h4>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeRepresentatives"
                  checked={exportOptions.includeRepresentatives}
                  disabled={exportOptions.includeAllResponses}
                  onCheckedChange={(checked) => handleExportOptionChange('includeRepresentatives', checked as boolean)}
                />
                <label htmlFor="includeRepresentatives" className={`text-sm ${exportOptions.includeAllResponses ? 'text-muted-foreground' : ''}`}>
                  Ver representantes que respondieron o están pendientes
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeAllResponses"
                  checked={exportOptions.includeAllResponses}
                  onCheckedChange={(checked) => handleExportOptionChange('includeAllResponses', checked as boolean)}
                />
                <label htmlFor="includeAllResponses" className="text-sm">
                  Incluir todas las respuestas de los representantes
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeCreator"
                  checked={exportOptions.includeCreator}
                  disabled={exportOptions.includeAllResponses}
                  onCheckedChange={(checked) => handleExportOptionChange('includeCreator', checked as boolean)}
                />
                <label htmlFor="includeCreator" className={`text-sm ${exportOptions.includeAllResponses ? 'text-muted-foreground' : ''}`}>
                  Incluir creador de la encuesta
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeCreationDate"
                  checked={exportOptions.includeCreationDate}
                  disabled={exportOptions.includeAllResponses}
                  onCheckedChange={(checked) => handleExportOptionChange('includeCreationDate', checked as boolean)}
                />
                <label htmlFor="includeCreationDate" className={`text-sm ${exportOptions.includeAllResponses ? 'text-muted-foreground' : ''}`}>
                  Incluir fecha de creación de la encuesta
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-start">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="bg-[#FD5757] hover:bg-[#E04747]"
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? 'Exportando...' : 'Exportar a Excel'}
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            El reporte incluirá datos de encuestas según los filtros seleccionados.
            {exportOptions.includeRepresentatives && " Se incluirán los representantes y su estado de respuesta."}
            {exportOptions.includeAllResponses && " Se incluirán todas las respuestas individuales."}
            {exportOptions.includeCreator && " Se incluirá el creador de cada encuesta."}
            {exportOptions.includeCreationDate && " Se incluirá la fecha de creación de la encuesta."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SurveysReportsTab;

