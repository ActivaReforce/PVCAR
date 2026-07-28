
import React, { useMemo } from 'react';
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, Undo2 } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type Nino = Database['public']['Tables']['nino']['Row'];
type AsistenciaEstado = Database['public']['Tables']['asistencia_estado']['Row'];

interface ChildWithAttendance {
  nino: Nino;
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
  nino_id: number;
  status?: number;
  arrivalTime: string;
  justification: string;
  hasChanges: boolean;
  originalStatus?: number;
  originalArrivalTime: string;
  originalJustification: string;
}

interface AttendanceChildrenMobileRowProps {
  child: ChildWithAttendance;
  rowData: AttendanceRowData;
  estados: AsistenciaEstado[];
  isSaving: boolean;
  onStatusChange: (ninoId: number, statusId: number) => void;
  onArrivalTimeChange: (ninoId: number, time: string) => void;
  onJustificationChange: (ninoId: number, text: string) => void;
  onSave: (ninoId: number) => void;
  onUndo: (ninoId: number) => void;
}

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

const AttendanceChildrenMobileRow = React.memo(({
  child,
  rowData,
  estados,
  isSaving,
  onStatusChange,
  onArrivalTimeChange,
  onJustificationChange,
  onSave,
  onUndo
}: AttendanceChildrenMobileRowProps) => {
  const { nino, attendance } = child;

  // Memoize computed values with null guards
  const initials = useMemo(() => {
    if (!nino?.nino_nombre) return '??';
    return nino.nino_nombre.split(' ').map(n => n?.[0] ?? '').join('').slice(0, 2).toUpperCase() || '??';
  }, [nino?.nino_nombre]);

  const selectedStatus = useMemo(() => 
    estados.find(e => e.asisest_id === rowData.status),
    [estados, rowData.status]
  );

  // Memoize formatted date with null guard to prevent crashes
  const formattedDate = useMemo(() => {
    if (!attendance?.asisnino_fecha_registrado) return null;
    try {
      return format(new Date(attendance.asisnino_fecha_registrado), 'dd/MM/yyyy HH:mm');
    } catch {
      return null;
    }
  }, [attendance?.asisnino_fecha_registrado]);

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      {/* Student Info with Avatar */}
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={nino.nino_foto || undefined} alt={nino.nino_nombre} />
          <AvatarFallback className="text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground truncate" title={nino.nino_nombre}>
            {nino.nino_nombre}
          </div>
          <div className="text-sm text-muted-foreground">
            {nino.nino_edad ? `${nino.nino_edad} años` : 'Edad no especificada'}
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
            onValueChange={(value) => onStatusChange(nino.nino_id, parseInt(value))}
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
              onChange={(e) => onArrivalTimeChange(nino.nino_id, e.target.value)}
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
              onChange={(e) => onJustificationChange(nino.nino_id, e.target.value)}
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
            type="button"
            onClick={() => onSave(nino.nino_id)}
            disabled={isSaving}
            size="sm"
            className="flex items-center gap-2 flex-1 sm:flex-none"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
          <Button
            type="button"
            onClick={() => onUndo(nino.nino_id)}
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

      {/* Audit Info */}
      {formattedDate && (
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Registrado: {formattedDate}
        </div>
      )}
    </div>
  );
});

AttendanceChildrenMobileRow.displayName = 'AttendanceChildrenMobileRow';

export default AttendanceChildrenMobileRow;
