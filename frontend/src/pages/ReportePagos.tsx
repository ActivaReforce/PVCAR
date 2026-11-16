import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCatalogoReportes } from '@/hooks/useTablero';
import ReporteDetalle from './ReporteDetalle';
import { PAGOS } from '@/api/reportes';

/**
 * Reportes → Pagos (cliente, 2026-11-16): una pestaña por reporte,
 * Inscripciones (como siempre) y Mensualidades (el estado de cada mes),
 * cada una con sus filtros, sus cifras y su Excel. Solo salen las que el
 * catálogo permite.
 */
const ReportePagos = () => {
  const catalogo = useCatalogoReportes();
  const disponibles = PAGOS.reportes
    .map((id) => catalogo.data?.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <div className="container mx-auto min-w-0 space-y-4 p-4 lg:p-6">
      <div>
        <Button asChild variant="ghost" className="-ml-3 mb-1 h-8">
          <Link to="/reportes">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Reportes
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{PAGOS.titulo}</h1>
      </div>

      {catalogo.isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {!catalogo.isLoading && disponibles.length === 0 && (
        <p className="text-destructive">No tienes permiso para ver estos reportes.</p>
      )}

      {disponibles.length > 0 && (
        <Tabs defaultValue={disponibles[0]!.id}>
          <TabsList>
            {disponibles.map((r) => (
              <TabsTrigger key={r.id} value={r.id}>
                {r.titulo}
              </TabsTrigger>
            ))}
          </TabsList>
          {disponibles.map((r) => (
            <TabsContent key={r.id} value={r.id} className="pt-2">
              <ReporteDetalle id={r.id} embebido />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

export default ReportePagos;
