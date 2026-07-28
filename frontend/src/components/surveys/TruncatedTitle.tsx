
import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TruncatedTitleProps {
  title: string;
  maxLength?: number;
}

export const TruncatedTitle: React.FC<TruncatedTitleProps> = ({ 
  title, 
  maxLength = 20 
}) => {
  const truncated = title.length > maxLength 
    ? `${title.substring(0, maxLength)}...`
    : title;

  const needsTooltip = title.length > maxLength;

  if (!needsTooltip) {
    return <span className="font-medium">{title}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-medium cursor-help">{truncated}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <p className="whitespace-pre-wrap">{title}</p>
      </TooltipContent>
    </Tooltip>
  );
};
