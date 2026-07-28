
import React, { useMemo } from 'react';
import { format } from "date-fns";
import { Database } from "@/integrations/supabase/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AttendanceStatusTag from './AttendanceStatusTag';
import AttendanceStatusSelect from './AttendanceStatusSelect';
import AttendanceConditionalFields from './AttendanceConditionalFields';
import AttendanceRowActions from './AttendanceRowActions';
import AttendanceChildrenMobileRow from './AttendanceChildrenMobileRow';

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

interface AttendanceChildRowProps {
  child: ChildWithAttendance;
  rowData: AttendanceRowData;
  estados: AsistenciaEstado[];
  isSaving: boolean;
  isMobile: boolean;
  onStatusChange: (ninoId: number, statusId: number) => void;
  onArrivalTimeChange: (ninoId: number, time: string) => void;
  onJustificationChange: (ninoId: number, text: string) => void;
  onSave: (ninoId: number) => void;
  onUndo: (ninoId: number) => void;
}

const AttendanceChildRow = React.memo(({
  child,
  rowData,
  estados,
  isSaving,
  isMobile,
  onStatusChange,
  onArrivalTimeChange,
  onJustificationChange,
  onSave,
  onUndo
}: AttendanceChildRowProps) => {
  const { nino, attendance } = child;

  // Memoize computed values with null guards - MUST be before early returns
  const initials = useMemo(() => {
    if (!nino?.nino_nombre) return '??';
    return nino.nino_nombre.split(' ').map(n => n?.[0] ?? '').join('').slice(0, 2).toUpperCase() || '??';
  }, [nino?.nino_nombre]);

  // Memoize formatted date with null guards to prevent crashes
  const formattedTime = useMemo(() => {
    if (!attendance?.asisnino_fecha_registrado) return null;
    try {
      return format(new Date(attendance.asisnino_fecha_registrado), 'HH:mm');
    } catch {
      return null;
    }
  }, [attendance?.asisnino_fecha_registrado]);

  const fullFormattedDate = useMemo(() => {
    if (!attendance?.asisnino_fecha_registrado) return null;
    try {
      return format(new Date(attendance.asisnino_fecha_registrado), 'dd/MM/yyyy HH:mm');
    } catch {
      return null;
    }
  }, [attendance?.asisnino_fecha_registrado]);

  // Now we can do early return for mobile
  if (isMobile) {
    return (
      <AttendanceChildrenMobileRow
        child={child}
        rowData={rowData}
        estados={estados}
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
    <div
      className="
        /* ───── Vista base (móvil / tablet) ───── */
        flex items-center gap-2 p-3 border rounded-lg
        hover:bg-muted/30 transition-colors
        
        /* ───── Vista escritorio (≥ lg) ───── */
        lg:grid
        lg:grid-cols-[40px_minmax(0,1fr)_112px_128px_220px_56px_72px]
        lg:gap-6
      "
      role="row"
      aria-label={`Registro de asistencia para ${nino.nino_nombre}`}
    >
      {/* Avatar del estudiante */}
      <div className="flex-shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarImage src={nino.nino_foto || undefined} alt={nino.nino_nombre} />
          <AvatarFallback className="text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Nombre del niño */}
      <div className="flex-1 min-w-0 max-w-[180px] lg:max-w-none">
        <p
          className="font-medium text-sm truncate lg:whitespace-normal"
          title={nino.nino_nombre}
          aria-label={`Niño: ${nino.nino_nombre}`}
        >
          {nino.nino_nombre}
        </p>
        <p className="text-xs text-muted-foreground truncate lg:whitespace-normal">
          {nino.nino_edad ? `${nino.nino_edad} años` : 'Edad no especificada'}
        </p>
      </div>

      {/* Etiqueta de estado */}
      <div className="flex-shrink-0 w-20 lg:w-24">
        <AttendanceStatusTag statusId={rowData.status} estados={estados} />
      </div>

      {/* Select de estado */}
      <div className="flex-shrink-0 w-28 lg:w-32">
        <AttendanceStatusSelect
          value={rowData.status}
          estados={estados}
          onChange={(statusId) => onStatusChange(nino.nino_id, statusId)}
          disabled={isSaving}
        />
      </div>

      {/* Campos condicionales */}
      <div className="flex-shrink-0 min-w-0 w-32 lg:w-44">
        <AttendanceConditionalFields
          statusId={rowData.status}
          arrivalTime={rowData.arrivalTime}
          justification={rowData.justification}
          onArrivalTimeChange={(time) =>
            onArrivalTimeChange(nino.nino_id, time)
          }
          onJustificationChange={(text) =>
            onJustificationChange(nino.nino_id, text)
          }
        />
      </div>

      {/* Acciones */}
      <div className="flex-shrink-0 w-12">
        <AttendanceRowActions
          hasChanges={rowData.hasChanges}
          isSaving={isSaving}
          onSave={() => onSave(nino.nino_id)}
          onUndo={() => onUndo(nino.nino_id)}
        />
      </div>

      {/* Información de auditoría */}
      {attendance && (
        <div className="flex-shrink-0 w-16 lg:w-18 text-xs text-muted-foreground">
          <p title={`Registrado: ${fullFormattedDate}`}>
            {formattedTime}
          </p>
        </div>
      )}
    </div>
  );
});

AttendanceChildRow.displayName = 'AttendanceChildRow';

export default AttendanceChildRow;
