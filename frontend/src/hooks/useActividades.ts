import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import {
  actividadesApi,
  type DatosActividad,
  type FiltrosActividades,
} from '@/api/actividades';

const CLAVE = {
  lista: (filtros: FiltrosActividades) => ['actividades', 'lista', filtros] as const,
  categorias: ['actividades', 'categorias'] as const,
  impacto: (id: number) => ['actividades', 'impacto', id] as const,
};

export function useActividades(filtros: FiltrosActividades) {
  return useQuery({
    queryKey: CLAVE.lista(filtros),
    queryFn: () => actividadesApi.listar(filtros),
    placeholderData: (anterior) => anterior,
  });
}

/** Las seis categorías son catálogo: cambian muy de vez en cuando. */
export function useCategorias() {
  return useQuery({
    queryKey: CLAVE.categorias,
    queryFn: () => actividadesApi.categorias(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useImpactoActividad(id: number | null) {
  return useQuery({
    queryKey: CLAVE.impacto(id ?? 0),
    queryFn: () => actividadesApi.impacto(id as number),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

function useMutacion<TVars, TData>(fn: (vars: TVars) => Promise<TData>, exito: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['actividades'] });
      // El nombre de la actividad se ve en cada disciplina: si cambia, la
      // otra pantalla estaría mostrando el viejo.
      await queryClient.invalidateQueries({ queryKey: ['disciplinas'] });
      toast({ title: exito });
    },
    onError: (error: unknown) => {
      toast({
        title: 'No se pudo completar la operacion',
        description: mensajeDe(error),
        variant: 'destructive',
      });
    },
  });
}

export function useCrearActividad() {
  return useMutacion((datos: DatosActividad) => actividadesApi.crear(datos), 'Actividad creada');
}

export function useActualizarActividad() {
  return useMutacion(
    ({ id, datos }: { id: number; datos: DatosActividad }) => actividadesApi.actualizar(id, datos),
    'Actividad actualizada',
  );
}

export function useEliminarActividad() {
  return useMutacion(
    ({ id, confirmacion }: { id: number; confirmacion: string }) =>
      actividadesApi.eliminar(id, confirmacion),
    'Actividad eliminada',
  );
}
