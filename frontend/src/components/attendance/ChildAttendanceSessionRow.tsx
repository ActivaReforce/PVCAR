
import React from 'react';
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Undo2 } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type Nino = Database['public']['Tables']['nino']['Row'];
type ColegioActividadHorario = Database['public']['Tables']['colegio_actividad_horario']['Row'];
type Actividad = Database['public']['Tables']['actividad']['Row'];
type Dia = Database['public']['Tables']['dia']['Row'];
type AsistenciaEstado = Database['public']['Tables']['asistencia_estado']['Row'];

interface SessionWithDetails extends ColegioActividadHorario {
  actividad: Actividad;
  dia: Dia;
}

interface ChildSessionData {
  nino: Nino;
  session: SessionWithDetails;
  attendance?: {
    asisnino_id: number;
    asisest_id: number;
    asisnino_hora_tarde?: string;
    asisnino_razon_justificado?: string;
    usu_registrador: number;
    asisnino_fecha_registrado: string;
  };
}

interface AttendanceRowData {
  key: string;
  nino_id: number;
  session_id: number;
  status?: number;
  arrivalTime: string;
  justification: string;
  hasChanges: boolean;
  originalStatus?: number;
  originalArrivalTime: string;
  originalJustification: string;
}

interface ChildAttendanceSessionRowProps {
  childSession: ChildSessionData;
  rowData: AttendanceRowData;
  estados: AsistenciaEstado[];
  isSaving: boolean;
  onStatusChange: (key: string, statusId: number) => void;
  onArrivalTimeChange: (key: string, time: string) => void;
  onJustificationChange: (key: string, text: string) => void;
  onSave: (key: string) => void;
  onUndo: (key: string) => void;
}

const ChildAttendanceSessionRow = ({
  childSession,
  rowData,
  estados,
  isSaving,
  onStatusChange,
  onArrivalTimeChange,
  onJustificationChange,
  onSave,
  onUndo
}: ChildAttendanceSessionRowProps) => {
  const getStatusColor = (statusName: string) => {
    switch (statusName.toLowerCase()) {
      case 'presente':
        return 'bg-green-100 text-green-800';
      case 'tarde':
        return 'bg-yellow-100 text-yellow-800';
      case 'ausente':
        return 'bg-red-100 text-red-800';
      case 'justificado':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const selectedStatus = estados.find(e => e.asisest_id === rowData.status);

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      {/* Student and Session Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="min-w-0 truncate font-medium text-foreground" title={childSession.nino.nino_nombre}>
            {childSession.nino.nino_nombre}
          </div>
          <div className="text-sm text-muted-foreground min-w-0 truncate">
            {childSession.session.actividad.act_nombre} • {format(new Date(`2000-01-01T${childSession.session.colacthor_hora_inicio}`), 'HH:mm')} - {format(new Date(`2000-01-01T${childSession.session.colacthor_hora_fin}`), 'HH:mm')}
          </div>
        </div>
        {selectedStatus && (
          <Badge className={getStatusColor(selectedStatus.asisest_nombre)}>
            {selectedStatus.asisest_nombre}
          </Badge>
        )}
      </div>

      {/* Attendance Status Selection */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Estado</label>
          <Select
            value={rowData.status?.toString() || ""}
            onValueChange={(value) => onStatusChange(rowData.key, parseInt(value))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              {estados.map((estado) => (
                <SelectItem key={estado.asisest_id} value={estado.asisest_id.toString()}>
                  {estado.asisest_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Late Arrival Time */}
        {rowData.status === 3 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Hora de llegada</label>
            <Input
              type="time"
              value={rowData.arrivalTime}
              onChange={(e) => onArrivalTimeChange(rowData.key, e.target.value)}
              placeholder="HH:MM"
              className="w-full"
            />
          </div>
        )}

        {/* Justification */}
        {rowData.status === 4 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Justificación</label>
            <Textarea
              value={rowData.justification}
              onChange={(e) => onJustificationChange(rowData.key, e.target.value)}
              placeholder="Motivo de la justificación..."
              className="min-h-[80px] w-full resize-none"
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {rowData.hasChanges && (
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => onSave(rowData.key)}
            disabled={isSaving}
            size="sm"
            className="flex items-center gap-2 flex-1 sm:flex-none"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
          <Button
            onClick={() => onUndo(rowData.key)}
            disabled={isSaving}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 flex-1 sm:flex-none"
          >
            <Undo2 className="h-4 w-4" />
            Deshacer
          </Button>
        </div>
      )}
    </div>
  );
};

export default ChildAttendanceSessionRow;
