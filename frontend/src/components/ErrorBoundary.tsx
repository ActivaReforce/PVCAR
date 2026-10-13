import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Si una pantalla revienta, se dice y se ofrece recargar.
 *
 * Sin esto React desmonta toda la aplicación y queda solo el fondo del
 * `body`: en modo oscuro, una pantalla negra sin nada que tocar. Así lo
 * reportó una familia en /inscripcion al elegir el parentesco (con el
 * traductor del navegador activo; ver index.html). También cubre el trozo
 * de una pantalla que ya no existe tras un despliegue.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div role="alert" className="w-full max-w-md space-y-4 rounded-lg border p-6 text-center">
          <p className="text-lg font-semibold">Algo falló al mostrar la página</p>
          <p className="text-sm text-muted-foreground">
            Recarga la página para seguir. Si usas el traductor del navegador, desactívalo para esta página.
          </p>
          <Button className="h-11 w-full" onClick={() => window.location.reload()}>
            Recargar
          </Button>
          <p className="break-words text-xs text-muted-foreground">{this.state.error.message}</p>
        </div>
      </div>
    );
  }
}
