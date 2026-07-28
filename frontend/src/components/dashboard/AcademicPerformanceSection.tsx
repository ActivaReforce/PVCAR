
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Trophy, Calendar } from "lucide-react";

interface ChildDisciplina {
  colacthor_id: number;
  actividad_nombre: string;
  dia_nombre: string;
  horario: string;
}

interface ChildAsistencia {
  asisest_id: number;
  colacthor_id: number;
  asisnino_fecha: string;
}

interface EvaluationDetail {
  evaninopen_id: number;
  eva_id: number;
  eva_titulo: string;
  eva_descripcion: string;
  eva_puntaje_total: number;
  status: 'Pendiente' | 'Completa';
  obtained_score: number | null;
  eva_fecha_creacion: string;
}

interface Child {
  nino_id: number;
  nino_nombre: string;
  disciplinas: ChildDisciplina[];
  asistencias: ChildAsistencia[];
  evaluationDetails: EvaluationDetail[];
}

interface AcademicPerformanceSectionProps {
  selectedChild: Child;
}

export const AcademicPerformanceSection: React.FC<AcademicPerformanceSectionProps> = ({
  selectedChild
}) => {
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<number | null>(null);

  const selectedDiscipline = selectedChild.disciplinas.find(
    d => d.colacthor_id === selectedDisciplineId
  );

  // Filter evaluations for selected discipline - need to cross-reference with nino_asignacion
  const disciplineEvaluations = selectedDisciplineId 
    ? selectedChild.evaluationDetails.filter(evaluation => {
        // Note: This is a simplified filter. In a real implementation, we'd need to 
        // properly link evaluations to disciplines via nino_asignacion and evaluacion_asignacion
        return true; // For now, show all evaluations when discipline is selected
      })
    : [];

  // Filter attendance for selected discipline
  const disciplineAttendance = selectedDisciplineId
    ? selectedChild.asistencias.filter(att => att.colacthor_id === selectedDisciplineId)
    : [];

  // Get attendance stats for selected discipline
  const getAttendanceStats = () => {
    if (disciplineAttendance.length === 0) {
      return { presente: 0, ausente: 0, tarde: 0, justificado: 0 };
    }

    const total = disciplineAttendance.length;
    const counts = disciplineAttendance.reduce((acc, asistencia) => {
      acc[asistencia.asisest_id] = (acc[asistencia.asisest_id] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return {
      presente: Math.round(((counts[1] || 0) / total) * 100),
      ausente: Math.round(((counts[2] || 0) / total) * 100),
      tarde: Math.round(((counts[3] || 0) / total) * 100),
      justificado: Math.round(((counts[4] || 0) / total) * 100),
    };
  };

  const attendanceStats = getAttendanceStats();

  return (
    <Card className="dark:bg-card dark:border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
          Rendimiento Académico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Discipline Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-card-foreground">
            Seleccionar Disciplina
          </label>
          <Select
            value={selectedDisciplineId?.toString() || ""}
            onValueChange={(value) => setSelectedDisciplineId(parseInt(value))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona una disciplina" />
            </SelectTrigger>
            <SelectContent>
              {selectedChild.disciplinas.map((disciplina) => (
                <SelectItem 
                  key={disciplina.colacthor_id} 
                  value={disciplina.colacthor_id.toString()}
                >
                  {disciplina.actividad_nombre} ({disciplina.dia_nombre} {disciplina.horario})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Show content only when discipline is selected */}
        {selectedDiscipline && (
          <div className="space-y-6">
            {/* Evaluations Section */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Calificaciones Evaluaciones
              </h3>
              
              {disciplineEvaluations.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {disciplineEvaluations.map((evaluation) => (
                    <div 
                      key={evaluation.evaninopen_id} 
                      className="p-3 bg-muted rounded-lg border"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm sm:text-base">
                            {evaluation.eva_titulo}
                          </h4>
                          {evaluation.eva_descripcion && (
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                              {evaluation.eva_descripcion}
                            </p>
                          )}
                        </div>
                        <Badge 
                          variant={evaluation.status === 'Completa' ? 'default' : 'secondary'}
                          className="ml-2"
                        >
                          {evaluation.status}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          Puntuación:
                        </span>
                        <span className="font-semibold text-sm sm:text-base">
                          {evaluation.status === 'Pendiente' 
                            ? `— / ${evaluation.eva_puntaje_total}`
                            : `${evaluation.obtained_score || 0} / ${evaluation.eva_puntaje_total}`
                          }
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No hay evaluaciones disponibles para esta disciplina
                </p>
              )}
            </div>

            {/* Attendance Section */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Calendar className="h-4 w-4 text-blue-500" />
                Asistencias a {selectedDiscipline.actividad_nombre}
              </h3>
              
              {disciplineAttendance.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Presente</p>
                      <p className="font-bold text-green-600">{attendanceStats.presente}%</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ausente</p>
                      <p className="font-bold text-red-600">{attendanceStats.ausente}%</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full flex-shrink-0"></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tarde</p>
                      <p className="font-bold text-yellow-600">{attendanceStats.tarde}%</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Justificado</p>
                      <p className="font-bold text-blue-600">{attendanceStats.justificado}%</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No hay registros de asistencia para esta disciplina
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
