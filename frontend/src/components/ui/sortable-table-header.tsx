
import React from 'react';
import { Button } from '@/components/ui/button';
import { TableHead } from '@/components/ui/table';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { SortDirection } from '@/hooks/useSorting';
import { cn } from '@/lib/utils';

interface SortableTableHeaderProps {
  children: React.ReactNode;
  sortKey: string;
  currentSortKey: string | null;
  sortDirection: SortDirection;
  onSort?: (key: string) => void;
  className?: string;
}

const SortableTableHeader: React.FC<SortableTableHeaderProps> = ({
  children,
  sortKey,
  currentSortKey,
  sortDirection,
  onSort,
  className,
}) => {
  const isActive = currentSortKey === sortKey;
  
  const getSortIcon = () => {
    if (!isActive) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    
    if (sortDirection === 'asc') {
      return <ChevronUp className="h-4 w-4" />;
    }
    
    if (sortDirection === 'desc') {
      return <ChevronDown className="h-4 w-4" />;
    }
    
    return <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <TableHead className={cn("p-0", className)}>
      <Button
        variant="ghost"
        className={cn(
          "h-12 px-4 text-left align-middle font-medium text-muted-foreground hover:text-foreground w-full justify-start",
          isActive && "text-foreground"
        )}
        onClick={() => onSort?.(sortKey)}
      >
        <span>{children}</span>
        <div className="ml-2 flex-shrink-0">
          {getSortIcon()}
        </div>
      </Button>
    </TableHead>
  );
};

export default SortableTableHeader;
