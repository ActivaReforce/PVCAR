
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { MandatorySurveyManager } from "@/components/surveys/MandatorySurveyManager";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Usuarios from "@/pages/Usuarios";
import Colegios from "@/pages/Colegios";
import Actividades from "@/pages/Actividades";
import Disciplinas from "@/pages/Disciplinas";
import Entrenadores from "@/pages/Entrenadores";
import Estudiantes from "@/pages/Estudiantes";
import Evaluaciones from "@/pages/Evaluaciones";
import Asistencias from "@/pages/Asistencias";
import AsistenciasEntrenadores from "@/pages/AsistenciasEntrenadores";
import Reportes from "@/pages/Reportes";
import ReportesUsuarios from "@/pages/ReportesUsuarios";
import ReportesColegios from "@/pages/ReportesColegios";
import ReportesActividades from "@/pages/ReportesActividades";
import ReportesDisciplinas from "@/pages/ReportesDisciplinas";
import ReportesEntrenadores from "@/pages/ReportesEntrenadores";
import ReportesEstudiantes from "@/pages/ReportesEstudiantes";
import ReportesEncuestas from "@/pages/ReportesEncuestas";
import ReportesAsistencias from "@/pages/ReportesAsistencias";
import ReportesEvaluaciones from "@/pages/ReportesEvaluaciones";
import Encuestas from "@/pages/Encuestas";
import { SurveyBuilder } from "@/components/surveys/SurveyBuilder";
import Perfil from "@/pages/Perfil";
import NotFound from "@/pages/NotFound";
import Permisos from "@/pages/Permisos";

const App = () => {
  // Move QueryClient instantiation inside the component
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                {/* Destino del enlace del correo de recuperacion. Publica:
                    quien llega aqui todavia no puede iniciar sesion. */}
                <Route path="/reset-password" element={<ResetPassword />} />
                
                {/* Protected routes */}
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Routes>
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/usuarios" element={<Usuarios />} />
                          <Route path="/colegios" element={<Colegios />} />
                          <Route path="/actividades" element={<Actividades />} />
                          <Route path="/disciplinas" element={<Disciplinas />} />
                          <Route path="/entrenadores" element={<Entrenadores />} />
                          <Route path="/estudiantes" element={<Estudiantes />} />
                          <Route path="/evaluaciones" element={<Evaluaciones />} />
                          <Route path="/asistencias" element={<Asistencias />} />
                          <Route path="/attendance/coaches" element={<AsistenciasEntrenadores />} />
                          <Route path="/reportes" element={<Reportes />} />
                          <Route path="/reportes/usuarios" element={<ReportesUsuarios />} />
                          <Route path="/reportes/colegios" element={<ReportesColegios />} />
                          <Route path="/reportes/actividades" element={<ReportesActividades />} />
                          <Route path="/reportes/disciplinas" element={<ReportesDisciplinas />} />
                          <Route path="/reportes/entrenadores" element={<ReportesEntrenadores />} />
                          <Route path="/reportes/estudiantes" element={<ReportesEstudiantes />} />
                          <Route path="/reportes/encuestas" element={<ReportesEncuestas />} />
                          <Route path="/reportes/asistencias" element={<ReportesAsistencias />} />
                          <Route path="/reportes/evaluaciones" element={<ReportesEvaluaciones />} />
                          <Route path="/encuestas" element={<Encuestas />} />
                          <Route path="/encuestas/nueva" element={<SurveyBuilder />} />
                          <Route path="/encuestas/:id" element={<SurveyBuilder />} />
                          <Route path="/perfil" element={<Perfil />} />
                          <Route path="/permisos" element={<Permisos />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </AppLayout>
                      <MandatorySurveyManager />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
