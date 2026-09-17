import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { encuestasApi, type PreguntaInput, type RespuestaInput } from '@/api/encuestas';
import { representantesApi } from '@/api/representantes';

function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

// ---------------------------------------------------------------------------
// Encuestas

export function useEncuestas(filtros: { buscar?: string; estado?: number }) {
  return useQuery({
    queryKey: ['encuestas', 'lista', filtros],
    queryFn: () => encuestasApi.listar(filtros),
    placeholderData: (anterior) => anterior,
  });
}

export function useFichaEncuesta(id: number | null) {
  return useQuery({
    queryKey: ['encuestas', 'ficha', id ?? 0],
    queryFn: () => encuestasApi.ficha(id as number),
    enabled: id !== null,
  });
}

export function useTiposRespuesta() {
  return useQuery({
    queryKey: ['encuestas', 'tipos'],
    queryFn: () => encuestasApi.tipos(),
    staleTime: Infinity,
  });
}

export function useResultados(id: number | null) {
  return useQuery({
    queryKey: ['encuestas', 'resultados', id ?? 0],
    queryFn: () => encuestasApi.resultados(id as number),
    enabled: id !== null,
    staleTime: 0,
  });
}

export function useImpactoEncuesta(id: number | null) {
  return useQuery({
    queryKey: ['encuestas', 'impacto', id ?? 0],
    queryFn: () => encuestasApi.impacto(id as number),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

function useMutacion<TVars, TData>(fn: (vars: TVars) => Promise<TData>, exito: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['encuestas'] });
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

export function useCrearEncuesta() {
  return useMutacion(
    (datos: { encu_titulo: string; encu_descripcion?: string; preguntas?: PreguntaInput[] }) =>
      encuestasApi.crear(datos),
    'Encuesta creada en borrador',
  );
}

export function useActualizarEncuesta() {
  return useMutacion(
    ({ id, datos }: { id: number; datos: { encu_titulo?: string; encu_descripcion?: string } }) =>
      encuestasApi.actualizar(id, datos),
    'Encuesta actualizada',
  );
}

export function useGuardarPreguntas() {
  return useMutacion(
    ({ id, preguntas }: { id: number; preguntas: PreguntaInput[] }) =>
      encuestasApi.guardarPreguntas(id, preguntas),
    'Preguntas guardadas',
  );
}

export function useFinalizarEncuesta() {
  return useMutacion(
    (id: number) => encuestasApi.finalizar(id),
    'Encuesta finalizada: ya no se edita',
  );
}

export function useVolverABorrador() {
  return useMutacion((id: number) => encuestasApi.volverABorrador(id), 'De vuelta a borrador');
}

export function usePublicarEncuesta() {
  return useMutacion(
    (id: number) => encuestasApi.publicar(id),
    'Encuesta publicada: ya la ven los representantes',
  );
}

export function useEliminarEncuesta() {
  return useMutacion(
    ({ id, confirmacion }: { id: number; confirmacion: string }) =>
      encuestasApi.eliminar(id, confirmacion),
    'Encuesta eliminada',
  );
}

// ---------------------------------------------------------------------------
// El lado del representante

/**
 * Las encuestas publicadas de quien mira.
 *
 * `reintentos: false` a propósito: si no eres representante el backend contesta
 * 403, y reintentar tres veces un 403 solo llena la consola. Esta consulta la
 * hace **todo el mundo** al entrar —es la que alimenta el aviso— así que su
 * caso normal es fallar.
 */
export function useMisEncuestas(habilitado: boolean) {
  return useQuery({
    queryKey: ['encuestas', 'mias'],
    queryFn: () => encuestasApi.mias(),
    enabled: habilitado,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEncuestaParaResponder(id: number | null) {
  return useQuery({
    queryKey: ['encuestas', 'responder', id ?? 0],
    queryFn: () => encuestasApi.paraResponder(id as number),
    enabled: id !== null,
    retry: false,
  });
}

export function useResponderEncuesta() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, respuestas }: { id: number; respuestas: RespuestaInput[] }) =>
      encuestasApi.responder(id, respuestas),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['encuestas'] });
      toast({ title: 'Gracias por responder' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'No se pudo guardar tu respuesta',
        description: mensajeDe(error),
        variant: 'destructive',
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Representantes

export function useRepresentantes(filtros: { buscar?: string; estado?: number }) {
  return useQuery({
    queryKey: ['representantes', 'lista', filtros],
    queryFn: () => representantesApi.listar(filtros),
    placeholderData: (anterior) => anterior,
  });
}

export function useFichaRepresentante(usuId: number | null) {
  return useQuery({
    queryKey: ['representantes', 'ficha', usuId ?? 0],
    queryFn: () => representantesApi.ficha(usuId as number),
    enabled: usuId !== null,
  });
}

export function useAlumnosDisponibles(usuId: number | null, buscar: string) {
  return useQuery({
    queryKey: ['representantes', 'disponibles', usuId ?? 0, buscar],
    queryFn: () => representantesApi.disponibles(usuId as number, buscar || undefined),
    enabled: usuId !== null,
    staleTime: 0,
  });
}

/**
 * Atar o soltar un representado toca las dos pantallas: la de representantes y
 * la ficha del alumno, donde también se ven sus representantes.
 */
function useMutacionRepresentante<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  exito: string,
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['representantes'] });
      await queryClient.invalidateQueries({ queryKey: ['estudiantes'] });
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

export function useGuardarHijos() {
  return useMutacionRepresentante(
    ({ usuId, ninoIds }: { usuId: number; ninoIds: number[] }) =>
      representantesApi.guardarHijos(usuId, ninoIds),
    'Representados actualizados',
  );
}

export function useActualizarSector() {
  return useMutacionRepresentante(
    ({ usuId, sector }: { usuId: number; sector: string }) =>
      representantesApi.actualizarSector(usuId, sector),
    'Sector actualizado',
  );
}
