import { ReactNode } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import EncuestaPendiente from "@/components/encuestas/EncuestaPendiente";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="bg-background text-foreground">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4">{children}</main>
        </SidebarInset>

        {/*
          La encuesta pendiente del representante vive AQUI, dentro del layout,
          y no en App.tsx.

          El modal viejo se montaba fuera de la ruta y consultaba padre,
          encuesta y encuesta_respondida directo a Supabase en TODAS las
          pantallas: con RLS eso eran cuatro 403 en la consola cada vez que se
          abria cualquier pagina, y por eso estaba desmontado desde la Fase 4.

          Ahora pregunta una sola vez al API, y solo si quien mira tiene el rol
          de representante: sin el, ni siquiera se hace la llamada.
        */}
        <EncuestaPendiente />
      </div>
    </SidebarProvider>
  );
}
