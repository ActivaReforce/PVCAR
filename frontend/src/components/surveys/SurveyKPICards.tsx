
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const SurveyKPICards = () => {
  const { data: totalSurveys = 0 } = useQuery({
    queryKey: ['surveys-total'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('encuesta')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    }
  });

  const { data: publishedSurveys = 0 } = useQuery({
    queryKey: ['surveys-published'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('encuesta')
        .select('*', { count: 'exact', head: true })
        .eq('est_id', 5);
      if (error) throw error;
      return count || 0;
    }
  });

  const { data: finalisedSurveys = 0 } = useQuery({
    queryKey: ['surveys-finalised'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('encuesta')
        .select('*', { count: 'exact', head: true })
        .eq('est_id', 4);
      if (error) throw error;
      return count || 0;
    }
  });

  return (
    <div className="flex justify-center items-center w-full max-w-[650px] mx-auto mb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-600">
              Total de Encuestas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{totalSurveys}</div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-600">
              Encuestas Publicadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{publishedSurveys}</div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-600">
              Encuestas Finalizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{finalisedSurveys}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
