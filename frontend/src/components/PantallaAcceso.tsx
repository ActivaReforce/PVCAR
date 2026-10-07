import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * El marco de las pantallas públicas de la cuenta (olvidé mi contraseña,
 * contraseña nueva): logo, tema y una tarjeta centrada, con los colores del
 * tema. Sustituye al fondo de cuadrícula en SVG y los colores fijos que
 * venían de la plantilla vieja.
 */
const PantallaAcceso = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <div className="min-h-screen bg-muted/30 text-foreground">
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <img src="/activaIcon.png" alt="" className="h-9 w-9 rounded" />
        <p className="flex-1 font-bold tracking-wide">ACTIVA REFORCE</p>
        <ThemeToggle />
      </div>
    </header>
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <section className="space-y-5 rounded-lg border bg-background p-5 shadow-sm sm:p-6">
        <h1 className="text-center text-xl font-semibold">{titulo}</h1>
        {children}
      </section>
    </main>
  </div>
);

export default PantallaAcceso;
