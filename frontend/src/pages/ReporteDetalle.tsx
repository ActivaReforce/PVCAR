import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import { DataPagination } from '@/components/ui/data-pagination';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import { useColegios } from '@/hooks/useColegios';
import { useCatalogoReportes, useExportarReporte, useReporte } from '@/hooks/useTablero';
import type { FiltrosReporte } from '@/api/reportes';

const POR_PAGINA = 50;
const TODOS = 'todos';

/**
 * Una pantalla para los nueve reportes.
 *
 * Las columnas, el título y si hace falta rango de fechas vienen del catálogo
 * del backend, así que añadir un reporte es añadir una definición allí y nada
 * aquí. El sistema viejo tenía nueve páginas y dieciocho componentes.
 *
 * **Lo que se ve es lo que se exporta.** Los mismos filtros van a la consulta
 * y al Excel, y el archivo lleva una segunda hoja que los deja escritos. Antes
 * la pestaña de análisis y la de exportar tenían filtros distintos y nadie
 * podía saber con qué criterios se había sacado una hoja.
 */
const ReporteDetalle = () => {
  const { modulo = '' } = useParams();

  const [busqueda, setBusqueda] = useState('');
  const [colegio, setColegio] = useState(TODOS);
  const [estado, setEstado] = useState(TODOS);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [page, setPage] = useState(1);

  const catalogo = useCatalogoReportes();
  const definicion = catalogo.data?.find((r) => r.id === modulo);
  const colegios = useColegios({ limit: 200, orden: 'nombre' });
  const exportar = useExportarReporte();

  const filtros: FiltrosReporte = {
    buscar: busqueda || undefined,
    colegio: colegio === TODOS ? undefined : [Number(colegio)],
    estado: estado === TODOS ? undefined : Number(estado),
    desde: desde || undefined,
    hasta: hasta || undefined,
  };

  const faltanFechas = Boolean(definicion?.exigeRango) && (!desde || !hasta);
  const listo = Boolean(definicion) && !faltanFechas;

  const reporte = useReporte(modulo, filtros, page, POR_PAGINA, listo);

  const cambiarFiltro = (accion: () => void) => {
    accion();
    setPage(1);
  };

  if (catalogo.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  if (!definicion) {
    return (
      <div className="container mx-auto space-y-4 p-6">
        <p className="text-destructive">
          Ese reporte no existe o no tienes permiso para verlo.
        </p>
        <Button asChild variant="outline">
          <Link to="/reportes">Volver a Reportes</Link>
        </Button>
      </div>
    );
  }

  const columnas = reporte.data?.columnas ?? definicion.columnas;
  const filas = reporte.data?.filas ?? [];
  const total = reporte.data?.total ?? 0;
  const totalPages = reporte.data?.totalPages ?? 0;

  return (
    <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <Button asChild variant="ghost" className="-ml-3 mb-1 h-8">
            <Link to="/reportes">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Reportes
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{definicion.titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {definicion.descripcion}
            {listo && ` · ${total} fila${total === 1 ? '' : 's'}`}
          </p>
        </div>

        {/* Exportar exige `reportes:crear`; la ruta lo vuelve a comprobar. */}
        <ConditionalAction module="reportes" action="crear">
          <Button
            variant="brand"
            className="h-11 w-full sm:h-10 sm:w-auto"
            disabled={!listo || exportar.isPending || total === 0}
            onClick={() => exportar.mutate({ modulo, filtros })}
          >
            {exportar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Exportar a Excel
          </Button>
        </ConditionalAction>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DebouncedSearchInput
          placeholder="Buscar…"
          value={busqueda}
          onChange={(texto) => cambiarFiltro(() => setBusqueda(texto))}
          className="w-full"
        />

        <Select value={colegio} onValueChange={(v) => cambiarFiltro(() => setColegio(v))}>
          <SelectTrigger className="h-11 sm:h-10">
            <SelectValue placeholder="Todos los colegios" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los colegios</SelectItem>
            {(colegios.data?.items ?? []).map((c) => (
              <SelectItem key={c.col_id} value={String(c.col_id)}>
                {c.col_nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <div className="space-y-1">
            <Label htmlFor="desde" className="text-xs">
              Desde {definicion.exigeRango && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="desde"
              type="date"
              value={desde}
              max={hasta || undefined}
              onChange={(e) => cambiarFiltro(() => setDesde(e.target.value))}
              className="h-11 sm:h-10"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hasta" className="text-xs">
              Hasta {definicion.exigeRango && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="hasta"
              type="date"
              value={hasta}
              min={desde || undefined}
              onChange={(e) => cambiarFiltro(() => setHasta(e.target.value))}
              className="h-11 sm:h-10"
            />
          </div>
        </div>

        <Select value={estado} onValueChange={(v) => cambiarFiltro(() => setEstado(v))}>
          <SelectTrigger className="h-11 sm:h-10">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los estados</SelectItem>
            <SelectItem value="1">Activo</SelectItem>
            <SelectItem value="2">Inactivo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {faltanFechas && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Este reporte necesita un rango de fechas. Elige <strong>desde</strong> y{' '}
          <strong>hasta</strong> para verlo.
        </p>
      )}

      {reporte.isError && (
        <p className="py-8 text-center text-destructive">{(reporte.error as Error).message}</p>
      )}

      {listo && reporte.isLoading && (
        <p className="py-12 text-center text-muted-foreground">Consultando…</p>
      )}

      {listo && reporte.data && filas.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <p className="text-lg">No hay filas con esos filtros</p>
        </div>
      )}

      {filas.length > 0 && (
        <>
          {/* La tabla desborda en horizontal a propósito: un reporte tiene las
              columnas que tiene, y en el teléfono se mira desplazándose. */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {columnas.map((c) => (
                    <th
                      key={c.clave}
                      className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground"
                    >
                      {c.cabecera}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filas.map((fila, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    {columnas.map((c) => (
                      <td key={c.clave} className="max-w-xs truncate px-3 py-2">
                        {String(fila[c.clave] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DataPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            canGoNext={page < totalPages}
            canGoPrevious={page > 1}
            startIndex={(page - 1) * POR_PAGINA}
            endIndex={Math.min(page * POR_PAGINA, total)}
            totalItems={total}
            itemName="filas"
          />
        </>
      )}
    </div>
  );
};

export default ReporteDetalle;
