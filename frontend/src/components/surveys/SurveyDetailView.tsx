
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { MultiQuestionCarousel } from './MultiQuestionCarousel';
import { ExportButtons } from './ExportButtons';

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

interface SurveyDetailViewProps {
  selectedSurvey: Survey;
  onBack: () => void;
}

export const SurveyDetailView: React.FC<SurveyDetailViewProps> = ({ 
  selectedSurvey, 
  onBack 
}) => {
  // Fetch all questions for the selected survey
  const { data: allQuestions = [] } = useQuery({
    queryKey: ['survey-all-questions', selectedSurvey?.encu_id],
    queryFn: async (): Promise<Question[]> => {
      if (!selectedSurvey) return [];
      const { data, error } = await supabase
        .from('encuesta_pregunta')
        .select('encupreg_id, encupreg_pregunta')
        .eq('encu_id', selectedSurvey.encu_id)
        .order('encupreg_orden');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedSurvey
  });

  return (
    <div className="container mx-auto p-4 lg:p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Encuestas
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          {selectedSurvey.encu_titulo}
        </h1>
        <p className="text-muted-foreground">
          Análisis y reportes de la encuesta
        </p>
      </div>

      <Tabs defaultValue="analysis" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="analysis">Análisis</TabsTrigger>
          <TabsTrigger value="report">Reporte</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-6">
          <div className="flex justify-center items-center w-full max-w-[700px] mx-auto">
            <div className="w-full">
              {allQuestions.length > 0 ? (
                <MultiQuestionCarousel 
                  questions={allQuestions} 
                  surveyId={selectedSurvey.encu_id}
                />
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center p-6">
                    <p className="text-muted-foreground">No hay preguntas disponibles para esta encuesta</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="report" className="space-y-6">
          <ExportButtons selectedSurvey={selectedSurvey} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
