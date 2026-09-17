import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import {
  asistenciasApi,
  type MarcaAlumno,
  type MarcaPersona,
  type ResultadoGuardado,
} from '@/api/asistencias';

const CLAVE = {
  estados: ['asistencias', 'estados'] as const,
  contexto: ['asistencias', 'contexto'] as const,
  alumnos: (disciplina: number, fecha: string) =>
    ['asistencias', 'alumnos', disciplina, fecha] as const,
  entrenadores: (colegio: number, fecha: string) =>
    ['asistencias', 'entrenadores', colegio, fecha] as const,
  historial: (disciplina: number, desde: string, hasta: string) =>
    ['asistencias', 'historial', disciplina, desde, hasta] as const,
};

function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

/** Catálogo fijo: los cuatro estados no cambian en toda la sesión. */
export function useEstadosAsistencia() {
  return useQuery({
    queryKey: CLAVE.estados,
    queryFn: () => asistenciasApi.estados(),
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * La fecha y la hora del servidor.
 *
 * Se pide al abrir la pantalla en vez de usar `new Date()`: el reloj del
 * teléfono del entrenador decidía qué día se estaba pasando lista.
 */
export function useContextoAsistencias() {
  return useQuery({
    queryKey: CLAVE.contexto,
    queryFn: () => asistenciasApi.contexto(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAsistenciaAlumnos(disciplina: number | null, fecha: string | null) {
  return useQuery({
    queryKey: CLAVE.alumnos(disciplina ?? 0, fecha ?? ''),
    queryFn: () => asistenciasApi.alumnos(disciplina as number, fecha as string),
    enabled: disciplina !== null && fecha !== null,
    /**
     * Sin caché: la sesión que se está pasando puede estar tocándola otra
     * persona a la vez, y volver a una fecha tiene que traer lo que hay.
     */
    staleTime: 0,
  });
}

export function useAsistenciaEntrenadores(colegio: number | null, fecha: string | null) {
  return useQuery({
    queryKey: CLAVE.entrenadores(colegio ?? 0, fecha ?? ''),
    queryFn: () => asistenciasApi.entrenadores(colegio as number, fecha as string),
    enabled: colegio !== null && fecha !== null,
    staleTime: 0,
  });
}

export function useHistorialAsistencias(
  disciplina: number | null,
  desde: string,
  hasta: string,
  habilitado: boolean,
) {
  return useQuery({
    queryKey: CLAVE.historial(disciplina ?? 0, desde, hasta),
    queryFn: () => asistenciasApi.historial(disciplina as number, desde, hasta),
    enabled: habilitado && disciplina !== null,
  });
}

/**
 * El aviso que se enseña al guardar distingue altas de correcciones.
 *
 * No es adorno: corregir una marca ya puesta deja fila en `auditoria` y quien
 * guarda tiene derecho a saber que ha reescrito algo, no solo que "se guardó".
 */
function avisoDe(resultado: ResultadoGuardado): string {
  const partes: string[] = [];
  if (resultado.altas > 0) partes.push(`${resultado.altas} registrada(s)`);
  if (resultado.cambios > 0) partes.push(`${resultado.cambios} corregida(s)`);
  return partes.join(' · ') || 'Sin cambios';
}

export function useGuardarAsistenciaAlumnos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      colacthorId,
      fecha,
      marcas,
    }: {
      colacthorId: number;
      fecha: string;
      marcas: MarcaAlumno[];
    }) => asistenciasApi.guardarAlumnos(colacthorId, fecha, marcas),

    onSuccess: async (data, variables) => {
      /**
       * La respuesta ya trae la lista recién leída: se escribe directa en la
       * caché en vez de invalidar y volver a pedirla. Una ida y vuelta menos
       * en una cancha con mala cobertura.
       */
      queryClient.setQueryData(CLAVE.alumnos(variables.colacthorId, variables.fecha), data);
      await queryClient.invalidateQueries({ queryKey: ['asistencias', 'historial'] });
      toast({ title: 'Asistencia guardada', description: avisoDe(data.resultado) });
    },

    onError: (error: unknown) => {
      toast({
        title: 'No se pudo guardar la asistencia',
        description: mensajeDe(error),
        variant: 'destructive',
      });
    },
  });
}

export function useGuardarAsistenciaEntrenadores() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      colId,
      fecha,
      marcas,
    }: {
      colId: number;
      fecha: string;
      marcas: MarcaPersona[];
    }) => asistenciasApi.guardarEntrenadores(colId, fecha, marcas),

    onSuccess: (data, variables) => {
      queryClient.setQueryData(CLAVE.entrenadores(variables.colId, variables.fecha), data);
      toast({ title: 'Asistencia guardada', description: avisoDe(data.resultado) });
    },

    onError: (error: unknown) => {
      toast({
        title: 'No se pudo guardar la asistencia',
        description: mensajeDe(error),
        variant: 'destructive',
      });
    },
  });
}
