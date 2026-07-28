
import React from 'react';
import { Badge } from '@/components/ui/badge';

interface EvaluationTotalDisplayProps {
  total: number | null | undefined;
  label?: string;
}

export const EvaluationTotalDisplay: React.FC<EvaluationTotalDisplayProps> = ({ 
  total, 
  label = "Valor total" 
}) => {
  const displayTotal = total ?? 0;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{label}:</span>
      <Badge variant="outline">{displayTotal}</Badge>
    </div>
  );
};
