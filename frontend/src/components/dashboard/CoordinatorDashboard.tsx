
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceCard } from './AttendanceCard';
import { DashboardKPICard } from './DashboardKPICard';
import { CoordinatorListCard } from './CoordinatorListCard';
import { useCoordinatorDashboardData } from '@/hooks/useCoordinatorDashboardData';
import { useAuth } from '@/contexts/AuthContext';
import { School, Calendar, BookOpen, Award } from 'lucide-react';

export const CoordinatorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data, isLoading, error } = useCoordinatorDashboardData();

  const title = "Bienvenido al Tablero Informativo de Coordinador de Colegio";

  if (error) {
    return (
      <div className="container mx-auto px-4 py-4 lg:py-8 max-w-7xl">
        <div className="text-center py-8">
          <p className="text-destructive">Error al cargar los datos del tablero</p>
        </div>
      </div>
    );
  }

  // Prepare list items
  const colegiosItems = (data?.colegios || []).map(c => ({ label: c.col_nombre }));
  const disciplinasItems = (data?.disciplinasPorColegio || []).map(d => ({
    label: d.col_nombre,
    value: `${d.count} ${d.count === 1 ? 'disciplina' : 'disciplinas'}`
  }));
  const estudiantesItems = (data?.estudiantesPorColegio || []).map(e => ({
    label: e.col_nombre,
    value: `${e.count} ${e.count === 1 ? 'estudiante' : 'estudiantes'}`
  }));

  return (
    <div className="container mx-auto px-4 py-4 lg:py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4">{title}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Panel de control con métricas filtradas para tus colegios
        </p>
      </div>

      {/* Top section: Colegio/s + Evaluaciones Asignadas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : (
          <>
            <CoordinatorListCard
              title="Colegio/s"
              icon={School}
              items={colegiosItems}
              color="text-blue-500"
              emptyText="Sin colegios asignados"
            />
            <CoordinatorListCard
              title="Disciplinas"
              icon={Calendar}
              items={disciplinasItems}
              color="text-orange-500"
              emptyText="Sin disciplinas"
            />
            <CoordinatorListCard
              title="Alumnos"
              icon={BookOpen}
              items={estudiantesItems}
              color="text-cyan-500"
              emptyText="Sin alumnos"
            />
          </>
        )}
      </div>

      {/* Secondary: Evaluaciones Asignadas total */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full" />
          </>
        ) : (
          <>
            <DashboardKPICard
              title="Evaluaciones Asignadas"
              value={data?.evaluacionesAsignadas || 0}
              icon={Award}
              description="Evaluaciones activas vinculadas"
              color="text-red-500"
            />
          </>
        )}
      </div>

      {/* Attendance Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {isLoading ? (
          <>
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </>
        ) : (
          <>
            <AttendanceCard
              title="Asistencia Alumnos"
              stats={data?.asistenciaEstudiantes || { presente: 0, ausente: 0, tarde: 0, justificado: 0 }}
              isStudents={true}
            />
            <AttendanceCard
              title="Asistencia Entrenadores"
              stats={data?.asistenciaEntrenadores || { presente: 0, ausente: 0, tarde: 0, justificado: 0 }}
              isStudents={false}
            />
          </>
        )}
      </div>
    </div>
  );
};
