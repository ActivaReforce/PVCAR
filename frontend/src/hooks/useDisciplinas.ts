import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import {
  disciplinasApi,
  type DatosDisciplina,
  type DatosLote,
  type FiltrosDisciplinas,
} from '@/api/disciplinas';

const CLAVE = {
  lista: (filtros: FiltrosDisciplinas) => ['disciplinas', 'lista', filtros] as const,
  dias: ['disciplinas', 'dias'] as const,
  previoBaja: (id: number) => ['disciplinas', 'previo-baja', id] as const,
  impacto: (id: number) => ['disciplinas', 'impacto', id] as const,
};

export function useDisciplinas(filtros: FiltrosDisciplinas) {
  return useQuery({
    queryKey: CLAVE.lista(filtros),
    queryFn: () => disciplinasApi.listar(filtros),
    placeholderData: (anterior) => anterior,
  });
}

export function useDias() {
  return useQuery({
    queryKey: CLAVE.dias,
    queryFn: () => disciplinasApi.dias(),
    staleTime: Infinity, // los siete días de la semana no cambian
  });
}

/** Qué se va a cerrar con la baja. Siempre fresco: se pide justo antes. */
export function usePrevioBaja(id: number | null) {
  return useQuery({
    queryKey: CLAVE.previoBaja(id ?? 0),
    queryFn: () => disciplinasApi.previoBaja(id as number),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useImpactoDisciplina(id: number | null) {
  return useQuery({
    queryKey: CLAVE.impacto(id ?? 0),
    queryFn: () => disciplinasApi.impacto(id as number),
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
      await queryClient.invalidateQueries({ queryKey: ['disciplinas'] });
      // Los conteos de disciplinas viven también en la tarjeta del colegio y
      // en la de la actividad.
      await queryClient.invalidateQueries({ queryKey: ['colegios'] });
      await queryClient.invalidateQueries({ queryKey: ['actividades'] });
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

export function useCrearDisciplinas() {
  return useMutacion((datos: DatosLote) => disciplinasApi.crear(datos), 'Disciplinas creadas');
}

export function useActualizarDisciplina() {
  return useMutacion(
    ({ id, datos }: { id: number; datos: DatosDisciplina }) =>
      disciplinasApi.actualizar(id, datos),
    'Disciplina actualizada',
  );
}

export function useDarDeBajaDisciplina() {
  return useMutacion((id: number) => disciplinasApi.darDeBaja(id), 'Disciplina dada de baja');
}

export function useReactivarDisciplina() {
  return useMutacion((id: number) => disciplinasApi.reactivar(id), 'Disciplina reactivada');
}

export function useEliminarDisciplina() {
  return useMutacion(
    ({ id, confirmacion }: { id: number; confirmacion: string }) =>
      disciplinasApi.eliminar(id, confirmacion),
    'Disciplina eliminada',
  );
}
