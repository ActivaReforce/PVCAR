
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type NinoAsignacion = Database['public']['Tables']['nino_asignacion']['Row'] & {
  colegio_actividad_horario: {
    actividad: { act_nombre: string } | null;
    dia: { dia_nombre: string } | null;
    colacthor_hora_inicio: string | null;
    colacthor_hora_fin: string | null;
  } | null;
};

interface EstudianteDisciplinasListProps {
  assignments: NinoAsignacion[];
  unlinkingId: number | null;
  onUnlink: (assignmentId: number, disciplineName: string) => void;
}

const EstudianteDisciplinasList = ({
  assignments,
  unlinkingId,
  onUnlink
}: EstudianteDisciplinasListProps) => {
  const formatSchedule = (assignment: NinoAsignacion) => {
    const horario = assignment.colegio_actividad_horario;
    if (!horario) return '';

    const parts = [];
    if (horario.dia?.dia_nombre) {
      parts.push(horario.dia.dia_nombre);
    }
    if (horario.colacthor_hora_inicio && horario.colacthor_hora_fin) {
      parts.push(`${horario.colacthor_hora_inicio} - ${horario.colacthor_hora_fin}`);
    }
    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
  };

  return (
    <div className="space-y-3">
      {assignments.map((assignment) => (
        <div
          key={assignment.ninoasig_id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {assignment.colegio_actividad_horario?.actividad?.act_nombre || 'Disciplina sin nombre'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {formatSchedule(assignment)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Inscrito: {new Date(assignment.ninoasig_fecha_inscripcion).toLocaleDateString()}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUnlink(
              assignment.ninoasig_id,
              assignment.colegio_actividad_horario?.actividad?.act_nombre || 'Disciplina'
            )}
            disabled={unlinkingId === assignment.ninoasig_id}
            className="text-destructive hover:text-destructive"
            title="Desvincular disciplina"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};

export default EstudianteDisciplinasList;
