
import React from 'react';
import { Badge } from '@/components/ui/badge';

interface SurveyStatusTagProps {
  statusId: number;
}

export const SurveyStatusTag: React.FC<SurveyStatusTagProps> = ({ statusId }) => {
  const getStatusInfo = (id: number) => {
    switch (id) {
      case 3:
        return { label: 'Borrador', variant: 'outline' as const };
      case 4:
        return { label: 'Finalizado', variant: 'secondary' as const };
      case 5:
        return { label: 'Publicado', variant: 'default' as const };
      default:
        return { label: 'Desconocido', variant: 'outline' as const };
    }
  };

  const { label, variant } = getStatusInfo(statusId);

  return <Badge variant={variant}>{label}</Badge>;
};
