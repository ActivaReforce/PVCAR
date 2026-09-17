import { Link } from 'react-router-dom';
import { CalendarRange, FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCatalogoReportes } from '@/hooks/useTablero';

/**
 * Índice de Reportes.
 *
 * La lista **la decide el backend**: solo salen los reportes para los que se
 * tiene el permiso del módulo de origen. Antes eran nueve rutas fijas en el
 * menú y un entrenador entraba al de Usuarios y se descargaba la tabla entera
 * de personas.
 */
const Reportes = () => {
  const catalogo = useCatalogoReportes();

  if (catalogo.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Cargando reportes...</div>
      </div>
    );
  }

  if (catalogo.isError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">
          No se pudieron cargar los reportes: {(catalogo.error as Error).message}
        </p>
      </div>
    );
  }

  const reportes = catalogo.data ?? [];

  return (
    <div className="container mx-auto min-w-0 max-w-5xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada reporte se ve en pantalla y se puede bajar en Excel. Todos respetan tu alcance.
        </p>
      </div>

      {reportes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg">No tienes ningún reporte disponible</p>
            <p className="mt-2 text-sm">
              Cada reporte necesita el permiso de ver su módulo de origen.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {reportes.map((r) => (
          <Link key={r.id} to={`/reportes/${r.id}`} className="block">
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="truncate">{r.titulo}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{r.descripcion}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{r.columnas.length} columnas</Badge>
                  {r.exigeRango && (
                    <Badge variant="outline" className="gap-1">
                      <CalendarRange className="h-3 w-3" />
                      Pide fechas
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Reportes;
