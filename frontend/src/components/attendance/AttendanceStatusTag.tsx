
import React, { useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { Database } from "@/integrations/supabase/types";

type AsistenciaEstado = Database['public']['Tables']['asistencia_estado']['Row'];

interface AttendanceStatusTagProps {
  statusId?: number;
  estados: AsistenciaEstado[];
}

const getVariant = (name: string): "default" | "destructive" | "outline" | "secondary" => {
  switch (name.toLowerCase()) {
    case 'presente':
      return 'default';
    case 'tarde':
      return 'secondary';
    case 'ausente':
      return 'destructive';
    case 'justificado':
      return 'outline';
    default:
      return 'secondary';
  }
};

const getCustomClasses = (name: string) => {
  switch (name.toLowerCase()) {
    case 'presente':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'tarde':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'ausente':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'justificado':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};

const AttendanceStatusTag = React.memo(({ statusId, estados }: AttendanceStatusTagProps) => {
  const statusData = useMemo((): { name: string; variant: "default" | "destructive" | "outline" | "secondary"; classes: string } => {
    if (!statusId) {
      return { name: 'Sin registro', variant: 'secondary', classes: 'bg-gray-100 text-gray-600' };
    }
    const estado = estados.find(e => e.asisest_id === statusId);
    const name = estado?.asisest_nombre || 'Desconocido';
    return {
      name,
      variant: getVariant(name),
      classes: getCustomClasses(name)
    };
  }, [statusId, estados]);

  return (
    <Badge 
      variant={statusData.variant} 
      className={`text-xs whitespace-nowrap ${statusData.classes}`}
    >
      {statusData.name}
    </Badge>
  );
});

AttendanceStatusTag.displayName = 'AttendanceStatusTag';

export default AttendanceStatusTag;
