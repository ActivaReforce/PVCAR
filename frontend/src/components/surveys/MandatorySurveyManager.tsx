
import React, { useState } from 'react';
import { useMandatorySurveys } from '@/hooks/useMandatorySurveys';
import { MandatorySurveyModal } from './MandatorySurveyModal';

export const MandatorySurveyManager: React.FC = () => {
  const { pendingSurveys, isLoading, isParent } = useMandatorySurveys();
  const [currentSurveyIndex, setCurrentSurveyIndex] = useState(0);

  if (isLoading || !isParent) {
    return null;
  }

  const currentSurvey = pendingSurveys[currentSurveyIndex];

  if (!currentSurvey) {
    return null;
  }

  const handleSurveyComplete = () => {
    if (currentSurveyIndex < pendingSurveys.length - 1) {
      setCurrentSurveyIndex(prev => prev + 1);
    } else {
      // All surveys completed - the component will unmount as pendingSurveys becomes empty
      setCurrentSurveyIndex(0);
    }
  };

  return (
    <MandatorySurveyModal
      survey={currentSurvey}
      onComplete={handleSurveyComplete}
    />
  );
};
