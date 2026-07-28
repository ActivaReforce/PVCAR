
import React, { useRef, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { getCurrentEcuadorTime } from './TimezoneUtils';

interface AttendanceConditionalFieldsProps {
  statusId?: number;
  arrivalTime: string;
  justification: string;
  onArrivalTimeChange: (value: string) => void;
  onJustificationChange: (value: string) => void;
}

const AttendanceConditionalFields = React.memo(({
  statusId,
  arrivalTime,
  justification,
  onArrivalTimeChange,
  onJustificationChange
}: AttendanceConditionalFieldsProps) => {
  const isLate = statusId === 3; // Tarde (Late)
  const isJustified = statusId === 4; // Justificado
  
  // Use ref to track if we've already auto-filled to prevent loops
  const hasAutoFilledRef = useRef(false);
  // Cache the Ecuador time for this component instance
  const cachedEcuadorTimeRef = useRef<string | null>(null);

  // Reset auto-fill tracking when status changes away from late
  useEffect(() => {
    if (!isLate) {
      hasAutoFilledRef.current = false;
      cachedEcuadorTimeRef.current = null;
    }
  }, [isLate]);

  // Auto-fill current time when status becomes "Tarde" - only once
  useEffect(() => {
    if (isLate && !arrivalTime && !hasAutoFilledRef.current) {
      hasAutoFilledRef.current = true;
      // Compute and cache Ecuador time only once
      if (!cachedEcuadorTimeRef.current) {
        cachedEcuadorTimeRef.current = getCurrentEcuadorTime();
      }
      onArrivalTimeChange(cachedEcuadorTimeRef.current);
    }
  }, [isLate, arrivalTime, onArrivalTimeChange]);

  // Show placeholder when neither condition is met
  if (!isLate && !isJustified) {
    return <div className="w-40" />; // Placeholder to maintain consistent spacing
  }

  return (
    <div className="flex items-center gap-2">
      {isLate && (
        <Input
          type="time"
          value={arrivalTime}
          onChange={(e) => onArrivalTimeChange(e.target.value)}
          className="w-24 h-8 text-xs"
          placeholder="Hora"
          aria-label="Hora de llegada tardía"
          required
        />
      )}
      
      {isJustified && (
        <Input
          type="text"
          value={justification}
          onChange={(e) => onJustificationChange(e.target.value)}
          placeholder="Justificación..."
          maxLength={120}
          className="w-40 h-8 text-xs"
          aria-label="Justificación de asistencia"
          required
        />
      )}
    </div>
  );
});

AttendanceConditionalFields.displayName = 'AttendanceConditionalFields';

export default AttendanceConditionalFields;
