
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardKPICard } from './DashboardKPICard';
import { AttendanceCard } from './AttendanceCard';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useAuth } from '@/contexts/AuthContext';
import { 
  School, 
  Users, 
  Activity, 
  Calendar, 
  BookOpen, 
  Award,
  ClipboardList 
} from 'lucide-react';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const { data: dashboardData, isLoading, error } = useDashboardData();

  // Determine if user is Admin PVCAR (role 1) or Admin Activa Reforce (role 5)
  const isAdminPVCAR = user?.roles?.some(role => role.rol_id === 1);
  const isAdminActivaReforce = user?.roles?.some(role => role.rol_id === 5);
  
  const getTitle = () => {
    if (isAdminPVCAR) {
      return "Bienvenido al Tablero Informativo de Propietario PVCAR";
    }
    if (isAdminActivaReforce) {
      return "Bienvenido al Tablero Informativo de Administrador Activa Reforce";
    }
    return "Tablero Informativo";
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-4 lg:py-8 max-w-7xl">
        <div className="text-center py-8">
          <p className="text-destructive">Error al cargar los datos del tablero</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 lg:py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4">{getTitle()}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Panel de control con métricas clave del sistema
        </p>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {isLoading ? (
          // Loading skeletons
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </>
        ) : (
          <>
            <DashboardKPICard
              title="Colegios"
              value={dashboardData?.colegios || 0}
              icon={School}
              description="Instituciones registradas"
              color="text-blue-500"
            />
            
            <DashboardKPICard
              title="Usuarios"
              value={dashboardData?.usuarios || 0}
              icon={Users}
              description="Usuarios activos"
              color="text-green-500"
            />
            
            <DashboardKPICard
              title="Actividades"
              value={dashboardData?.actividades || 0}
              icon={Activity}
              description="Actividades disponibles"
              color="text-purple-500"
            />
            
            <DashboardKPICard
              title="Disciplinas"
              value={dashboardData?.disciplinas || 0}
              icon={Calendar}
              description="Horarios activos"
              color="text-orange-500"
            />
          </>
        )}
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {isLoading ? (
          // Loading skeletons
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </>
        ) : (
          <>
            <DashboardKPICard
              title="Alumnos"
              value={dashboardData?.estudiantes || 0}
              icon={BookOpen}
              description="Alumnos activos"
              color="text-cyan-500"
            />
            
            <DashboardKPICard
              title="Evaluaciones"
              value={dashboardData?.evaluaciones || 0}
              icon={Award}
              description="Evaluaciones activas"
              color="text-red-500"
            />
            
            <DashboardKPICard
              title="Encuestas Publicadas"
              value={dashboardData?.encuestasPublicadas || 0}
              icon={ClipboardList}
              description="Encuestas en curso"
              color="text-indigo-500"
            />
          </>
        )}
      </div>

      {/* Attendance Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {isLoading ? (
          // Loading skeletons
          <>
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </>
        ) : (
          <>
            <AttendanceCard
              title="Asistencia Alumnos"
              stats={dashboardData?.asistenciaEstudiantes || { presente: 0, ausente: 0, tarde: 0, justificado: 0 }}
              isStudents={true}
            />
            
            <AttendanceCard
              title="Asistencia Entrenadores"
              stats={dashboardData?.asistenciaEntrenadores || { presente: 0, ausente: 0, tarde: 0, justificado: 0 }}
              isStudents={false}
            />
          </>
        )}
      </div>
    </div>
  );
};
