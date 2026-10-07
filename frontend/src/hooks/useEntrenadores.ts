import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { entrenadoresApi, type FiltrosEntrenadores } from '@/api/entrenadores';

const CLAVE = {
  lista: (filtros: FiltrosEntrenadores) => ['entrenadores', 'lista', filtros] as const,
  ficha: (id: number, historial: boolean) => ['entrenadores', 'ficha', id, historial] as const,
  disponibles: (id: number) => ['entrenadores', 'disponibles', id] as const,
  candidatos: ['entrenadores', 'candidatos-auxiliar'] as const,
};

export function useEntrenadores(filtros: FiltrosEntrenadores) {
  return useQuery({
    queryKey: CLAVE.lista(filtros),
    queryFn: () => entrenadoresApi.listar(filtros),
    placeholderData: (anterior) => anterior,
  });
}

export function useFichaEntrenador(id: number | null, historial: boolean) {
  return useQuery({
    queryKey: CLAVE.ficha(id ?? 0, historial),
    queryFn: () => entrenadoresApi.ficha(id as number, historial),
    enabled: id !== null,
  });
}

export function useDisciplinasDisponibles(id: number | null) {
  return useQuery({
    queryKey: CLAVE.disponibles(id ?? 0),
    queryFn: () => entrenadoresApi.disponibles(id as number),
    enabled: id !== null,
    // Quién tiene cada disciplina cambia con cada asignación: nunca en caché.
    staleTime: 0,
  });
}

export function useCandidatosAuxiliar(habilitado: boolean) {
  return useQuery({
    queryKey: CLAVE.candidatos,
    queryFn: () => entrenadoresApi.candidatosAuxiliar(),
    enabled: habilitado,
    staleTime: 60 * 1000,
  });
}

function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

/**
 * Cambiar una asignación cambia el **alcance** del entrenador y el de sus
 * auxiliares: lo que ven en Disciplinas, Estudiantes y Asistencias deja de ser
 * válido. Por eso se invalida todo, no solo la lista de entrenadores.
 */
function useMutacion<TVars, TData>(fn: (vars: TVars) => Promise<TData>, exito: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['entrenadores'] });
      await queryClient.invalidateQueries({ queryKey: ['disciplinas'] });
      await queryClient.invalidateQueries({ queryKey: ['colegios'] });
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

export function useAsignarDisciplina() {
  return useMutacion(
    ({ id, colacthorId, reemplazar }: { id: number; colacthorId: number; reemplazar?: boolean }) =>
      entrenadoresApi.asignar(id, colacthorId, reemplazar ?? false),
    'Disciplina asignada',
  );
}

export function useCerrarAsignacion() {
  return useMutacion(
    ({ id, entasigId }: { id: number; entasigId: number }) =>
      entrenadoresApi.cerrar(id, entasigId),
    'Asignación cerrada',
  );
}

export function useAtarAuxiliar() {
  return useMutacion(
    ({ id, usuId }: { id: number; usuId: number }) => entrenadoresApi.atarAuxiliar(id, usuId),
    'Auxiliar atado',
  );
}

export function useSoltarAuxiliar() {
  return useMutacion(
    ({ id, entauxId }: { id: number; entauxId: number }) =>
      entrenadoresApi.soltarAuxiliar(id, entauxId),
    'Auxiliar soltado',
  );
}
