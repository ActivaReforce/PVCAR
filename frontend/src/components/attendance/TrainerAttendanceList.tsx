import React, { useMemo } from 'react';
import { format } from "date-fns";
import { useIsMobile } from '@/hooks/use-mobile';
import TrainerAttendanceMobileRow from './TrainerAttendanceMobileRow';
import TrainerAttendanceDesktopRow from './TrainerAttendanceDesktopRow';
import {
  AttendanceUser,
  AttendanceRowData,
  AsistenciaEstado
} from "./TrainerAttendanceTypes";

interface TrainerAttendanceListProps {
  attendanceUsers: AttendanceUser[];
  attendanceRows: Record<number, AttendanceRowData>;
  asistenciaEstados: AsistenciaEstado[];
  selectedDate: Date;
  savingIds: Set<number>;
  onStatusChange: (id: number, statusId: number) => void;
  onArrivalTimeChange: (id: number, time: string) => void;
  onJustificationChange: (id: number, text: string) => void;
  onSave: (id: number) => void;
  onUndo: (id: number) => void;
}

const TrainerAttendanceList = ({
  attendanceUsers,
  attendanceRows,
  asistenciaEstados,
  selectedDate,
  savingIds,
  onStatusChange,
  onArrivalTimeChange,
  onJustificationChange,
  onSave,
  onUndo
}: TrainerAttendanceListProps) => {
  // Single useIsMobile call at list level - passed down via conditional rendering
  const isMobile = useIsMobile();

  // Memoize formatted date for header
  const formattedDate = useMemo(() => 
    format(selectedDate, "dd/MM/yyyy"),
    [selectedDate]
  );

  if (attendanceUsers.length === 0) {
    return null;
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
        <h2 className="text-lg sm:text-xl font-semibold">
          Lista de Entrenadores - {formattedDate}
        </h2>
      </div>

      {/* User List */}
      <div className="space-y-2" role="table" aria-label="Registro de asistencia de entrenadores">
        {attendanceUsers.map((user) => {
          const id = user.type === 'trainer' ? user.data.ent_id : user.data.usu_id;
          const rowData = attendanceRows[id];
          if (!rowData) return null;

          const isSaving = savingIds.has(id);

          if (isMobile) {
            return (
              <TrainerAttendanceMobileRow
                key={`${user.type}-${id}`}
                attendanceUser={user}
                rowData={rowData}
                asistenciaEstados={asistenciaEstados}
                isSaving={isSaving}
                onStatusChange={onStatusChange}
                onArrivalTimeChange={onArrivalTimeChange}
                onJustificationChange={onJustificationChange}
                onSave={onSave}
                onUndo={onUndo}
              />
            );
          }

          return (
            <TrainerAttendanceDesktopRow
              key={`${user.type}-${id}`}
              attendanceUser={user}
              rowData={rowData}
              asistenciaEstados={asistenciaEstados}
              isSaving={isSaving}
              onStatusChange={onStatusChange}
              onArrivalTimeChange={onArrivalTimeChange}
              onJustificationChange={onJustificationChange}
              onSave={onSave}
              onUndo={onUndo}
            />
          );
        })}
      </div>
    </>
  );
};

export default TrainerAttendanceList;
