
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SchoolAnalysisTab from '@/components/reports/SchoolAnalysisTab';
import SchoolReportsTab from '@/components/reports/SchoolReportsTab';
import { ConditionalAction } from '@/components/ui/conditional-actions';

const ReportesColegios = () => {
  const navigate = useNavigate();

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
          Reportes de Colegios
        </h1>
        <p className="text-muted-foreground">
          Analiza y exporta reportes detallados de todas las instituciones educativas
        </p>
      </div>

      <Tabs defaultValue="analysis" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="analysis">Análisis</TabsTrigger>
          <ConditionalAction module="reportes" action="crear">
            <TabsTrigger value="reports">Reportes</TabsTrigger>
          </ConditionalAction>
        </TabsList>
        
        <TabsContent value="analysis" className="mt-6">
          <SchoolAnalysisTab />
        </TabsContent>
        
        <ConditionalAction module="reportes" action="crear">
          <TabsContent value="reports" className="mt-6">
            <SchoolReportsTab />
          </TabsContent>
        </ConditionalAction>
      </Tabs>
    </div>
  );
};

export default ReportesColegios;
