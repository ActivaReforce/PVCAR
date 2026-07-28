
import React from 'react';
import { useSurveyStats } from '@/hooks/useSurveyStats';
import { Skeleton } from '@/components/ui/skeleton';

interface ResponseRatioProps {
  surveyId: number;
}

export const ResponseRatio: React.FC<ResponseRatioProps> = ({ surveyId }) => {
  const { getStatsForSurvey, isLoading } = useSurveyStats();

  if (isLoading) {
    return <Skeleton className="h-4 w-12" />;
  }

  const stats = getStatsForSurvey(surveyId);
  
  return (
    <span className="text-sm">
      {stats.responses_count} / {stats.total_parents}
    </span>
  );
};
