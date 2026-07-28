
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface EstudiantesSchoolCardGridProps {
  estudiantes: any[];
  colegios: Array<{ col_id: number; col_nombre: string; student_count?: number }>;
  onSchoolSelect: (schoolName: string) => void;
}

const EstudiantesSchoolCardGrid: React.FC<EstudiantesSchoolCardGridProps> = ({ 
  estudiantes, 
  colegios, 
  onSchoolSelect 
}) => {
  if (colegios.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="w-12 h-12 mx-auto mb-4 opacity-50">
          <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <p className="text-lg">No hay colegios con alumnos registrados</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {colegios.map((colegio) => {
        const studentCount = colegio.student_count || 0;
        
        return (
          <Card 
            key={colegio.col_id} 
            className="p-6 cursor-pointer hover:shadow-md transition-shadow bg-card"
            onClick={() => onSchoolSelect(colegio.col_nombre)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-card-foreground truncate mb-2">
                  {colegio.col_nombre}
                </h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{studentCount} {studentCount === 1 ? 'alumno' : 'alumnos'}</span>
                </div>
              </div>
              <div className="ml-2">
                <Badge variant="secondary" className="text-xs">
                  {studentCount}
                </Badge>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default EstudiantesSchoolCardGrid;
