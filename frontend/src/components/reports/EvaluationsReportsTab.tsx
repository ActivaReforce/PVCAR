import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface School {
  col_id: number;
  col_nombre: string;
}

interface Discipline {
  colacthor_id: number;
  label: string;
  actividad_nombre: string;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
}

interface Evaluation {
  eva_id: number;
  eva_titulo: string;
}

const EvaluationsReportsTab = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [filters, setFilters] = useState({
    school: 'todos',
    discipline: 'todas',
    evaluation: 'todas'
  });

  const [exportOptions, setExportOptions] = useState({
    includeFinalScores: false,
    includeParameters: false
  });

  // Fetch schools
  const { data: schools = [] } = useQuery({
    queryKey: ['schools-for-evaluations-export'],
    queryFn: async (): Promise<School[]> => {
      const { data, error } = await supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .order('col_nombre');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch disciplines for selected school
  const { data: disciplines = [] } = useQuery({
    queryKey: ['disciplines-for-school-export', filters.school],
    queryFn: async (): Promise<Discipline[]> => {
      if (filters.school === 'todos') {
        // Get all disciplines from all schools that have evaluations
        const { data, error } = await supabase
          .from('evaluacion_asignacion')
          .select(`
            colacthor_id,
            colegio_actividad_horario!inner(
              col_id,
              colacthor_hora_inicio,
              colacthor_hora_fin,
              actividad!inner(act_nombre),
              dia!inner(dia_nombre),
              colegio!inner(col_nombre)
            )
          `)
          .eq('est_id', 1);
        
        if (error) throw error;
        
        const uniqueDisciplines = new Map();
        data?.forEach(item => {
          const cah = item.colegio_actividad_horario as any;
          const actividadNombre = cah?.actividad?.act_nombre || '';
          const diaNombre = cah?.dia?.dia_nombre || '';
          const horaInicio = cah?.colacthor_hora_inicio || '';
          const horaFin = cah?.colacthor_hora_fin || '';
          const colegioNombre = cah?.colegio?.col_nombre || '';
          const label = `${actividadNombre} — ${diaNombre.charAt(0).toUpperCase() + diaNombre.slice(1)} (${horaInicio}–${horaFin}) - ${colegioNombre}`;
          
          if (!uniqueDisciplines.has(item.colacthor_id)) {
            uniqueDisciplines.set(item.colacthor_id, {
              colacthor_id: item.colacthor_id,
              label,
              actividad_nombre: actividadNombre,
              dia_nombre: diaNombre,
              hora_inicio: horaInicio,
              hora_fin: horaFin
            });
          }
        });
        
        return Array.from(uniqueDisciplines.values());
      }
      
      const { data, error } = await supabase
        .from('evaluacion_asignacion')
        .select(`
          colacthor_id,
          colegio_actividad_horario!inner(
            col_id,
            colacthor_hora_inicio,
            colacthor_hora_fin,
            actividad!inner(act_nombre),
            dia!inner(dia_nombre)
          )
        `)
        .eq('est_id', 1)
        .eq('colegio_actividad_horario.col_id', parseInt(filters.school));
      
      if (error) throw error;
      
      const uniqueDisciplines = new Map();
      data?.forEach(item => {
        const cah = item.colegio_actividad_horario as any;
        const actividadNombre = cah?.actividad?.act_nombre || '';
        const diaNombre = cah?.dia?.dia_nombre || '';
        const horaInicio = cah?.colacthor_hora_inicio || '';
        const horaFin = cah?.colacthor_hora_fin || '';
        const label = `${actividadNombre} — ${diaNombre.charAt(0).toUpperCase() + diaNombre.slice(1)} (${horaInicio}–${horaFin})`;
        
        if (!uniqueDisciplines.has(item.colacthor_id)) {
          uniqueDisciplines.set(item.colacthor_id, {
            colacthor_id: item.colacthor_id,
            label,
            actividad_nombre: actividadNombre,
            dia_nombre: diaNombre,
            hora_inicio: horaInicio,
            hora_fin: horaFin
          });
        }
      });
      
      return Array.from(uniqueDisciplines.values());
    },
    enabled: true
  });

  // Fetch evaluations for selected discipline/school
  const { data: evaluations = [] } = useQuery({
    queryKey: ['evaluations-for-discipline-export', filters.discipline, filters.school],
    queryFn: async (): Promise<Evaluation[]> => {
      if (filters.discipline === 'todas') {
        if (filters.school === 'todos') {
          // Get all evaluations from all schools
          const { data, error } = await supabase
            .from('evaluacion_asignacion')
            .select(`
              eva_id,
              evaluacion!inner(eva_titulo)
            `)
            .eq('est_id', 1);
          
          if (error) throw error;
          
          const uniqueEvaluations = new Map();
          data?.forEach(item => {
            const evaluation = item.evaluacion as any;
            if (!uniqueEvaluations.has(item.eva_id)) {
              uniqueEvaluations.set(item.eva_id, {
                eva_id: item.eva_id,
                eva_titulo: evaluation?.eva_titulo || ''
              });
            }
          });
          
          return Array.from(uniqueEvaluations.values());
        } else {
          // Get all evaluations for selected school
          const { data, error } = await supabase
            .from('evaluacion_asignacion')
            .select(`
              eva_id,
              evaluacion!inner(eva_titulo),
              colegio_actividad_horario!inner(col_id)
            `)
            .eq('est_id', 1)
            .eq('colegio_actividad_horario.col_id', parseInt(filters.school));
          
          if (error) throw error;
          
          const uniqueEvaluations = new Map();
          data?.forEach(item => {
            const evaluation = item.evaluacion as any;
            if (!uniqueEvaluations.has(item.eva_id)) {
              uniqueEvaluations.set(item.eva_id, {
                eva_id: item.eva_id,
                eva_titulo: evaluation?.eva_titulo || ''
              });
            }
          });
          
          return Array.from(uniqueEvaluations.values());
        }
      }
      
      const { data, error } = await supabase
        .from('evaluacion_asignacion')
        .select(`
          eva_id,
          evaluacion!inner(eva_titulo)
        `)
        .eq('est_id', 1)
        .eq('colacthor_id', parseInt(filters.discipline));
      
      if (error) throw error;
      
      const uniqueEvaluations = new Map();
      data?.forEach(item => {
        const evaluation = item.evaluacion as any;
        if (!uniqueEvaluations.has(item.eva_id)) {
          uniqueEvaluations.set(item.eva_id, {
            eva_id: item.eva_id,
            eva_titulo: evaluation?.eva_titulo || ''
          });
        }
      });
      
      return Array.from(uniqueEvaluations.values());
    },
    enabled: true
  });

  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev, [filterName]: value };
      
      // Reset dependent filters
      if (filterName === 'school') {
        newFilters.discipline = 'todas';
        newFilters.evaluation = 'todas';
      } else if (filterName === 'discipline') {
        newFilters.evaluation = 'todas';
      }
      
      return newFilters;
    });
  };

  const handleExportOptionChange = (option: string, checked: boolean) => {
    setExportOptions(prev => ({
      ...prev,
      [option]: checked
    }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Build base query for evaluations
      let evaluationQuery = supabase
        .from('evaluacion_asignacion')
        .select(`
          eva_id,
          colacthor_id,
          evaluacion!inner(
            eva_titulo,
            eva_descripcion,
            eva_puntaje_total,
            eva_categoria
          ),
          colegio_actividad_horario!inner(
            col_id,
            colacthor_hora_inicio,
            colacthor_hora_fin,
            actividad!inner(act_nombre),
            colegio!inner(col_nombre)
          )
        `)
        .eq('est_id', 1);

      // Apply filters
      if (filters.school !== 'todos') {
        evaluationQuery = evaluationQuery.eq('colegio_actividad_horario.col_id', parseInt(filters.school));
      }
      if (filters.discipline !== 'todas') {
        evaluationQuery = evaluationQuery.eq('colacthor_id', parseInt(filters.discipline));
      }
      if (filters.evaluation !== 'todas') {
        evaluationQuery = evaluationQuery.eq('eva_id', parseInt(filters.evaluation));
      }

      const { data: evaluationData, error: evalError } = await evaluationQuery;
      if (evalError) {
        console.error('Export base query error:', evalError?.message || evalError);
        throw evalError;
      }

      // Prepare workbook and worksheet data
      const workbook = XLSX.utils.book_new();
      const worksheetData: any[] = [];

      // Headers en Español (orden importante)
      const baseHeaders = [
        'Nombre de la Evaluación',
        'Descripción de la Evaluación',
        'Categoría',
        'Puntaje Total de la Evaluación',
        'Colegio',
        'Actividad',
        'Horario',
      ];
      const finalScoreHeaders = ['Nombre del Alumno', 'Cédula del Alumno', 'Puntaje Final del Alumno'];
      const parameterHeaders = [
        'Nombre del Alumno',
        'Cédula del Alumno',
        'Nombre del Parámetro',
        'Tipo de Metodología',
        'Intento',
        'Puntaje del Parámetro',
        'Puntaje Obtenido del Parámetro',
      ];

      let headers = [...baseHeaders];
      if (exportOptions.includeParameters && exportOptions.includeFinalScores) {
        headers = [...baseHeaders, ...parameterHeaders, 'Puntaje Final del Alumno'];
      } else if (exportOptions.includeParameters) {
        headers = [...baseHeaders, ...parameterHeaders];
      } else if (exportOptions.includeFinalScores) {
        headers = [...baseHeaders, ...finalScoreHeaders];
      }

      if (!exportOptions.includeFinalScores && !exportOptions.includeParameters) {
        // Exportación base únicamente
        evaluationData?.forEach(item => {
          const evaluation = item.evaluacion as any;
          const cah = item.colegio_actividad_horario as any;

          worksheetData.push({
            'Nombre de la Evaluación': evaluation?.eva_titulo || '',
            'Descripción de la Evaluación': evaluation?.eva_descripcion || '',
            'Categoría': evaluation?.eva_categoria || '',
            'Puntaje Total de la Evaluación': evaluation?.eva_puntaje_total || 0,
            'Colegio': cah?.colegio?.col_nombre || '',
            'Actividad': cah?.actividad?.act_nombre || '',
            'Horario': `${cah?.colacthor_hora_inicio || ''}–${cah?.colacthor_hora_fin || ''}`
          });
        });
      } else {
        // Incluir datos de estudiantes
        for (const evalItem of evaluationData || []) {
          // Obtener evaluaciones completadas para esta asignación
          const { data: completedEvals, error: completedError } = await supabase
            .from('evaluacion_nino_pendiente')
            .select(`
              evaninopen_id,
              eva_id,
              ninoasig_id,
              nino_asignacion!inner(
                nino_id,
                colacthor_id,
                nino!inner(nino_nombre, nino_cedula)
              )
            `)
            .eq('est_id', 7) // Completado
            .eq('eva_id', evalItem.eva_id)
            .eq('nino_asignacion.colacthor_id', evalItem.colacthor_id);

          if (completedError) {
            console.error('Error fetching completed evaluations:', completedError?.message || completedError);
            continue;
          }

          if (exportOptions.includeParameters) {
            // Parámetros de la evaluación
            const { data: parameters, error: paramError } = await supabase
              .from('evaluacion_parametro')
              .select(`
                evaparam_id,
                evaparam_nombre,
                evaparam_puntaje,
                evaluacion_tipo_metodo!inner(evatipometo_nombre)
              `)
              .eq('eva_id', evalItem.eva_id);

            if (paramError) {
              console.error('Error fetching parameters:', paramError?.message || paramError);
              continue;
            }

            // Intentos de estos estudiantes
            const evaninOpenIds = completedEvals?.map(e => e.evaninopen_id) || [];
            if (evaninOpenIds.length > 0) {
              const { data: attempts, error: attemptsError } = await supabase
                .from('evaluacion_intento')
                .select('evaninopen_id, evaparam_id, evaint_intento, evaint_puntaje_obtenido')
                .in('evaninopen_id', evaninOpenIds);

              if (attemptsError) {
                console.error('Error fetching attempts:', attemptsError?.message || attemptsError);
                continue;
              }

              // Calculate final scores if both options are selected
              const finalScores = new Map<number, number>();
              if (exportOptions.includeFinalScores) {
                attempts?.forEach(attempt => {
                  const current = finalScores.get(attempt.evaninopen_id) || 0;
                  finalScores.set(attempt.evaninopen_id, current + (attempt.evaint_puntaje_obtenido || 0));
                });
              }

              // Procesar intentos por estudiante
              completedEvals?.forEach(studentEval => {
                const studentAttempts = attempts?.filter(a => a.evaninopen_id === studentEval.evaninopen_id) || [];
                const nino = (studentEval.nino_asignacion as any)?.nino;
                const finalScore = exportOptions.includeFinalScores ? (finalScores.get(studentEval.evaninopen_id) || 0) : undefined;

                parameters?.forEach(param => {
                  const paramAttempts = studentAttempts.filter(a => a.evaparam_id === param.evaparam_id);
                  const metodo = param.evaluacion_tipo_metodo as any;

                  paramAttempts.forEach(attempt => {
                    const evaluation = evalItem.evaluacion as any;
                    const cah = evalItem.colegio_actividad_horario as any;

                    const rowData: any = {
                      'Nombre de la Evaluación': evaluation?.eva_titulo || '',
                      'Descripción de la Evaluación': evaluation?.eva_descripcion || '',
                      'Categoría': evaluation?.eva_categoria || '',
                      'Puntaje Total de la Evaluación': evaluation?.eva_puntaje_total || 0,
                      'Colegio': cah?.colegio?.col_nombre || '',
                      'Actividad': cah?.actividad?.act_nombre || '',
                      'Horario': `${cah?.colacthor_hora_inicio || ''}–${cah?.colacthor_hora_fin || ''}`,
                      'Nombre del Alumno': nino?.nino_nombre || '',
                      'Cédula del Alumno': nino?.nino_cedula || '',
                      'Nombre del Parámetro': param.evaparam_nombre || '',
                      'Tipo de Metodología': metodo?.evatipometo_nombre || '',
                      'Intento': attempt.evaint_intento || 0,
                      'Puntaje del Parámetro': param.evaparam_puntaje || 0,
                      'Puntaje Obtenido del Parámetro': attempt.evaint_puntaje_obtenido || 0
                    };

                    // Add final score if both options are selected
                    if (exportOptions.includeFinalScores) {
                      rowData['Puntaje Final del Alumno'] = finalScore;
                    }

                    worksheetData.push(rowData);
                  });
                });
              });
            }
          } else if (exportOptions.includeFinalScores) {
            // Puntuación final por estudiante
            const evaninOpenIds = completedEvals?.map(e => e.evaninopen_id) || [];
            if (evaninOpenIds.length > 0) {
              const { data: attempts, error: attemptsError } = await supabase
                .from('evaluacion_intento')
                .select('evaninopen_id, evaint_puntaje_obtenido')
                .in('evaninopen_id', evaninOpenIds);

              if (attemptsError) {
                console.error('Error fetching attempts:', attemptsError?.message || attemptsError);
                continue;
              }

              // Sumar puntajes por estudiante
              const finalScores = new Map<number, number>();
              attempts?.forEach(attempt => {
                const current = finalScores.get(attempt.evaninopen_id) || 0;
                finalScores.set(attempt.evaninopen_id, current + (attempt.evaint_puntaje_obtenido || 0));
              });

              completedEvals?.forEach(studentEval => {
                const finalScore = finalScores.get(studentEval.evaninopen_id) || 0;
                const nino = (studentEval.nino_asignacion as any)?.nino;
                const evaluation = evalItem.evaluacion as any;
                const cah = evalItem.colegio_actividad_horario as any;

                worksheetData.push({
                  'Nombre de la Evaluación': evaluation?.eva_titulo || '',
                  'Descripción de la Evaluación': evaluation?.eva_descripcion || '',
                  'Categoría': evaluation?.eva_categoria || '',
                  'Puntaje Total de la Evaluación': evaluation?.eva_puntaje_total || 0,
                  'Colegio': cah?.colegio?.col_nombre || '',
                  'Actividad': cah?.actividad?.act_nombre || '',
                  'Horario': `${cah?.colacthor_hora_inicio || ''}–${cah?.colacthor_hora_fin || ''}`,
                  'Nombre del Alumno': nino?.nino_nombre || '',
                  'Cédula del Alumno': nino?.nino_cedula || '',
                  'Puntaje Final del Alumno': finalScore
                });
              });
            }
          }
        }
      }

      // Construir hoja con encabezados primero para garantizar Excel con cabeceras aunque no haya filas
      const worksheet = XLSX.utils.aoa_to_sheet([headers]);
      if (worksheetData.length > 0) {
        XLSX.utils.sheet_add_json(worksheet, worksheetData, {
          header: headers,
          skipHeader: true,
          origin: 'A2',
        });
      }

      const sheetName = 'Evaluaciones';
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Nombre de archivo con timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `evaluaciones-${timestamp}.xlsx`;

      XLSX.writeFile(workbook, filename);

    } catch (error: any) {
      console.error('Export error:', error?.message || error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid gap-6">
      {/* Filters */}
      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Datos de Evaluaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* School Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Colegio</label>
              <Select value={filters.school} onValueChange={(value) => handleFilterChange('school', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar colegio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.col_id} value={school.col_id.toString()}>
                      {school.col_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Discipline Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Disciplina</label>
              <Select value={filters.discipline} onValueChange={(value) => handleFilterChange('discipline', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar disciplina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {disciplines.map((discipline) => (
                    <SelectItem key={discipline.colacthor_id} value={discipline.colacthor_id.toString()}>
                      {discipline.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Evaluation Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Evaluación</label>
              <Select value={filters.evaluation} onValueChange={(value) => handleFilterChange('evaluation', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar evaluación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {evaluations.map((evaluation) => (
                    <SelectItem key={evaluation.eva_id} value={evaluation.eva_id.toString()}>
                      {evaluation.eva_titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Student Grades Checklist */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Incluir Calificaciones de Alumnos</h4>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeFinalScores"
                  checked={exportOptions.includeFinalScores}
                  onCheckedChange={(checked) => handleExportOptionChange('includeFinalScores', checked as boolean)}
                />
                <label htmlFor="includeFinalScores" className="text-sm">
                  Incluir Puntuación Final del Alumno
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeParameters"
                  checked={exportOptions.includeParameters}
                  onCheckedChange={(checked) => handleExportOptionChange('includeParameters', checked as boolean)}
                />
                <label htmlFor="includeParameters" className="text-sm">
                  Incluir Cada Parámetro Evaluado
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
            El reporte incluirá datos de evaluaciones según los filtros seleccionados. 
            {exportOptions.includeFinalScores && " Se incluirán las puntuaciones finales de los alumnos."}
            {exportOptions.includeParameters && " Se incluirán los detalles de cada parámetro evaluado."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EvaluationsReportsTab;
