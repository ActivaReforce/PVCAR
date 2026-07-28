
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { SurveyStatusTag } from './SurveyStatusTag';

interface Survey {
  encu_id: number;
  encu_titulo: string;
  est_id: number;
  encu_fecha_creacion: string;
}

interface SurveyGridProps {
  onSurveySelect: (survey: Survey) => void;
}

export const SurveyGrid: React.FC<SurveyGridProps> = ({ onSurveySelect }) => {
  const { data: surveys = [] } = useQuery({
    queryKey: ['surveys-list'],
    queryFn: async (): Promise<Survey[]> => {
      const { data, error } = await supabase
        .from('encuesta')
        .select('encu_id, encu_titulo, est_id, encu_fecha_creacion')
        .order('encu_fecha_creacion', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="flex justify-center items-center w-full max-w-[650px] mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {surveys.map(survey => (
          <Card
            key={survey.encu_id}
            className="max-w-[260px] w-full mx-auto cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-1 hover:border-gray-400 active:border-gray-600"
            onClick={() => onSurveySelect(survey)}
          >
            <CardContent className="p-4 space-y-3">
              <h5 className="font-medium text-base leading-tight line-clamp-2 min-h-[3rem] flex items-center">
                {survey.encu_titulo}
              </h5>
              
              <div className="flex items-center justify-between">
                <SurveyStatusTag statusId={survey.est_id} />
              </div>
              
              <p className="text-xs text-muted-foreground">
                Creado: {formatDate(survey.encu_fecha_creacion)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
