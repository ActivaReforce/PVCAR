
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AttendanceStudentsAnalysisTab from '@/components/reports/AttendanceStudentsAnalysisTab';
import AttendanceStudentsReportsTab from '@/components/reports/AttendanceStudentsReportsTab';
import AttendanceCoachesAnalysisTab from '@/components/reports/AttendanceCoachesAnalysisTab';
import AttendanceCoachesReportsTab from '@/components/reports/AttendanceCoachesReportsTab';
import { ConditionalAction } from '@/components/ui/conditional-actions';

const ReportesAsistencias = () => {
  const navigate = useNavigate();
  const [activeSubmodule, setActiveSubmodule] = React.useState<'students' | 'coaches'>('students');

  return (
    <div className="container mx-auto p-4 lg:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/reportes')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Reportes
          </Button>
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Reportes de Asistencias
        </h1>
        <p className="text-muted-foreground">
          Analiza y exporta reportes detallados de asistencias de alumnos y entrenadores
        </p>
      </div>

      {/* Submodule Switch */}
      <div className="mb-6">
        <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          <button
            onClick={() => setActiveSubmodule('students')}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
              activeSubmodule === 'students'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:bg-background/50'
            }`}
          >
            Alumnos
          </button>
          <button
            onClick={() => setActiveSubmodule('coaches')}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
              activeSubmodule === 'coaches'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:bg-background/50'
            }`}
          >
            Entrenadores
          </button>
        </div>
      </div>

      {/* Content based on active submodule */}
      {activeSubmodule === 'students' && (
        <Tabs defaultValue="analysis" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="analysis">Análisis</TabsTrigger>
            <ConditionalAction module="reportes" action="crear">
              <TabsTrigger value="reports">Reportes</TabsTrigger>
            </ConditionalAction>
          </TabsList>
          
          <TabsContent value="analysis" className="mt-6">
            <AttendanceStudentsAnalysisTab />
          </TabsContent>
          
          <ConditionalAction module="reportes" action="crear">
            <TabsContent value="reports" className="mt-6">
              <AttendanceStudentsReportsTab />
            </TabsContent>
          </ConditionalAction>
        </Tabs>
      )}

      {activeSubmodule === 'coaches' && (
        <Tabs defaultValue="analysis" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="analysis">Análisis</TabsTrigger>
            <ConditionalAction module="reportes" action="crear">
              <TabsTrigger value="reports">Reportes</TabsTrigger>
            </ConditionalAction>
          </TabsList>
          
          <TabsContent value="analysis" className="mt-6">
            <AttendanceCoachesAnalysisTab />
          </TabsContent>
          
          <ConditionalAction module="reportes" action="crear">
            <TabsContent value="reports" className="mt-6">
              <AttendanceCoachesReportsTab />
            </TabsContent>
          </ConditionalAction>
        </Tabs>
      )}
    </div>
  );
};

export default ReportesAsistencias;
