import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Users } from 'lucide-react';

interface StudentCounts {
  active: number;
  inactive: number;
  total: number;
}

interface StudentStatusFiltersProps {
  statusFilter: 'active' | 'inactive' | 'all';
  onStatusChange: (status: 'active' | 'inactive' | 'all') => void;
  studentCounts: StudentCounts;
}

const StudentStatusFilters = ({ 
  statusFilter, 
  onStatusChange, 
  studentCounts 
}: StudentStatusFiltersProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <Button
        variant={statusFilter === 'active' ? "default" : "outline"}
        size="sm"
        onClick={() => onStatusChange('active')}
        className="flex items-center gap-2 justify-center sm:justify-start"
      >
        <CheckCircle className="h-4 w-4" />
        Activos
        <Badge variant="secondary" className="ml-1">
          {studentCounts.active}
        </Badge>
      </Button>
      
      <Button
        variant={statusFilter === 'inactive' ? "default" : "outline"}
        size="sm"
        onClick={() => onStatusChange('inactive')}
        className="flex items-center gap-2 justify-center sm:justify-start"
      >
        <XCircle className="h-4 w-4" />
        Inactivos
        <Badge variant="secondary" className="ml-1">
          {studentCounts.inactive}
        </Badge>
      </Button>

      <Button
        variant={statusFilter === 'all' ? "default" : "outline"}
        size="sm"
        onClick={() => onStatusChange('all')}
        className="flex items-center gap-2 justify-center sm:justify-start"
      >
        <Users className="h-4 w-4" />
        Todos
        <Badge variant="secondary" className="ml-1">
          {studentCounts.total}
        </Badge>
      </Button>
    </div>
  );
};

export default StudentStatusFilters;