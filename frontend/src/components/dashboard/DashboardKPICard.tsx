
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface DashboardKPICardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  color?: string;
}

export const DashboardKPICard = ({ 
  title, 
  value, 
  icon: Icon, 
  description,
  color = "text-blue-500"
}: DashboardKPICardProps) => {
  return (
    <Card className="hover:shadow-lg transition-all duration-200 dark:bg-card dark:border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-card-foreground">{title}</CardTitle>
        <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl sm:text-3xl font-bold ${color}`}>{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};
