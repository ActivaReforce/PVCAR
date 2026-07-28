
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Users } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface UserCounts {
  active: number;
  inactive: number;
  total: number;
}

interface UserStatusFiltersProps {
  statusFilter: 'active' | 'inactive' | 'all';
  onStatusChange: (status: 'active' | 'inactive' | 'all') => void;
  userCounts: UserCounts;
}

const UserStatusFilters = ({ 
  statusFilter, 
  onStatusChange, 
  userCounts 
}: UserStatusFiltersProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex justify-between gap-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg min-w-0 max-w-full">
        <Button
          variant={statusFilter === 'active' ? "default" : "outline"}
          size="sm"
          onClick={() => onStatusChange('active')}
          className="flex-1 flex items-center justify-center text-xs min-w-0 px-2"
        >
          <span className="truncate">Activos</span>
        </Button>
        
        <Button
          variant={statusFilter === 'inactive' ? "default" : "outline"}
          size="sm"
          onClick={() => onStatusChange('inactive')}
          className="flex-1 flex items-center justify-center text-xs min-w-0 px-2"
        >
          <span className="truncate">Inactivos</span>
        </Button>

        <Button
          variant={statusFilter === 'all' ? "default" : "outline"}
          size="sm"
          onClick={() => onStatusChange('all')}
          className="flex-1 flex items-center justify-center text-xs min-w-0 px-2"
        >
          <span className="truncate">Todos</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <Button
        variant={statusFilter === 'active' ? "default" : "outline"}
        size="sm"
        onClick={() => onStatusChange('active')}
        className="flex items-center gap-2"
      >
        <CheckCircle className="h-4 w-4" />
        Activos
        <Badge variant="secondary" className="ml-1">
          {userCounts.active}
        </Badge>
      </Button>
      
      <Button
        variant={statusFilter === 'inactive' ? "default" : "outline"}
        size="sm"
        onClick={() => onStatusChange('inactive')}
        className="flex items-center gap-2"
      >
        <XCircle className="h-4 w-4" />
        Inactivos
        <Badge variant="secondary" className="ml-1">
          {userCounts.inactive}
        </Badge>
      </Button>

      <Button
        variant={statusFilter === 'all' ? "default" : "outline"}
        size="sm"
        onClick={() => onStatusChange('all')}
        className="flex items-center gap-2"
      >
        <Users className="h-4 w-4" />
        Todos
        <Badge variant="secondary" className="ml-1">
          {userCounts.total}
        </Badge>
      </Button>
    </div>
  );
};

export default UserStatusFilters;
