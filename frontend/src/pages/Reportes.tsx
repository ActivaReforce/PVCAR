
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, School, BookOpen, Calendar, UserCog, GraduationCap, ClipboardList, UserCheck, MessageSquare, BarChart3 } from 'lucide-react';

const Reportes = () => {
  const navigate = useNavigate();
  
  const reportModules = [{
    id: 'users',
    title: 'Usuarios',
    description: 'Reportes de gestión de usuarios del sistema',
    icon: Users,
    route: '/reportes/usuarios',
    implemented: true,
    color: 'bg-blue-100 border-blue-300 hover:bg-blue-200 dark:text-black'
  }, {
    id: 'schools',
    title: 'Colegios',
    description: 'Reportes de instituciones educativas',
    icon: School,
    route: '/reportes/colegios',
    implemented: true,
    color: 'bg-green-100 border-green-300 hover:bg-green-200 dark:text-black'
  }, {
    id: 'activities',
    title: 'Actividades',
    description: 'Reportes de actividades extracurriculares',
    icon: BookOpen,
    route: '/reportes/actividades',
    implemented: true,
    color: 'bg-purple-100 border-purple-300 hover:bg-purple-200 dark:text-black'
  }, {
    id: 'disciplines',
    title: 'Disciplinas',
    description: 'Reportes de horarios y disciplinas',
    icon: Calendar,
    route: '/reportes/disciplinas',
    implemented: true,
    color: 'bg-orange-100 border-orange-300 hover:bg-orange-200 dark:text-black'
  }, {
    id: 'coaches',
    title: 'Entrenadores',
    description: 'Reportes de entrenadores y asignaciones',
    icon: UserCog,
    route: '/reportes/entrenadores',
    implemented: true,
    color: 'bg-pink-100 border-pink-300 hover:bg-pink-200 dark:text-black'
  }, {
    id: 'students',
    title: 'Alumnos',
    description: 'Reportes de alumnos y matriculaciones',
    icon: GraduationCap,
    route: '/reportes/estudiantes',
    implemented: true,
    color: 'bg-indigo-100 border-indigo-300 hover:bg-indigo-200 dark:text-black'
  }, {
    id: 'evaluations',
    title: 'Evaluaciones',
    description: 'Reportes de evaluaciones y calificaciones',
    icon: ClipboardList,
    route: '/reportes/evaluaciones',
    implemented: true,
    color: 'bg-yellow-100 border-yellow-300 hover:bg-yellow-200 dark:text-black'
  }, {
    id: 'attendance',
    title: 'Asistencias',
    description: 'Reportes de asistencia de alumnos y entrenadores',
    icon: UserCheck,
    route: '/reportes/asistencias',
    implemented: true,
    color: 'bg-teal-100 border-teal-300 hover:bg-teal-200 dark:text-black'
  }, {
    id: 'surveys',
    title: 'Encuestas',
    description: 'Reportes de encuestas y feedback',
    icon: MessageSquare,
    route: '/reportes/encuestas',
    implemented: true,
    color: 'bg-red-100 border-red-300 hover:bg-red-200 dark:text-black'
  }];

  const handleCardClick = (module: typeof reportModules[0]) => {
    if (module.implemented) {
      navigate(module.route);
    }
  };

  return (
    <div className="container mx-auto p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Reportes y Análisis
        </h1>
        <p className="text-muted-foreground">
          Genera reportes detallados de todos los módulos del sistema
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportModules.map(module => {
          const IconComponent = module.icon;
          return (
            <Card 
              key={module.id} 
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                module.implemented ? module.color : 'bg-gray-100 border-gray-300 hover:bg-gray-200 opacity-75'
              }`} 
              onClick={() => handleCardClick(module)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span className="flex items-center gap-2">
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                    {module.title}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {module.description}
                </p>
                {!module.implemented && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Esta funcionalidad estará disponible próximamente
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Reportes;
