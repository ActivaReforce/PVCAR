import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import {
  historicoApi,
  type FiltrosHistorico,
  type FiltrosResumen,
  type Orden,
} from '@/api/historico';

/**
 * Data anterior no cambia nunca —es una copia congelada—, así que el catálogo
 * y las opciones de los filtros no caducan en toda la sesión, y las consultas
 * aguantan cinco minutos sin volver a pedirse.
 */
const NO_CAMBIA = Infinity;
const CINCO_MINUTOS = 5 * 60 * 1000;

export function useConjuntosHistorico(habilitado = true) {
  return useQuery({
    queryKey: ['historico', 'conjuntos'],
    queryFn: () => historicoApi.conjuntos(),
    staleTime: NO_CAMBIA,
    enabled: habilitado,
  });
}

export function useOpcionesHistorico() {
  return useQuery({
    queryKey: ['historico', 'opciones'],
    queryFn: () => historicoApi.opciones(),
    staleTime: NO_CAMBIA,
  });
}

export function useResumenHistorico(filtros: FiltrosResumen) {
  return useQuery({
    queryKey: ['historico', 'resumen', filtros],
    queryFn: () => historicoApi.resumen(filtros),
    staleTime: CINCO_MINUTOS,
    placeholderData: (anterior) => anterior,
  });
}

export function useConjuntoHistorico(
  id: string | undefined,
  filtros: FiltrosHistorico,
  orden: Orden,
  page: number,
  limit: number,
) {
  return useQuery({
    queryKey: ['historico', 'conjunto', id, filtros, orden, page, limit],
    queryFn: () => historicoApi.consultar(id!, filtros, orden, page, limit),
    enabled: Boolean(id),
    staleTime: CINCO_MINUTOS,
    placeholderData: (anterior) => anterior,
  });
}

function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

/** Exportar un conjunto (con filtros) o todo el archivo. Avisa si falla. */
export function useExportarHistorico() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (pedido: { id: string; filtros: FiltrosHistorico; orden: Orden } | 'todo') =>
      pedido === 'todo'
        ? historicoApi.exportarTodo()
        : historicoApi.exportar(pedido.id, pedido.filtros, pedido.orden),
    onSuccess: () => {
      toast({ title: 'Archivo generado', description: 'Revisa tus descargas.' });
    },
    onError: (error: unknown) => {
      toast({ title: 'No se pudo exportar', description: mensajeDe(error), variant: 'destructive' });
    },
  });
}
