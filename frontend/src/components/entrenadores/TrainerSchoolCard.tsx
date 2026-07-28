
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EntrenadorWithDetails } from './EntrenadorTypes';

interface TrainerSchoolCardProps {
  schoolName: string;
  trainers: EntrenadorWithDetails[];
  onSchoolSelect: (schoolName: string) => void;
  index: number;
}

const TrainerSchoolCard: React.FC<TrainerSchoolCardProps> = ({
  schoolName,
  trainers,
  onSchoolSelect,
  index
}) => {
  const handleCardClick = () => {
    // For "Sin asignar" card, we want to trigger the "Sin asignar" filter
    if (schoolName === 'Sin Asignar') {
      onSchoolSelect('Sin asignar'); // This will match the filter button logic
    } else {
      onSchoolSelect(schoolName);
    }
  };

  return (
    <div className="h-[180px]">
      <Card 
        className="h-full transition-all duration-200 hover:shadow-md border-l-4 border-l-gray-300 bg-white overflow-hidden cursor-pointer"
        onClick={handleCardClick}
      >
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {schoolName}
              </h3>
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200">
                {trainers.length} entrenador{trainers.length !== 1 ? 'es' : ''}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 relative mt-auto">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Haz clic para ver entrenadores
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainerSchoolCard;
