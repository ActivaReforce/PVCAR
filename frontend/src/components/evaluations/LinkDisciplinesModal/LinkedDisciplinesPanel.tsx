
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';

interface LinkedDiscipline {
  evaasig_id: number;
  colacthor_id: number;
  colegio: {
    col_nombre: string;
  };
  colegio_actividad_horario: {
    col_id: number;
    actividad: {
      act_nombre: string;
    };
    dia: {
      dia_nombre: string;
    };
    colacthor_hora_inicio: string;
    colacthor_hora_fin: string;
  };
}

interface LinkedDisciplinesPanelProps {
  linkedDisciplines: LinkedDiscipline[];
  onUnlink: (assignmentId: number) => void;
  isUnlinking: number | null;
  canUnlinkDiscipline: (discipline: LinkedDiscipline) => boolean;
}

const LinkedDisciplinesPanel: React.FC<LinkedDisciplinesPanelProps> = ({
  linkedDisciplines,
  onUnlink,
  isUnlinking,
  canUnlinkDiscipline
}) => {
  const formatTime = (time: string) => {
    if (!time) return '';
    return time.substring(0, 5);
  };

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="border-b pb-3 mb-4">
        <h3 className="font-medium text-lg">Disciplinas vinculadas</h3>
        <p className="text-sm text-muted-foreground">
          {linkedDisciplines.length} disciplina(s) vinculada(s)
        </p>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {linkedDisciplines.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No hay disciplinas vinculadas</p>
          </div>
        ) : (
          linkedDisciplines.map((linked) => {
            const canUnlink = canUnlinkDiscipline(linked);
            return (
              <div
                key={linked.evaasig_id}
                className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 ${
                  !canUnlink ? 'opacity-50 bg-gray-50' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {linked.colegio.col_nombre}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {linked.colegio_actividad_horario.actividad.act_nombre}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {linked.colegio_actividad_horario.dia.dia_nombre} • {' '}
                    {formatTime(linked.colegio_actividad_horario.colacthor_hora_inicio)} - {' '}
                    {formatTime(linked.colegio_actividad_horario.colacthor_hora_fin)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUnlink(linked.evaasig_id)}
                  disabled={isUnlinking === linked.evaasig_id || !canUnlink}
                  className={`ml-2 ${
                    canUnlink 
                      ? 'text-red-600 hover:text-red-800' 
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isUnlinking === linked.evaasig_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LinkedDisciplinesPanel;
