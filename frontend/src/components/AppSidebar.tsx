
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  LayoutDashboard, 
  School, 
  Users, 
  UserCog, 
  BookOpen, 
  GraduationCap,
  User,
  ClipboardList,
  BarChart3,
  MessageSquare,
  LogOut,
  Calendar,
  UserCheck,
  Users2,
  ShieldCheck
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const { setOpenMobile } = useSidebar();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    // Auto-close sidebar on mobile after navigation
    if (window.innerWidth < 640) {
      setOpenMobile(false);
    }
  };

  const allMenuItems = [
    { title: "Tablero", path: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
    { title: "Usuarios", path: "/usuarios", icon: Users, module: "usuarios" },
    { title: "Colegios", path: "/colegios", icon: School, module: "colegios" },
    { title: "Actividades", path: "/actividades", icon: BookOpen, module: "actividades" },
    { title: "Disciplinas", path: "/disciplinas", icon: Calendar, module: "disciplinas" },
    { title: "Entrenadores", path: "/entrenadores", icon: UserCog, module: "entrenadores" },
    { title: "Alumnos", path: "/estudiantes", icon: GraduationCap, module: "estudiantes" },
    { title: "Evaluaciones", path: "/evaluaciones", icon: ClipboardList, module: "evaluaciones" },
    { title: "Asistencias Alumnos", path: "/asistencias", icon: UserCheck, module: "asistencias_estudiantes" },
    { title: "Asistencias Entrenadores", path: "/attendance/coaches", icon: Users2, module: "asistencias_entrenadores" },
    { title: "Encuestas", path: "/encuestas", icon: MessageSquare, module: "encuestas" },
    { title: "Reportes", path: "/reportes", icon: BarChart3, module: "reportes" },
    { title: "Perfil", path: "/perfil", icon: User, module: "perfil" },
    { title: "Permisos", path: "/permisos", icon: ShieldCheck, module: "permisos" },
  ];

  const mainMenuItems = allMenuItems.filter(item => hasPermission(item.module));

  return (
    <Sidebar>
      <SidebarHeader className="flex items-center justify-between p-4">
        <h2 className="text-xl font-bold">Activa Reforce</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    isActive={location.pathname === item.path}
                    onClick={() => handleNavigation(item.path)}
                    tooltip={item.title}
                    className={`
                      ${location.pathname === item.path 
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-4 border-sidebar-primary dark:bg-red-500/20 dark:text-red-300 dark:border-red-500' 
                        : 'hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                      }
                      transition-all duration-200
                    `}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              {user && (
                <span className="text-sm truncate">
                  {user.usu_nombre}
                </span>
              )}
            </div>
            <ThemeToggle />
          </div>
          <Button 
            onClick={handleLogout} 
            variant="outline"
            size="sm"
            className="w-full justify-start text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
