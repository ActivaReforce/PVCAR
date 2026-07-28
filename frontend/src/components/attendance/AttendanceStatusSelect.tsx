import React, { useMemo, useId } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database } from "@/integrations/supabase/types";

type AsistenciaEstado = Database['public']['Tables']['asistencia_estado']['Row'];

interface AttendanceStatusSelectProps {
  value: number | undefined;
  estados: AsistenciaEstado[];
  onChange: (value: number) => void;
  disabled?: boolean;
}

const AttendanceStatusSelect = React.memo(({ 
  value, 
  estados, 
  onChange, 
  disabled = false 
}: AttendanceStatusSelectProps) => {
  // Generate a stable unique ID for this select instance
  const selectId = useId();
  
  // Memoize sorted estados to prevent re-sorting on every render
  const sortedEstados = useMemo(() => 
    [...estados].sort((a, b) => a.asisest_nombre.localeCompare(b.asisest_nombre)),
    [estados]
  );

  // Memoize SelectItems to prevent re-creation
  const selectItems = useMemo(() => 
    sortedEstados.map((estado) => (
      <SelectItem 
        key={estado.asisest_id} 
        value={estado.asisest_id.toString()}
        className="text-xs"
      >
        {estado.asisest_nombre}
      </SelectItem>
    )),
    [sortedEstados]
  );

  return (
    <Select 
      value={value?.toString() || ""} 
      onValueChange={(val) => onChange(parseInt(val))}
      disabled={disabled}
    >
      <SelectTrigger 
        className="w-32 h-8 text-xs"
        id={selectId}
      >
        <SelectValue placeholder="Estado" />
      </SelectTrigger>
      <SelectContent
        // Use popper positioning strategy to reduce portal overhead
        position="popper"
        // Reduce animation duration for faster perceived performance
        className="min-w-[8rem]"
      >
        {selectItems}
      </SelectContent>
    </Select>
  );
});

AttendanceStatusSelect.displayName = 'AttendanceStatusSelect';

export default AttendanceStatusSelect;
