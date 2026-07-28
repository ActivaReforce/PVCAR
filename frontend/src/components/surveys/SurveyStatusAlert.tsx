
import React from 'react';

interface SurveyStatusAlertProps {
  isPublished: boolean;
}

export const SurveyStatusAlert: React.FC<SurveyStatusAlertProps> = ({
  isPublished
}) => {
  if (!isPublished) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <p className="text-yellow-800">
        Esta encuesta está publicada y no puede ser editada.
      </p>
    </div>
  );
};
