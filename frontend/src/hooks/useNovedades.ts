import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import {
  novedadesApi,
  type CrearNovedadInput,
  type FiltrosListar,
} from '@/api/novedades';

function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

const CLAVE = {
  lista: (filtros: FiltrosListar) => ['novedades', 'lista', filtros] as const,
  personal: (buscar: string) => ['novedades', 'personal', buscar] as const,
  alumnos: (buscar: string) => ['novedades', 'alumnos', buscar] as const,
};

export function useNovedades(filtros: FiltrosListar) {
  return useQuery({
    queryKey: CLAVE.lista(filtros),
    queryFn: () => novedadesApi.listar(filtros),
  });
}

export function useCrearNovedad() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (input: CrearNovedadInput) => novedadesApi.crear(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['novedades'] });
      toast({ title: 'Novedad creada' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'No se pudo crear la novedad',
        description: mensajeDe(error),
        variant: 'destructive',
      });
    },
  });
}

export function useEliminarNovedad() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => novedadesApi.eliminar(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['novedades'] });
      toast({ title: 'Novedad eliminada' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'No se pudo eliminar',
        description: mensajeDe(error),
        variant: 'destructive',
      });
    },
  });
}

export function usePersonalMencionable(buscar: string, habilitado: boolean) {
  return useQuery({
    queryKey: CLAVE.personal(buscar),
    queryFn: () => novedadesApi.personal({ buscar: buscar || undefined, limit: 50 }),
    enabled: habilitado,
  });
}

export function useAlumnosMencionables(buscar: string, habilitado: boolean) {
  return useQuery({
    queryKey: CLAVE.alumnos(buscar),
    queryFn: () => novedadesApi.alumnos({ buscar: buscar || undefined, limit: 50 }),
    enabled: habilitado,
  });
}
