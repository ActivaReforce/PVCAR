
import React from 'react';
import TrainerSchoolCard from './TrainerSchoolCard';
import { EntrenadorWithDetails } from './EntrenadorTypes';
import { SortDirection } from '@/hooks/useSorting';

interface TrainerSchoolCardGridProps {
  entrenadores: EntrenadorWithDetails[];
  onView: (entrenador: EntrenadorWithDetails) => void;
  onAtar: (entrenador: EntrenadorWithDetails) => void;
  onSchoolSelect: (schoolName: string) => void;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
}

const TrainerSchoolCardGrid: React.FC<TrainerSchoolCardGridProps> = ({
  entrenadores,
  onView,
  onAtar,
  onSchoolSelect,
  sortKey,
  sortDirection,
  onSort
}) => {
  // Group trainers by school
  const trainersBySchool = entrenadores.reduce((acc, trainer) => {
    if (trainer.colegios.length === 0) {
      // Handle trainers without assigned schools
      if (!acc['Sin Asignar']) {
        acc['Sin Asignar'] = [];
      }
      acc['Sin Asignar'].push(trainer);
    } else {
      // Handle trainers with assigned schools
      trainer.colegios.forEach(school => {
        if (!acc[school]) {
          acc[school] = [];
        }
        acc[school].push(trainer);
      });
    }
    return acc;
  }, {} as Record<string, EntrenadorWithDetails[]>);

  const schoolNames = Object.keys(trainersBySchool);
  
  // Sort schools: "Sin Asignar" first, then alphabetically
  const sortedSchools = schoolNames.sort((a, b) => {
    if (a === 'Sin Asignar') return -1;
    if (b === 'Sin Asignar') return 1;
    return a.localeCompare(b);
  });

  if (sortedSchools.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No se encontraron entrenadores
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sortedSchools.map((schoolName, index) => (
        <TrainerSchoolCard
          key={schoolName}
          schoolName={schoolName}
          trainers={trainersBySchool[schoolName]}
          onSchoolSelect={onSchoolSelect}
          index={index}
        />
      ))}
    </div>
  );
};

export default TrainerSchoolCardGrid;
