import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
interface Survey {
  encu_id: number;
  encu_titulo: string;
  est_id: number;
  encu_fecha_creacion: string;
}
interface Question {
  encupreg_id: number;
  encupreg_pregunta: string;
}
interface ExportButtonsProps {
  selectedSurvey: Survey;
}
export const ExportButtons: React.FC<ExportButtonsProps> = ({
  selectedSurvey
}) => {
  // Question 1 Query (for backward compatibility)
  const {
    data: question1
  } = useQuery({
    queryKey: ['survey-question1', selectedSurvey?.encu_id],
    queryFn: async (): Promise<Question | null> => {
      if (!selectedSurvey) return null;
      const {
        data,
        error
      } = await supabase.from('encuesta_pregunta').select('encupreg_id, encupreg_pregunta').eq('encu_id', selectedSurvey.encu_id).order('encupreg_orden').limit(1).single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedSurvey
  });
  const handleExportExcel = async () => {
    if (!question1 || !selectedSurvey) return;

    // Query for export data
    const {
      data: exportData,
      error
    } = await supabase.from('encuesta_respuesta').select(`
        encurespu_texto,
        encuesta_respondida!inner(
          encurespo_fecha_registro,
          padre!inner(
            usu_id
          )
        )
      `).eq('encupreg_id', question1.encupreg_id);
    if (error) {
      console.error('Error fetching export data:', error);
      return;
    }

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData.map((item: any) => ({
      'Respuesta': item.encurespu_texto,
      'Fecha': new Date(item.encuesta_respondida.encurespo_fecha_registro).toLocaleDateString(),
      'Usuario ID': item.encuesta_respondida.padre.usu_id
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Question 1 Results');
    const today = new Date().toISOString().split('T')[0];
    const filename = `survey_${selectedSurvey.encu_id}_Q1_results_${today}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };
  const handleExportFullSurvey = async () => {
    if (!selectedSurvey) return;
    try {
      // Export query for all questions and answers
      const {
        data: exportData,
        error
      } = await supabase.from('encuesta_pregunta').select(`
          encupreg_pregunta,
          encupreg_orden,
          encuesta_respuesta!inner(
            encurespu_texto,
            encuesta_respondida!inner(
              encurespo_fecha_registro,
              padre!inner(
                usuario!inner(
                  usu_nombre
                )
              )
            )
          )
        `).eq('encu_id', selectedSurvey.encu_id).order('encupreg_orden');
      if (error) {
        console.error('Error fetching full export data:', error);
        return;
      }

      // Flatten the data for Excel export
      const flattenedData: any[] = [];
      exportData.forEach((question: any) => {
        question.encuesta_respuesta.forEach((response: any) => {
          flattenedData.push({
            'Pregunta': question.encupreg_pregunta,
            'Respuesta': response.encurespu_texto,
            'Representante': response.encuesta_respondida.padre.usuario.usu_nombre || '—',
            'Fecha': new Date(response.encuesta_respondida.encurespo_fecha_registro).toLocaleDateString()
          });
        });
      });

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(flattenedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Survey Results');
      const today = new Date().toISOString().split('T')[0];
      const filename = `survey_${selectedSurvey.encu_id}_full_${today}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Error during full export:', error);
    }
  };
  return <div className="flex justify-center items-center w-full max-w-[650px] mx-auto">
      <div className="grid grid-cols-1 gap-4 w-full">
        <Card>
          <CardHeader>
            <CardTitle>Exportar Resultados Completos</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExportFullSurvey} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Exportar todas las respuestas (xlsx)
            </Button>
          </CardContent>
        </Card>
        
        
      </div>
    </div>;
};