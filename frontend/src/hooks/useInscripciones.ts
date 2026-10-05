import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import {
  inscripcionesApi,
  type DatosPrecio,
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

export function useGuardarBorrador() {
  return useMutacion(
    (datos: { tipo: TipoDocumento; titulo: string; contenido: string }) =>
      inscripcionesApi.guardarBorrador(datos),
    'Borrador guardado',
  );
}

export function usePublicarDocumento() {
  return useMutacion((id: number) => inscripcionesApi.publicarDocumento(id), 'Versión publicada');
}

export function useBorrarBorrador() {
  return useMutacion((id: number) => inscripcionesApi.borrarBorrador(id), 'Borrador descartado');
}

export function usePrecios() {
  return useQuery({
    queryKey: ['inscripciones', 'precios'],
    queryFn: () => inscripcionesApi.precios(),
  });
}

export function useGuardarPrecio() {
  return useMutacion(
    ({ colId, datos }: { colId: number; datos: DatosPrecio }) =>
      inscripcionesApi.guardarPrecio(colId, datos),
    'Precio guardado',
  );
}

export function useBorrarPrecio() {
  return useMutacion(
    (colId: number) => inscripcionesApi.borrarPrecio(colId),
    'Precio quitado: el colegio ya no aparece en el formulario',
  );
}

export function useEstadoInscripciones() {
  return useQuery({
    queryKey: ['inscripciones', 'estado'],
    queryFn: () => inscripcionesApi.estado(),
  });
}

export function useAbrirInscripciones() {
  return useMutacion((abiertas: boolean) => inscripcionesApi.abrir(abiertas), null);
}

export function useAbrirColegio() {
  return useMutacion(
    ({ colId, abiertas }: { colId: number; abiertas: boolean }) =>
      inscripcionesApi.abrirColegio(colId, abiertas),
    null,
  );
}

export function useConfigInscripciones() {
  return useQuery({
    queryKey: ['inscripciones', 'config'],
    queryFn: () => inscripcionesApi.config(),
  });
}

export function useSubirMembrete() {
  return useMutacion(
    (datos: { mime: string; base64: string }) => inscripcionesApi.subirMembrete(datos),
    'Membrete cambiado: sale en los PDF que se generen desde ahora',
  );
}

export function useRestaurarMembrete() {
  return useMutacion((_: void) => inscripcionesApi.restaurarMembrete(), 'Se volvió al membrete de serie');
}
