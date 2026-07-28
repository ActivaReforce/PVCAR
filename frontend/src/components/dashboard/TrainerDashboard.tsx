
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardKPICard } from './DashboardKPICard';
import { AttendanceCard } from './AttendanceCard';
import { useTrainerDashboardData } from '@/hooks/useTrainerDashboardData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { School, Activity, Users, Award, UserCheck, Calendar, TrendingUp } from 'lucide-react';

export const TrainerDashboard = () => {
  const { user } = useAuth();
  const { data: queryResult, isLoading, error } = useTrainerDashboardData();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-4 lg:py-8 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Cargando datos del tablero...</div>
        </div>
      </div>
    );
  }

  if (error) {
    console.error('TrainerDashboard - Error loading data:', error);
    return (
      <div className="container mx-auto px-4 py-4 lg:py-8 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-500">Error al cargar los datos del tablero</div>
        </div>
      </div>
    );
  }

  const getDashboardTitle = () => {
    const isTrainer = user?.roles?.some(role => role.rol_id === 3);
    const isAssistant = user?.roles?.some(role => role.rol_id === 6);
    const isBackup = user?.roles?.some(role => role.rol_id === 7);

    if (isTrainer) return "Bienvenido al Tablero Informativo de Entrenador";
    if (isAssistant) return "Bienvenido al Tablero Informativo de Asistente";
    if (isBackup) return "Bienvenido al Tablero Informativo de Respaldo Entrenador";
    return "Tablero Informativo";
  };

  const getSubtitle = () => {
    const isAssistant = user?.roles?.some(role => role.rol_id === 6);
    const isBackup = user?.roles?.some(role => role.rol_id === 7);

    if (isAssistant && queryResult?.trainerName) return `Usted es asistente de ${queryResult.trainerName}`;
    if (isBackup && queryResult?.trainerName) return `Usted es respaldo del entrenador ${queryResult.trainerName}`;
    return "Gestiona tus actividades, alumnos y evaluaciones.";
  };

  const formatDisciplinasList = (disciplinas: string[]) => {
    if (disciplinas.length === 0) return "Sin disciplinas";
    if (disciplinas.length <= 2) return disciplinas.join(", ");
    return `${disciplinas.slice(0, 2).join(", ")} y ${disciplinas.length - 2} más`;
  };

  // Ensure we have data structure
  const dashboardData = queryResult?.data || {
    colegios: [],
    disciplinas: [],
    estudiantes: 0,
    evaluaciones: 0,
    asistenciaEstudiantes: { presente: 0, ausente: 0, tarde: 0, justificado: 0 },
    misAsistencias: { presente: 0, ausente: 0, tarde: 0, justificado: 0 }
  };

  return (
    <div className="container mx-auto px-4 py-4 lg:py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold">{getDashboardTitle()}</h1>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">
          {getSubtitle()}
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">

        {/* Colegios Details */}
        <Card className="dark:bg-card dark:border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <School className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              Mis Colegios
            </CardTitle>
            <CardDescription className="text-sm">
              Colegios donde tienes disciplinas asignadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.colegios && dashboardData.colegios.length > 0 ? (
                dashboardData.colegios.map((colegio, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                    <p className="text-sm font-medium">{colegio}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">No tienes colegios asignados</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Disciplinas Details */}
        <Card className="dark:bg-card dark:border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              Mis Disciplinas
            </CardTitle>
            <CardDescription className="text-sm">
              Disciplinas que tienes asignadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {dashboardData.disciplinas && dashboardData.disciplinas.length > 0 ? (
                dashboardData.disciplinas.map((disciplina, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                    <p className="text-sm font-medium">{disciplina}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">No tienes disciplinas asignadas</p>
              )}
            </div>
          </CardContent>
        </Card>
        
        <DashboardKPICard
          title="Alumnos"
          value={dashboardData.estudiantes || 0}
          icon={Users}
          description="Alumnos activos"
          color="text-purple-500"
        />

        <DashboardKPICard
          title="Evaluaciones Asignadas"
          value={dashboardData.evaluaciones || 0}
          icon={Award}
          description="Evaluaciones disponibles"
          color="text-orange-500"
        />
      </div>

      {/* Attendance Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <AttendanceCard
          title="Asistencia Alumnos"
          stats={dashboardData.asistenciaEstudiantes || { presente: 0, ausente: 0, tarde: 0, justificado: 0 }}
          isStudents={true}
        />

        {user?.roles?.some(role => role.rol_id === 3) && (
        <AttendanceCard
          title="Mis Asistencias"
          stats={dashboardData.misAsistencias || { presente: 0, ausente: 0, tarde: 0, justificado: 0 }}
          isStudents={false}
        />
      )}
    </div>

      
    </div>
  );
};
