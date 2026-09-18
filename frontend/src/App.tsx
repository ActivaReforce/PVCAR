import { lazy, Suspense, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";

/**
 * Las pantallas se cargan cuando se entra en ellas.
 *
 * Antes las 19 iban en un solo archivo de 1,43 MB: quien abría el login se
 * bajaba Recharts, las 9 definiciones de reporte y el constructor de encuestas
 * antes de poder escribir su contraseña. Desde Ecuador, con datos móviles, eso
 * es la diferencia entre entrar y esperar.
 *
 * `Login` NO es perezosa: es la primera pantalla de casi todas las visitas, y
 * hacerla esperar un segundo salto de red solo para ahorrar unos KB es el
 * cambio al revés.
 */
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Usuarios = lazy(() => import("@/pages/Usuarios"));
const Colegios = lazy(() => import("@/pages/Colegios"));
const Actividades = lazy(() => import("@/pages/Actividades"));
const Disciplinas = lazy(() => import("@/pages/Disciplinas"));
const Entrenadores = lazy(() => import("@/pages/Entrenadores"));
const Estudiantes = lazy(() => import("@/pages/Estudiantes"));
const Evaluaciones = lazy(() => import("@/pages/Evaluaciones"));
const AsistenciasAlumnos = lazy(() => import("@/pages/AsistenciasAlumnos"));
const AsistenciasEntrenadores = lazy(() => import("@/pages/AsistenciasEntrenadores"));
const Reportes = lazy(() => import("@/pages/Reportes"));
const ReporteDetalle = lazy(() => import("@/pages/ReporteDetalle"));
const Encuestas = lazy(() => import("@/pages/Encuestas"));
const Representantes = lazy(() => import("@/pages/Representantes"));
const Perfil = lazy(() => import("@/pages/Perfil"));
const Permisos = lazy(() => import("@/pages/Permisos"));
const NotFound = lazy(() => import("@/pages/NotFound"));

/**
 * Lo que se ve mientras llega el trozo de la pantalla.
 *
 * Sin texto: en una red buena dura 50 ms y un "Cargando…" que parpadea se lee
 * como un fallo. Ocupa el alto del contenido para que la barra lateral y la
 * cabecera no salten.
 */
const Cargando = () => (
  <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Cargando">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
  </div>
);

const App = () => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<Cargando />}>
                <Routes>
                  {/* Públicas */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  {/* Destino del enlace del correo de recuperación. Pública:
                      quien llega aquí todavía no puede iniciar sesión. */}
                  <Route path="/reset-password" element={<ResetPassword />} />

                  {/* Protegidas */}
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          {/* Suspense propio: el de fuera ya se resolvió al
                              montar el layout, así que sin este el salto entre
                              pantallas desmontaría la barra lateral. */}
                          <Suspense fallback={<Cargando />}>
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
                              <Route path="/asistencias" element={<AsistenciasAlumnos />} />
                              <Route
                                path="/asistencias/entrenadores"
                                element={<AsistenciasEntrenadores />}
                              />
                              <Route path="/reportes" element={<Reportes />} />
                              <Route path="/reportes/:modulo" element={<ReporteDetalle />} />
                              <Route path="/encuestas" element={<Encuestas />} />
                              <Route path="/representantes" element={<Representantes />} />
                              <Route path="/perfil" element={<Perfil />} />
                              <Route path="/permisos" element={<Permisos />} />
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </Suspense>
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
