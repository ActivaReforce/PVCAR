
import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TruncatedDescriptionProps {
  description: string | null | undefined;
  maxLength?: number;
}

export const TruncatedDescription: React.FC<TruncatedDescriptionProps> = ({ 
  description, 
  maxLength = 30 
}) => {
  if (!description) {
    return <span className="text-muted-foreground">-</span>;
  }

  const truncated = description.length > maxLength 
    ? `${description.substring(0, maxLength)}...`
    : description;

  const needsTooltip = description.length > maxLength;

  if (!needsTooltip) {
    return <span>{description}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{truncated}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <p className="whitespace-pre-wrap">{description}</p>
      </TooltipContent>
    </Tooltip>
  );
};
