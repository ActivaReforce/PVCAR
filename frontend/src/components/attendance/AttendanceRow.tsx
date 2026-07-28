
import React from 'react';
import { Database } from "@/integrations/supabase/types";
import AttendanceStatusTag from './AttendanceStatusTag';
import AttendanceStatusSelect from './AttendanceStatusSelect';
import AttendanceConditionalFields from './AttendanceConditionalFields';
import AttendanceRowActions from './AttendanceRowActions';

type AsistenciaEstado = Database['public']['Tables']['asistencia_estado']['Row'];
type EntrenadorWithDetails = Database['public']['Tables']['entrenador']['Row'] & {
  usuario: Database['public']['Tables']['usuario']['Row'];
};

interface AttendanceRowData {
  ent_id: number;
  status?: number;
  arrivalTime: string;
  justification: string;
  hasChanges: boolean;
  originalStatus?: number;
  originalArrivalTime: string;
  originalJustification: string;
}

interface AttendanceRowProps {
  entrenador: EntrenadorWithDetails;
  rowData: AttendanceRowData;
  estados: AsistenciaEstado[];
  isSaving: boolean;
  onStatusChange: (entId: number, statusId: number) => void;
  onArrivalTimeChange: (entId: number, time: string) => void;
  onJustificationChange: (entId: number, text: string) => void;
  onSave: (entId: number) => void;
  onUndo: (entId: number) => void;
}

const AttendanceRow = ({
  entrenador,
  rowData,
  estados,
  isSaving,
  onStatusChange,
  onArrivalTimeChange,
  onJustificationChange,
  onSave,
  onUndo
}: AttendanceRowProps) => {
  return (
    <div 
      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
      role="row"
      aria-label={`Registro de asistencia para ${entrenador.usuario.usu_nombre}`}
    >
      {/* Coach Name - Fixed width for consistent layout */}
      <div className="flex-1 min-w-0 max-w-48">
        <p 
          className="font-medium text-sm truncate" 
          title={entrenador.usuario.usu_nombre}
          aria-label={`Entrenador: ${entrenador.usuario.usu_nombre}`}
        >
          {entrenador.usuario.usu_nombre}
        </p>
      </div>

      {/* Status Tag - Shows current state */}
      <div className="flex-shrink-0 w-24">
        <AttendanceStatusTag 
          statusId={rowData.status} 
          estados={estados} 
        />
      </div>

      {/* Status Select - Dropdown for changing status */}
      <div className="flex-shrink-0 w-32">
        <AttendanceStatusSelect
          value={rowData.status}
          estados={estados}
          onChange={(statusId) => onStatusChange(entrenador.ent_id, statusId)}
          disabled={isSaving}
        />
      </div>

      {/* Conditional Fields - Time/Justification based on status */}
      <div className="flex-shrink-0 min-w-0">
        <AttendanceConditionalFields
          statusId={rowData.status}
          arrivalTime={rowData.arrivalTime}
          justification={rowData.justification}
          onArrivalTimeChange={(time) => onArrivalTimeChange(entrenador.ent_id, time)}
          onJustificationChange={(text) => onJustificationChange(entrenador.ent_id, text)}
        />
      </div>

      {/* Save/Undo Actions - Only show when there are changes */}
      <div className="flex-shrink-0 w-16">
        <AttendanceRowActions
          hasChanges={rowData.hasChanges}
          isSaving={isSaving}
          onSave={() => onSave(entrenador.ent_id)}
          onUndo={() => onUndo(entrenador.ent_id)}
        />
      </div>
    </div>
  );
};

export default AttendanceRow;
