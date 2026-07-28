import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EstudiantesDisciplineFilters from './EstudiantesDisciplineFilters';

interface Colegio {
  col_id: number;
  col_nombre: string;
}

interface EstudiantesResponsiveFiltersProps {
  colegios: Colegio[];
  selectedSchool: string | null;
  selectedDiscipline: number | null;
  showUnassigned: boolean;
  statusFilter: 'active' | 'inactive' | 'all';
  onCollegeFilterSelect: (schoolName: string) => void;
  onDisciplineSelect: (disciplineId: number | null) => void;
  onUnassignedSelect: (showUnassigned: boolean) => void;
  searchQuery?: string;
}

const EstudiantesResponsiveFilters: React.FC<EstudiantesResponsiveFiltersProps> = ({
  colegios,
  selectedSchool,
  selectedDiscipline,
  showUnassigned,
  statusFilter,
  onCollegeFilterSelect,
  onDisciplineSelect,
  onUnassignedSelect,
  searchQuery,
}) => {
  return (
    <>
      {/* Mobile Filters (< 640px) */}
      <div className="sm:hidden space-y-3">
        {/* College Select */}
        <div>
          <Select value={selectedSchool || ''} onValueChange={onCollegeFilterSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar colegio..." />
            </SelectTrigger>
            <SelectContent className="z-50 bg-background border border-border">
              {colegios.map((colegio) => (
                <SelectItem key={colegio.col_id} value={colegio.col_nombre}>
                  {colegio.col_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Discipline Select - Only show for active students */}
        {statusFilter === 'active' && selectedSchool && (
          <div>
            <EstudiantesDisciplineFilters
              selectedSchool={selectedSchool}
              selectedDiscipline={selectedDiscipline}
              onDisciplineSelect={onDisciplineSelect}
              showUnassigned={showUnassigned}
              onUnassignedSelect={onUnassignedSelect}
              searchQuery={searchQuery}
            />
          </div>
        )}
      </div>

      {/* Desktop Filters (≥ 640px) */}
      <div className="hidden sm:block space-y-4">
        {/* College Filter Buttons */}
        <div className="flex flex-wrap gap-2 bg-gray-50 p-4 rounded-lg">
          {colegios.map((colegio) => (
            <Button 
              key={colegio.col_id}
              variant={selectedSchool === colegio.col_nombre ? "default" : "outline"} 
              size="sm" 
              onClick={() => onCollegeFilterSelect(colegio.col_nombre)}
              className="flex items-center gap-2"
            >
              {colegio.col_nombre}
            </Button>
          ))}
        </div>

        {/* Discipline Filter Buttons - Only show for active students */}
        {statusFilter === 'active' && selectedSchool && (
          <EstudiantesDisciplineFilters
            selectedSchool={selectedSchool}
            selectedDiscipline={selectedDiscipline}
            onDisciplineSelect={onDisciplineSelect}
            showUnassigned={showUnassigned}
            onUnassignedSelect={onUnassignedSelect}
            searchQuery={searchQuery}
          />
        )}
      </div>
    </>
  );
};

export default EstudiantesResponsiveFilters;