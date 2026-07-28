
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck } from 'lucide-react';

interface AttendanceStats {
  presente: number;
  ausente: number;
  tarde: number;
  justificado: number;
}

interface AttendanceCardProps {
  title: string;
  stats: AttendanceStats;
  isStudents?: boolean;
}

export const AttendanceCard = ({ title, stats, isStudents = true }: AttendanceCardProps) => {
  const Icon = isStudents ? Users : UserCheck;
  
  return (
    <Card className="hover:shadow-lg transition-all duration-200 dark:bg-card dark:border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-card-foreground">{title}</CardTitle>
        <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
            <div>
              <p className="text-xs text-muted-foreground">Presente</p>
              <p className="font-bold text-green-600">{stats.presente}%</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
            <div>
              <p className="text-xs text-muted-foreground">Ausente</p>
              <p className="font-bold text-red-600">{stats.ausente}%</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full flex-shrink-0"></div>
            <div>
              <p className="text-xs text-muted-foreground">Tarde</p>
              <p className="font-bold text-yellow-600">{stats.tarde}%</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
            <div>
              <p className="text-xs text-muted-foreground">Justificado</p>
              <p className="font-bold text-blue-600">{stats.justificado}%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
