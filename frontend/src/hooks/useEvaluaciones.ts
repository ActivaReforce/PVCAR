import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import {
  evaluacionesApi,
  type DatosEvaluacion,
  type FiltrosEvaluaciones,
  type IntentoInput,
  type ParametroInput,
} from '@/api/evaluaciones';

const CLAVE = {
  lista: (filtros: FiltrosEvaluaciones) => ['evaluaciones', 'lista', filtros] as const,
  ficha: (id: number) => ['evaluaciones', 'ficha', id] as const,
  metodos: ['evaluaciones', 'metodos'] as const,
  categorias: ['evaluaciones', 'categorias'] as const,
  impacto: (id: number) => ['evaluaciones', 'impacto', id] as const,
  disciplinas: (id: number) => ['evaluaciones', 'disciplinas', id] as const,
  pendientes: (evaluacion: number, disciplina: number, estado?: number, buscar?: string) =>
    ['evaluaciones', 'pendientes', evaluacion, disciplina, estado, buscar] as const,
  alumno: (id: number) => ['evaluaciones', 'alumno', id] as const,
};

function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

export function useEvaluaciones(filtros: FiltrosEvaluaciones) {
  return useQuery({
    queryKey: CLAVE.lista(filtros),
    queryFn: () => evaluacionesApi.listar(filtros),
    placeholderData: (anterior) => anterior,
  });
}

export function useFichaEvaluacion(id: number | null) {
  return useQuery({
    queryKey: CLAVE.ficha(id ?? 0),
    queryFn: () => evaluacionesApi.ficha(id as number),
    enabled: id !== null,
  });
}

/** Los cinco métodos no cambian en toda la sesión. */
export function useMetodosEvaluacion() {
  return useQuery({
    queryKey: CLAVE.metodos,
    queryFn: () => evaluacionesApi.metodos(),
    staleTime: Infinity,
  });
}

/** `eva_categoria` es texto libre: el selector se alimenta de lo que ya existe. */
export function useCategoriasEvaluacion() {
  return useQuery({
    queryKey: CLAVE.categorias,
    queryFn: () => evaluacionesApi.categorias(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useImpactoEvaluacion(id: number | null) {
  return useQuery({
    queryKey: CLAVE.impacto(id ?? 0),
    queryFn: () => evaluacionesApi.impacto(id as number),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useDisciplinasDeEvaluacion(id: number | null) {
  return useQuery({
    queryKey: CLAVE.disciplinas(id ?? 0),
    queryFn: () => evaluacionesApi.disciplinas(id as number),
    enabled: id !== null,
    staleTime: 0,
  });
}

export function usePendientes(
  evaluacion: number | null,
  disciplina: number | null,
  estado?: number,
  buscar?: string,
) {
  return useQuery({
    queryKey: CLAVE.pendientes(evaluacion ?? 0, disciplina ?? 0, estado, buscar),
    queryFn: () =>
      evaluacionesApi.pendientes(evaluacion as number, disciplina as number, estado, buscar),
    enabled: evaluacion !== null && disciplina !== null,
    staleTime: 0,
  });
}

export function useFichaDeAlumno(evaninopenId: number | null) {
  return useQuery({
    queryKey: CLAVE.alumno(evaninopenId ?? 0),
    queryFn: () => evaluacionesApi.fichaDeAlumno(evaninopenId as number),
    enabled: evaninopenId !== null,
    staleTime: 0,
  });
}

/**
 * Vincular o desvincular una disciplina mueve las pendientes de sus alumnos, y
 * evaluar mueve los contadores de la lista: las dos cosas invalidan el módulo
 * entero. Estudiantes también, porque la ficha del alumno enseña sus
 * evaluaciones.
 */
function useMutacion<TVars, TData>(fn: (vars: TVars) => Promise<TData>, exito: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['evaluaciones'] });
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

export function useCrearEvaluacion() {
  return useMutacion((datos: DatosEvaluacion) => evaluacionesApi.crear(datos), 'Evaluación creada');
}

export function useActualizarEvaluacion() {
  return useMutacion(
    ({ id, datos }: { id: number; datos: DatosEvaluacion }) =>
      evaluacionesApi.actualizar(id, datos),
    'Evaluación actualizada',
  );
}

export function useGuardarParametros() {
  return useMutacion(
    ({ id, parametros }: { id: number; parametros: ParametroInput[] }) =>
      evaluacionesApi.guardarParametros(id, parametros),
    'Parámetros guardados',
  );
}

export function useDarDeBajaEvaluacion() {
  return useMutacion((id: number) => evaluacionesApi.darDeBaja(id), 'Evaluación dada de baja');
}

export function useReactivarEvaluacion() {
  return useMutacion((id: number) => evaluacionesApi.reactivar(id), 'Evaluación reactivada');
}

export function useEliminarEvaluacion() {
  return useMutacion(
    ({ id, confirmacion }: { id: number; confirmacion: string }) =>
      evaluacionesApi.eliminar(id, confirmacion),
    'Evaluación eliminada permanentemente',
  );
}

/**
 * Vincular disciplinas devuelve el detalle de lo que pasó, y se enseña: crear
 * 40 pendientes de golpe es una consecuencia que merece decirse, y conservar
 * notas al desvincular es justo lo que antes no ocurría.
 */
export function useGuardarDisciplinasDeEvaluacion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, colacthorIds }: { id: number; colacthorIds: number[] }) =>
      evaluacionesApi.guardarDisciplinas(id, colacthorIds),

    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['evaluaciones'] });
      const r = data.resultado;

      const partes: string[] = [];
      if (r.vinculadas > 0) partes.push(`${r.vinculadas} vinculada(s)`);
      if (r.pendientesCreadas > 0) partes.push(`${r.pendientesCreadas} alumno(s) por evaluar`);
      if (r.desvinculadas > 0) partes.push(`${r.desvinculadas} desvinculada(s)`);
      if (r.notasConservadas > 0) partes.push(`${r.notasConservadas} nota(s) conservada(s)`);

      toast({
        title: 'Disciplinas actualizadas',
        description: partes.join(' · ') || 'Sin cambios',
      });
    },

    onError: (error: unknown) => {
      toast({
        title: 'No se pudieron guardar las disciplinas',
        description: mensajeDe(error),
        variant: 'destructive',
      });
    },
  });
}

export function useGuardarIntentos() {
  return useMutacion(
    ({ evaninopenId, intentos }: { evaninopenId: number; intentos: IntentoInput[] }) =>
      evaluacionesApi.guardarIntentos(evaninopenId, intentos),
    'Evaluación guardada',
  );
}

export function useBorrarEvaluacionDeAlumno() {
  return useMutacion(
    (evaninopenId: number) => evaluacionesApi.borrarEvaluacionDeAlumno(evaninopenId),
    'El alumno vuelve a pendiente',
  );
}
