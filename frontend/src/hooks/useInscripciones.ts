import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import {
  inscripcionesApi,
  type EstadoInscripcion,
  type TipoDocumento,
} from '@/api/inscripciones';

function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

export function useInscripciones(filtros: {
  estado?: EstadoInscripcion;
  buscar?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: ['inscripciones', 'lista', filtros],
    queryFn: () => inscripcionesApi.listar(filtros),
    placeholderData: (anterior) => anterior,
  });
}

/**
 * Sin caché: las URLs del comprobante y de los contratos están firmadas por
 * diez minutos, y una ficha reabierta desde la caché las traería caducadas.
 */
export function useFichaInscripcion(id: number | null) {
  return useQuery({
    queryKey: ['inscripciones', 'ficha', id ?? 0],
    queryFn: () => inscripcionesApi.detalle(id as number),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useDocumentosLegales() {
  return useQuery({
    queryKey: ['inscripciones', 'documentos'],
    queryFn: () => inscripcionesApi.documentos(),
  });
}

export function useDocumentoLegal(id: number | null) {
  return useQuery({
    queryKey: ['inscripciones', 'documento', id ?? 0],
    queryFn: () => inscripcionesApi.documento(id as number),
    enabled: id !== null,
    staleTime: Infinity,
  });
}

function useMutacion<TVars, TData>(fn: (vars: TVars) => Promise<TData>, exito: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inscripciones'] });
      // Aprobar crea alumnos y un representante: esas pantallas también cambian.
      await queryClient.invalidateQueries({ queryKey: ['estudiantes'] });
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      if (exito) toast({ title: exito });
    },
    onError: (error: unknown) => {
      toast({
        title: 'No se pudo completar la operación',
        description: mensajeDe(error),
        variant: 'destructive',
      });
    },
  });
}

/** El aviso lo da la pantalla: depende de si el correo salió o no. */
export function useAprobarInscripcion() {
  return useMutacion((id: number) => inscripcionesApi.aprobar(id), null);
}

export function useRechazarInscripcion() {
  return useMutacion(
    ({ id, confirmacion }: { id: number; confirmacion: string }) =>
      inscripcionesApi.rechazar(id, confirmacion),
    'Inscripción rechazada y eliminada',
  );
}

export function usePublicarDocumento() {
  return useMutacion(
    (datos: { tipo: TipoDocumento; titulo: string; contenido: string }) =>
      inscripcionesApi.publicarDocumento(datos),
    'Versión publicada',
  );
}
