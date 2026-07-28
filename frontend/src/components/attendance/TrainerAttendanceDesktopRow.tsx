import React, { useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import AttendanceStatusTag from './AttendanceStatusTag';
import AttendanceStatusSelect from './AttendanceStatusSelect';
import AttendanceConditionalFields from './AttendanceConditionalFields';
import AttendanceRowActions from './AttendanceRowActions';
import {
  AttendanceUser,
  AttendanceRowData,
  AsistenciaEstado
} from "./TrainerAttendanceTypes";

interface TrainerAttendanceDesktopRowProps {
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

const TrainerAttendanceDesktopRow = React.memo(({
  attendanceUser,
  rowData,
  asistenciaEstados,
  isSaving,
  onStatusChange,
  onArrivalTimeChange,
  onJustificationChange,
  onSave,
  onUndo
}: TrainerAttendanceDesktopRowProps) => {
  // Memoize all computed values in a single useMemo
  const { id, usuario, cedula, roleName, initials } = useMemo(() => {
    const userId = attendanceUser.type === 'trainer' ? attendanceUser.data.ent_id : attendanceUser.data.usu_id;
    const user = attendanceUser.data.usuario;
    const userCedula = attendanceUser.type === 'trainer' ? attendanceUser.data.ent_cedula : null;
    const role = attendanceUser.type === 'trainer' ? 'Entrenador' : 'Asistente';
    const userInitials = user.usu_nombre
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    return { id: userId, usuario: user, cedula: userCedula, roleName: role, initials: userInitials };
  }, [attendanceUser]);

  return (
    <div
      className="
        /* ───── Vista base (móvil / tablet) ───── */
        flex items-center gap-2 p-3 border rounded-lg
        hover:bg-muted/30 transition-colors
        
        /* ───── Vista escritorio (≥ lg) ───── */
        lg:grid
        lg:grid-cols-[minmax(0,1fr)_112px_128px_220px_56px_72px]
        lg:gap-6
      "
      role="row"
      aria-label={`Registro de asistencia para ${usuario.usu_nombre}`}
    >
      {/* User Name with Avatar and Role Badge */}
      <div className="flex-1 min-w-0 max-w-[180px] lg:max-w-none">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6 flex-shrink-0">
            <AvatarImage src={usuario.usu_foto || undefined} />
            <AvatarFallback className="text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p
                className="font-medium text-sm truncate lg:whitespace-normal"
                title={usuario.usu_nombre}
                aria-label={`${roleName}: ${usuario.usu_nombre}`}
              >
                {usuario.usu_nombre}
              </p>
              <Badge 
                variant={attendanceUser.type === 'trainer' ? 'default' : 'secondary'}
                className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0"
              >
                {roleName}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate lg:whitespace-normal">
              {cedula || 'Sin cédula'}
            </p>
          </div>
        </div>
      </div>

      {/* Status Tag */}
      <div className="flex-shrink-0 w-20 lg:w-24">
        <AttendanceStatusTag statusId={rowData.status} estados={asistenciaEstados} />
      </div>

      {/* Status Select */}
      <div className="flex-shrink-0 w-28 lg:w-32">
        <AttendanceStatusSelect
          value={rowData.status}
          estados={asistenciaEstados}
          onChange={(statusId) => onStatusChange(id, statusId)}
          disabled={isSaving}
        />
      </div>

      {/* Conditional Fields */}
      <div className="flex-shrink-0 min-w-0 w-32 lg:w-44">
        <AttendanceConditionalFields
          statusId={rowData.status}
          arrivalTime={rowData.arrivalTime}
          justification={rowData.justification}
          onArrivalTimeChange={(time) =>
            onArrivalTimeChange(id, time)
          }
          onJustificationChange={(text) =>
            onJustificationChange(id, text)
          }
        />
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 w-12">
        <AttendanceRowActions
          hasChanges={rowData.hasChanges}
          isSaving={isSaving}
          onSave={() => onSave(id)}
          onUndo={() => onUndo(id)}
        />
      </div>

      {/* Placeholder for audit info */}
      <div className="flex-shrink-0 w-16 lg:w-18">
        {/* Empty space to match student layout */}
      </div>
    </div>
  );
});

TrainerAttendanceDesktopRow.displayName = 'TrainerAttendanceDesktopRow';

export default TrainerAttendanceDesktopRow;
