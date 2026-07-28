
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { School, Activity, Award, Users } from "lucide-react";
import { DashboardKPICard } from "./DashboardKPICard";
import { AcademicPerformanceSection } from "./AcademicPerformanceSection";
import { useParentDashboardData } from "@/hooks/useParentDashboardData";

export const ParentDashboard = () => {
  const { data, isLoading, error } = useParentDashboardData();
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);

  // Set initial selected child when data loads
  React.useEffect(() => {
    if (data?.children && data.children.length > 0 && !selectedChildId) {
      setSelectedChildId(data.children[0].nino_id);
    }
  }, [data, selectedChildId]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-4 lg:py-8 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Cargando...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-4 lg:py-8 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-500">Error al cargar los datos del tablero</div>
        </div>
      </div>
    );
  }

  const { children, parentName } = data;
  const selectedChild = children.find(child => child.nino_id === selectedChildId);

  // Generate subtitle based on number of children
  const getSubtitle = () => {
    if (children.length === 1) {
      return `Usted es representante de ${children[0].nino_nombre}`;
    } else {
      const childNames = children.map(child => child.nino_nombre).join(' | ');
      return `Usted es representante de ${childNames}`;
    }
  };

  // Get attendance percentages for selected child
  const getAttendanceStats = () => {
    if (!selectedChild?.asistencias) {
      return { presente: 0, ausente: 0, tarde: 0, justificado: 0 };
    }

    const total = selectedChild.asistencias.length;
    if (total === 0) {
      return { presente: 0, ausente: 0, tarde: 0, justificado: 0 };
    }

    const counts = selectedChild.asistencias.reduce((acc, asistencia) => {
      acc[asistencia.asisest_id] = (acc[asistencia.asisest_id] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return {
      presente: Math.round(((counts[1] || 0) / total) * 100),
      ausente: Math.round(((counts[2] || 0) / total) * 100),
      tarde: Math.round(((counts[3] || 0) / total) * 100),
      justificado: Math.round(((counts[4] || 0) / total) * 100),
    };
  };

  // Helper para sacar primer nombre
  const getFirstName = (fullName?: string) =>
    (fullName?.trim().split(/\s+/)[0] ?? "Sin nombre");

  return (
    <div className="container mx-auto px-4 py-4 lg:py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold">Bienvenido al Tablero Informativo de Representante</h1>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">
          {getSubtitle()}
        </p>
      </div>

      {/* Children Tabs */}
      {children.length > 1 ? (
        <Tabs value={selectedChildId?.toString()} onValueChange={(value) => setSelectedChildId(parseInt(value))}>
          <TabsList className="mb-6">
            {children.map((child, index) => (
              <TabsTrigger
                key={child.nino_id}
                value={child.nino_id.toString()}
                title={child.nino_nombre}
                className="max-w-[140px] truncate"
              >
                {getFirstName(child.nino_nombre)}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {children.map((child) => (
            <TabsContent key={child.nino_id} value={child.nino_id.toString()}>
              <div className="space-y-6">
                {selectedChild && selectedChild.nino_id === child.nino_id && (
                  <>
                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                      <DashboardKPICard
                        title="Colegio"
                        value={selectedChild.colegio?.col_nombre || "N/A"}
                        icon={School}
                        color="text-blue-500"
                      />
                      
                      <Card className="hover:shadow-lg transition-all duration-200 dark:bg-card dark:border-border">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-card-foreground">
                            Disciplinas ({selectedChild.disciplinas?.length || 0})
                          </CardTitle>
                          <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl sm:text-3xl font-bold text-green-500 mb-2">
                            {selectedChild.disciplinas?.length || 0}
                          </div>
                          {selectedChild.disciplinas && selectedChild.disciplinas.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                              {selectedChild.disciplinas.map((disciplina, index) => (
                                <span 
                                  key={index} 
                                  className="inline-block text-xs bg-muted px-2 py-1 rounded truncate max-w-[120px]"
                                  title={`${disciplina.actividad_nombre} - ${disciplina.dia_nombre} ${disciplina.horario}`}
                                >
                                  {disciplina.actividad_nombre}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No hay disciplinas activas</p>
                          )}
                        </CardContent>
                      </Card>
                      
                      <DashboardKPICard
                        title="Evaluaciones"
                        value={`${selectedChild.evaluacionesCompletas || 0}/${selectedChild.evaluacionesTotal || 0}`}
                        icon={Award}
                        description="Completas / Total"
                        color="text-purple-500"
                      />
                      
                      <Card className="hover:shadow-lg transition-all duration-200 dark:bg-card dark:border-border">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-card-foreground">Asistencia General</CardTitle>
                          <Users className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                              <div>
                                <p className="text-xs text-muted-foreground">Presente</p>
                                <p className="font-bold text-green-600">{getAttendanceStats().presente}%</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                              <div>
                                <p className="text-xs text-muted-foreground">Ausente</p>
                                <p className="font-bold text-red-600">{getAttendanceStats().ausente}%</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 bg-yellow-500 rounded-full flex-shrink-0"></div>
                              <div>
                                <p className="text-xs text-muted-foreground">Tarde</p>
                                <p className="font-bold text-yellow-600">{getAttendanceStats().tarde}%</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                              <div>
                                <p className="text-xs text-muted-foreground">Justificado</p>
                                <p className="font-bold text-blue-600">{getAttendanceStats().justificado}%</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Academic Performance Section */}
                    <AcademicPerformanceSection selectedChild={selectedChild} />
                  </>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        // Single child - no tabs needed
        selectedChild && (
          <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
              <DashboardKPICard
                title="Colegio"
                value={selectedChild.colegio?.col_nombre || "N/A"}
                icon={School}
                color="text-blue-500"
              />
              
              <Card className="hover:shadow-lg transition-all duration-200 dark:bg-card dark:border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-card-foreground">
                    Disciplinas ({selectedChild.disciplinas?.length || 0})
                  </CardTitle>
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl sm:text-3xl font-bold text-green-500 mb-2">
                    {selectedChild.disciplinas?.length || 0}
                  </div>
                  {selectedChild.disciplinas && selectedChild.disciplinas.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                      {selectedChild.disciplinas.map((disciplina, index) => (
                        <span 
                          key={index} 
                          className="inline-block text-xs bg-muted px-2 py-1 rounded truncate max-w-[120px]"
                          title={`${disciplina.actividad_nombre} - ${disciplina.dia_nombre} ${disciplina.horario}`}
                        >
                          {disciplina.actividad_nombre}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No hay disciplinas activas</p>
                  )}
                </CardContent>
              </Card>
              
              <DashboardKPICard
                title="Evaluaciones"
                value={`${selectedChild.evaluacionesCompletas || 0}/${selectedChild.evaluacionesTotal || 0}`}
                icon={Award}
                description="Completas / Total"
                color="text-purple-500"
              />
              
              <Card className="hover:shadow-lg transition-all duration-200 dark:bg-card dark:border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-card-foreground">Asistencias</CardTitle>
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                      <div>
                        <p className="text-xs text-muted-foreground">Presente</p>
                        <p className="font-bold text-green-600">{getAttendanceStats().presente}%</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                      <div>
                        <p className="text-xs text-muted-foreground">Ausente</p>
                        <p className="font-bold text-red-600">{getAttendanceStats().ausente}%</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full flex-shrink-0"></div>
                      <div>
                        <p className="text-xs text-muted-foreground">Tarde</p>
                        <p className="font-bold text-yellow-600">{getAttendanceStats().tarde}%</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                      <div>
                        <p className="text-xs text-muted-foreground">Justificado</p>
                        <p className="font-bold text-blue-600">{getAttendanceStats().justificado}%</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Academic Performance Section */}
            <AcademicPerformanceSection selectedChild={selectedChild} />
          </div>
        )
      )}
    </div>
  );
};
