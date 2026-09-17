import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { tableroApi, type TableroId } from '@/api/tablero';
import { reportesApi, type FiltrosReporte } from '@/api/reportes';

/**
 * El tablero se pide con su periodo: la clave de caché lo incluye, así que
 * cambiar el rango trae datos nuevos en vez de enseñar los de antes.
 *
 * Sin `refetchInterval`. El sistema viejo recargaba los cuatro tableros cada
 * 60 segundos, y cada recarga eran entre 9 y 14 consultas más la descarga de
 * las 13 202 filas de asistencia. Un tablero no es un monitor en tiempo real.
 */
export function useTablero(rol: TableroId | undefined, desde?: string, hasta?: string) {
  return useQuery({
    queryKey: ['tablero', rol ?? 'auto', desde ?? '', hasta ?? ''],
    queryFn: () => tableroApi.cargar(rol, desde, hasta),
    staleTime: 60 * 1000,
    placeholderData: (anterior) => anterior,
  });
}

function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

export function useCatalogoReportes() {
  return useQuery({
    queryKey: ['reportes', 'catalogo'],
    queryFn: () => reportesApi.catalogo(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useReporte(
  modulo: string,
  filtros: FiltrosReporte,
  page: number,
  limit: number,
  habilitado: boolean,
) {
  return useQuery({
    queryKey: ['reportes', modulo, filtros, page, limit],
    queryFn: () => reportesApi.consultar(modulo, filtros, page, limit),
    enabled: habilitado,
    placeholderData: (anterior) => anterior,
  });
}

/**
 * Las gráficas del reporte.
 *
 * Van por su cuenta y no bloquean la tabla: si el análisis tarda, la pestaña de
 * datos ya está en pantalla.
 */
export function useAnalisisReporte(modulo: string, filtros: FiltrosReporte, habilitado: boolean) {
  return useQuery({
    queryKey: ['reportes', modulo, 'analisis', filtros],
    queryFn: () => reportesApi.analisis(modulo, filtros),
    enabled: habilitado,
    placeholderData: (anterior) => anterior,
  });
}

/**
 * La exportación no es una consulta: descarga un archivo y no cachea nada.
 *
 * El aviso de error importa más de lo que parece. Si el backend contesta un
 * 403, el cliente lo detecta y avisa; sin eso el navegador guardaría un .xlsx
 * que al abrirlo dice "Sin permiso", que es lo que hacía el sistema viejo
 * cuando la consulta fallaba a medias.
 */
export function useExportarReporte() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ modulo, filtros }: { modulo: string; filtros: FiltrosReporte }) =>
      reportesApi.exportar(modulo, filtros),
    onSuccess: () => {
      toast({ title: 'Archivo generado', description: 'Revisa tus descargas.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'No se pudo exportar',
        description: mensajeDe(error),
        variant: 'destructive',
      });
    },
  });
}
