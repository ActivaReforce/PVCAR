
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { EvaluationTotalDisplay } from './EvaluationTotalDisplay';

interface Student {
  nino_id: number;
  nino_nombre: string;
  nino_foto?: string;
}

interface Evaluation {
  eva_id: number;
  eva_titulo: string;
  eva_puntaje_total?: number;
}

interface Discipline {
  act_nombre: string;
}

interface EvaluateStudentHeaderProps {
  student: Student;
  evaluation: Evaluation;
  discipline: Discipline;
}

export const EvaluateStudentHeader: React.FC<EvaluateStudentHeaderProps> = ({
  student,
  evaluation,
  discipline
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Alumno:</span>
        <span className="text-sm">{student.nino_nombre}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Evaluación:</span>
        <span className="text-sm">{evaluation.eva_titulo}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Disciplina:</span>
        <span className="text-sm">{discipline.act_nombre}</span>
      </div>
      {evaluation.eva_puntaje_total !== undefined && (
        <EvaluationTotalDisplay total={evaluation.eva_puntaje_total} />
      )}
    </div>
  );
};
