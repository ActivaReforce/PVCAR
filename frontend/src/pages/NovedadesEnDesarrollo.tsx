import { Construction } from 'lucide-react';

/**
 * Pantalla temporal de Novedades para producción, mientras el módulo se
 * prueba en dev. App.tsx la elige cuando el build apunta al backend de
 * producción. Se borra cuando Novedades quede aprobado.
 */
const NovedadesEnDesarrollo = () => (
  <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Novedades</h1>
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card px-4 py-16 text-center">
      <Construction className="h-10 w-10 text-muted-foreground" />
      <p className="text-lg font-semibold text-foreground">En desarrollo</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Este módulo todavía se está probando. Estará disponible pronto.
      </p>
    </div>
  </div>
);

export default NovedadesEnDesarrollo;
