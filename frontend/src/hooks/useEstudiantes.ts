import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { subirFoto } from '@/hooks/useUsuarios';
import {
  estudiantesApi,
  type DatosEstudiante,
  type FiltrosEstudiantes,
} from '@/api/estudiantes';

const CLAVE = {
  lista: (filtros: FiltrosEstudiantes) => ['estudiantes', 'lista', filtros] as const,
  ficha: (id: number, historial: boolean) => ['estudiantes', 'ficha', id, historial] as const,
  disponibles: (id: number) => ['estudiantes', 'disponibles', id] as const,
  grados: ['estudiantes', 'grados'] as const,
  candidatos: ['estudiantes', 'candidatos-representante'] as const,
  impacto: (id: number) => ['estudiantes', 'impacto', id] as const,
};

export function useEstudiantes(filtros: FiltrosEstudiantes) {
  return useQuery({
    queryKey: CLAVE.lista(filtros),
    queryFn: () => estudiantesApi.listar(filtros),
    placeholderData: (anterior) => anterior,
  });
}

export function useFichaEstudiante(id: number | null, historial: boolean) {
  return useQuery({
    queryKey: CLAVE.ficha(id ?? 0, historial),
    queryFn: () => estudiantesApi.ficha(id as number, historial),
    enabled: id !== null,
  });
}

export function useDisponiblesEstudiante(id: number | null) {
  return useQuery({
    queryKey: CLAVE.disponibles(id ?? 0),
    queryFn: () => estudiantesApi.disponibles(id as number),
    enabled: id !== null,
    staleTime: 0,
  });
}

export function useGrados() {
  return useQuery({
    queryKey: CLAVE.grados,
    queryFn: () => estudiantesApi.grados(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useCandidatosRepresentante(habilitado: boolean) {
  return useQuery({
    queryKey: CLAVE.candidatos,
    queryFn: () => estudiantesApi.candidatosRepresentante(),
    enabled: habilitado,
    staleTime: 60 * 1000,
  });
}

export function useImpactoEstudiante(id: number | null) {
  return useQuery({
    queryKey: CLAVE.impacto(id ?? 0),
    queryFn: () => estudiantesApi.impacto(id as number),
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

/**
 * Inscribir o dar de baja cambia los conteos de alumnos de la disciplina, del
 * colegio y del entrenador: las tres pantallas se invalidan con esta.
 */
function useMutacion<TVars, TData>(fn: (vars: TVars) => Promise<TData>, exito: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['estudiantes'] });
      await queryClient.invalidateQueries({ queryKey: ['disciplinas'] });
      await queryClient.invalidateQueries({ queryKey: ['colegios'] });
      await queryClient.invalidateQueries({ queryKey: ['entrenadores'] });
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

export function useCrearEstudiante() {
  return useMutacion(
    (datos: DatosEstudiante) => estudiantesApi.crear(datos),
    'Estudiante creado',
  );
}

export function useActualizarEstudiante() {
  return useMutacion(
    ({ id, datos }: { id: number; datos: DatosEstudiante }) =>
      estudiantesApi.actualizar(id, datos),
    'Estudiante actualizado',
  );
}

export function useGuardarInscripciones() {
  return useMutacion(
    ({ id, colacthorIds }: { id: number; colacthorIds: number[] }) =>
      estudiantesApi.inscripciones(id, colacthorIds),
    'Inscripciones actualizadas',
  );
}

export function useDarDeBajaEstudiante() {
  return useMutacion(
    (id: number) => estudiantesApi.darDeBaja(id),
    'Estudiante dado de baja',
  );
}

export function useReactivarEstudiante() {
  return useMutacion((id: number) => estudiantesApi.reactivar(id), 'Estudiante reactivado');
}

export function useEliminarEstudiante() {
  return useMutacion(
    ({ id, confirmacion }: { id: number; confirmacion: string }) =>
      estudiantesApi.eliminar(id, confirmacion),
    'Estudiante eliminado permanentemente',
  );
}

export function useAtarRepresentante() {
  return useMutacion(
    ({ id, usuId }: { id: number; usuId: number }) => estudiantesApi.atarRepresentante(id, usuId),
    'Representante atado',
  );
}

export function useSoltarRepresentante() {
  return useMutacion(
    ({ id, ninopadreId }: { id: number; ninopadreId: number }) =>
      estudiantesApi.soltarRepresentante(id, ninopadreId),
    'Representante soltado',
  );
}

export function useSubirFotoEstudiante() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (file: File) => subirFoto(file, estudiantesApi.urlDeSubida),
    onError: (error: unknown) => {
      toast({
        title: 'No se pudo subir la foto',
        description: mensajeDe(error),
        variant: 'destructive',
      });
    },
  });
}
