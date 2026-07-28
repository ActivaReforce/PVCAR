
import React, { useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Undo2 } from "lucide-react";
import {
  AttendanceUser,
  AttendanceRowData,
  AsistenciaEstado
} from "./TrainerAttendanceTypes";

interface TrainerAttendanceMobileRowProps {
  attendanceUser: AttendanceUser;
  rowData: AttendanceRowData;
  asistenciaEstados: AsistenciaEstado[];
  isSaving: boolean;
  onStatusChange: (id: number, statusId: number) => void;
  onArrivalTimeChange: (id: number, time: string) => void;
  onJustificationChange: (id: number, text: string) => void;
  onSave: (id: number) => void;
  onUndo: (id: number) => void;
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

const TrainerAttendanceMobileRow = React.memo(({
  attendanceUser,
  rowData,
  asistenciaEstados,
  isSaving,
  onStatusChange,
  onArrivalTimeChange,
  onJustificationChange,
  onSave,
  onUndo
}: TrainerAttendanceMobileRowProps) => {
  // Memoize computed values with null guards
  const { id, usuario, cedula, roleName, initials } = useMemo(() => {
    const userId = attendanceUser.type === 'trainer' ? attendanceUser.data.ent_id : attendanceUser.data.usu_id;
    const user = attendanceUser.data.usuario;
    const userCedula = attendanceUser.type === 'trainer' ? attendanceUser.data.ent_cedula : null;
    const role = attendanceUser.type === 'trainer' ? 'Entrenador' : 'Asistente';
    
    // Guard against null/undefined usu_nombre before split
    let userInitials = '??';
    if (user?.usu_nombre) {
      userInitials = user.usu_nombre
        .split(' ')
        .map(n => n?.[0] ?? '')
        .join('')
        .toUpperCase()
        .slice(0, 2) || '??';
    }
    
    return { id: userId, usuario: user, cedula: userCedula, roleName: role, initials: userInitials };
  }, [attendanceUser]);

  const selectedStatus = useMemo(() => 
    asistenciaEstados.find(e => e.asisest_id === rowData.status),
    [asistenciaEstados, rowData.status]
  );

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      {/* User Info */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={usuario.usu_foto || undefined} />
            <AvatarFallback className="text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="font-medium text-sm truncate" title={usuario.usu_nombre}>
                {usuario.usu_nombre}
              </div>
              <Badge 
                variant={attendanceUser.type === 'trainer' ? 'default' : 'secondary'}
                className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0"
              >
                {roleName}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {cedula || 'Sin cédula'}
            </div>
          </div>
        </div>
        {selectedStatus && (
          <Badge className={getStatusColor(selectedStatus.asisest_nombre)}>
            {selectedStatus.asisest_nombre}
          </Badge>
        )}
      </div>

      {/* Status Selection */}
      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Estado de Asistencia</label>
          <Select
            value={rowData.status?.toString() || ""}
            onValueChange={(value) => onStatusChange(id, parseInt(value))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              {asistenciaEstados.map((estado) => (
                <SelectItem key={estado.asisest_id} value={estado.asisest_id.toString()}>
                  {estado.asisest_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Conditional Fields */}
        {rowData.status === 3 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Hora de llegada</label>
            <Input
              type="time"
              value={rowData.arrivalTime}
              onChange={(e) => onArrivalTimeChange(id, e.target.value)}
              placeholder="HH:MM"
              className="w-full"
            />
          </div>
        )}

        {rowData.status === 4 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Justificación</label>
            <Textarea
              value={rowData.justification}
              onChange={(e) => onJustificationChange(id, e.target.value)}
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
            onClick={() => onSave(id)}
            disabled={isSaving}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
          <Button
            type="button"
            onClick={() => onUndo(id)}
            disabled={isSaving}
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <Undo2 className="h-4 w-4 mr-2" />
            Deshacer
          </Button>
        </div>
      )}
    </div>
  );
});

TrainerAttendanceMobileRow.displayName = 'TrainerAttendanceMobileRow';

export default TrainerAttendanceMobileRow;
