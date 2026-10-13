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
  representantes: (buscar: string) => ['novedades', 'representantes', buscar] as const,
  alumnos: (buscar: string) => ['novedades', 'alumnos', buscar] as const,
  aviso: ['novedades', 'aviso-menu'] as const,
};

/**
 * Número de nuevas del menú (2026-10-12), solo Propietario y Admin. Una
 * consulta que solo cuenta, cada minuto, y solo con la pestaña a la vista:
 * react-query no repite en segundo plano. Crear o borrar la refresca (la
 * clave empieza por 'novedades').
 */
export function useAvisoNovedades(habilitado: boolean) {
  return useQuery({
    queryKey: CLAVE.aviso,
    queryFn: () => novedadesApi.aviso(),
    enabled: habilitado,
    refetchInterval: 60_000,
  });
}

/** Marca como vistas hasta `hasta` y deja el número tal cual lo devuelve el servidor. */
export function useMarcarNovedadesVistas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hasta: string) => novedadesApi.marcarVisto(hasta),
    onSuccess: (data) => queryClient.setQueryData(CLAVE.aviso, data),
  });
}

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
      toast({
        title: 'Novedad enviada',
        description: 'Se notificará al personal encargado.',
      });
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
      toast({ title: 'Novedad eliminada', description: 'Sigue en Reportes → Novedades.' });
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

export function useRepresentantesMencionables(buscar: string, habilitado: boolean) {
  return useQuery({
    queryKey: CLAVE.representantes(buscar),
    queryFn: () => novedadesApi.representantes({ buscar: buscar || undefined, limit: 50 }),
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
