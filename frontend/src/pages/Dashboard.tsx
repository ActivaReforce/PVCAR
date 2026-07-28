import { useAuth } from "@/contexts/AuthContext";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { CoordinatorDashboard } from "@/components/dashboard/CoordinatorDashboard";
import { TrainerDashboard } from "@/components/dashboard/TrainerDashboard";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, School, Activity, BookOpen, TrendingUp, UserCheck, Calendar, Award } from "lucide-react";

const Dashboard = () => {
  const { user } = useAuth();
  
  // Early return if no user
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-4 lg:py-8 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  // Check roles - ensure we have roles array
  const userRoles = user.roles || [];
  
  // Check if user has Admin PVCAR (role 1) or Admin Activa Reforce (role 5)
  const isAdminPVCAR = userRoles.some(role => role.rol_id === 1);
  const isAdminActivaReforce = userRoles.some(role => role.rol_id === 5);
  const isCoordinator = userRoles.some(role => role.rol_id === 2);
  const isTrainer = userRoles.some(role => role.rol_id === 3);
  const isParent = userRoles.some(role => role.rol_id === 4);
  const isAssistant = userRoles.some(role => role.rol_id === 6);
  const isBackup = userRoles.some(role => role.rol_id === 7);
  
  
  // If user is Admin PVCAR or Admin Activa Reforce, show the admin dashboard
  if (isAdminPVCAR || isAdminActivaReforce) {
    return <AdminDashboard />;
  }

  // If user is Coordinador de Colegio (role 2), show coordinator dashboard
  if (isCoordinator) {
    return <CoordinatorDashboard />;
  }

  // If user is Entrenador (role 3), Asistente (role 6), or Respaldo Entrenador (role 7), show trainer dashboard
  if (isTrainer || isAssistant || isBackup) {
    return <TrainerDashboard />;
  }

  // If user is Padre (role 4), show parent dashboard
  if (isParent) {
    return <ParentDashboard />;
  }

  // Fallback dashboard for other roles (like Padre - role 4)
  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case "AdminGlobal":
        return "bg-red-500 hover:bg-red-600 text-white";
      case "AdminColegio":
        return "bg-orange-500 hover:bg-orange-600 text-white";
      case "Entrenador":
        return "bg-yellow-500 hover:bg-yellow-600 text-white";
      case "Padre":
        return "bg-green-500 hover:bg-green-600 text-white";
      default:
        return "bg-gray-500 hover:bg-gray-600 text-white";
    }
  };

  // Get primary role for dashboard logic
  const getPrimaryRole = () => {
    if (!userRoles || userRoles.length === 0) return null;
    
    // Priority order: AdminGlobal > AdminColegio > Entrenador > Padre
    const rolePriority = ['AdminGlobal', 'AdminColegio', 'Entrenador', 'Padre'];
    
    for (const priority of rolePriority) {
      const role = userRoles.find(r => 
        r.rol_nombre === priority.toLowerCase() || 
        r.rol_titulo === priority ||
        (priority === 'AdminGlobal' && r.rol_id === 1) ||
        (priority === 'AdminColegio' && r.rol_id === 2) ||
        (priority === 'Entrenador' && r.rol_id === 3) ||
        (priority === 'Padre' && r.rol_id === 4)
      );
      if (role) return priority;
    }
    
    return userRoles[0]?.rol_titulo || 'Usuario';
  };

  // Role-based dashboard statistics
  const getStatsForRole = () => {
    const primaryRole = getPrimaryRole();
    
    switch (primaryRole) {
      case "AdminGlobal":
        return [{
          title: "Colegios",
          value: "12",
          icon: School,
          description: "Instituciones activas",
          color: "text-red-500"
        }, {
          title: "Usuarios",
          value: "328",
          icon: Users,
          description: "Usuarios registrados",
          color: "text-red-500"
        }, {
          title: "Actividades",
          value: "46",
          icon: Activity,
          description: "Actividades disponibles",
          color: "text-red-500"
        }, {
          title: "Alumnos",
          value: "1254",
          icon: BookOpen,
          description: "Alumnos inscritos",
          color: "text-red-500"
        }];
      case "AdminColegio":
        return [{
          title: "Mi Colegio",
          value: "1",
          icon: School,
          description: "Colegio asignado",
          color: "text-orange-500"
        }, {
          title: "Personal",
          value: "24",
          icon: UserCheck,
          description: "Entrenadores y admin",
          color: "text-orange-500"
        }, {
          title: "Actividades",
          value: "8",
          icon: Activity,
          description: "Actividades del colegio",
          color: "text-orange-500"
        }, {
          title: "Alumnos",
          value: "234",
          icon: BookOpen,
          description: "Alumnos inscritos",
          color: "text-orange-500"
        }];
      case "Entrenador":
        return [{
          title: "Mis Actividades",
          value: "3",
          icon: Activity,
          description: "Actividades asignadas",
          color: "text-yellow-500"
        }, {
          title: "Mis Alumnos",
          value: "45",
          icon: BookOpen,
          description: "Alumnos que entreno",
          color: "text-yellow-500"
        }, {
          title: "Colegios",
          value: "2",
          icon: School,
          description: "Colegios donde trabajo",
          color: "text-yellow-500"
        }, {
          title: "Evaluaciones",
          value: "12",
          icon: Award,
          description: "Evaluaciones pendientes",
          color: "text-yellow-500"
        }];
      case "Padre":
        return [{
          title: "Mis Hijos",
          value: "2",
          icon: BookOpen,
          description: "Hijos registrados",
          color: "text-green-500"
        }, {
          title: "Actividades",
          value: "4",
          icon: Activity,
          description: "Inscripciones activas",
          color: "text-green-500"
        }, {
          title: "Colegios",
          value: "1",
          icon: School,
          description: "Colegio de mis hijos",
          color: "text-green-500"
        }, {
          title: "Reportes",
          value: "6",
          icon: TrendingUp,
          description: "Reportes disponibles",
          color: "text-green-500"
        }];
      default:
        return [];
    }
  };
  
  const getWelcomeMessage = () => {
    const primaryRole = getPrimaryRole();
    
    switch (primaryRole) {
      case "AdminGlobal":
        return {
          title: "Bienvenido al Panel de Administración Global",
          subtitle: "Desde aquí puedes gestionar todos los aspectos de Activa Reforce."
        };
      case "AdminColegio":
        return {
          title: "Panel de Administración del Colegio",
          subtitle: "Gestiona las actividades, entrenadores y alumnos de tu institución."
        };
      case "Entrenador":
        return {
          title: "Panel del Entrenador",
          subtitle: "Administra tus actividades, alumnos y evaluaciones."
        };
      case "Padre":
        return {
          title: "Portal de Padres",
          subtitle: "Consulta el progreso y actividades de tus hijos."
        };
      default:
        return {
          title: "Panel de Control",
          subtitle: "Bienvenido a Activa Reforce."
        };
    }
  };
  
  const stats = getStatsForRole();
  const welcomeMessage = getWelcomeMessage();
  
  return (
    <div className="container mx-auto px-4 py-4 lg:py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold">{welcomeMessage.title}</h1>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">
          {welcomeMessage.subtitle}
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition-all duration-200 dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-card-foreground">{stat.title}</CardTitle>
                <IconComponent className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl sm:text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Activity Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Recent Activities */}
        <Card className="dark:bg-card dark:border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              Actividades Recientes
            </CardTitle>
            <CardDescription className="text-sm">
              Próximamente: Historial de acciones recientes en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                <p className="text-sm">Nueva actividad "Entrenamiento de Fútbol" creada</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                <p className="text-sm">Evaluación de alumno completada</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                <p className="text-sm">Nuevo reporte generado</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="dark:bg-card dark:border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              Eventos Próximos
            </CardTitle>
            <CardDescription className="text-sm">
              Próximamente: Calendario con eventos y actividades programadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-muted rounded-lg gap-2">
                <div>
                  <p className="font-medium text-sm sm:text-base">Evaluación Trimestral</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">15 de Enero, 2025</p>
                </div>
                <Badge variant="outline" className="text-xs">Próximo</Badge>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-muted rounded-lg gap-2">
                <div>
                  <p className="font-medium text-sm sm:text-base">Torneo Intercolegiado</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">22 de Enero, 2025</p>
                </div>
                <Badge variant="outline" className="text-xs">Evento</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
