import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { subirFoto } from '@/hooks/useUsuarios';
import {
  colegiosApi,
  type DatosColegio,
  type FiltrosColegios,
} from '@/api/colegios';

/**
 * Acceso a Colegios, todo por react-query.
 *
 * La subida de la foto se reusa de Usuarios: la mecanica es la misma —el
 * backend firma una URL de un solo uso y el archivo va directo al bucket
 * privado— y solo cambia la carpeta, que la decide el endpoint.
 */

const CLAVE = {
  lista: (filtros: FiltrosColegios) => ['colegios', 'lista', filtros] as const,
  detalle: (id: number) => ['colegios', 'detalle', id] as const,
  candidatos: ['colegios', 'candidatos'] as const,
  impacto: (id: number) => ['colegios', 'impacto', id] as const,
};

export function useColegios(filtros: FiltrosColegios) {
  return useQuery({
    queryKey: CLAVE.lista(filtros),
    queryFn: () => colegiosApi.listar(filtros),
    placeholderData: (anterior) => anterior,
  });
}

export function useColegio(id: number | null) {
  return useQuery({
    queryKey: CLAVE.detalle(id ?? 0),
    queryFn: () => colegiosApi.obtener(id as number),
    enabled: id !== null,
  });
}

/**
 * Candidatos a coordinador. Es un catalogo corto y estable durante la sesion,
 * pero no inmutable: si se acaba de crear un usuario con rol 2 tiene que
 * aparecer, asi que 5 minutos y no 30.
 */
export function useCandidatosACoordinador(habilitado: boolean) {
  return useQuery({
    queryKey: CLAVE.candidatos,
    queryFn: () => colegiosApi.candidatos(),
    enabled: habilitado,
    staleTime: 5 * 60 * 1000,
  });
}

export function useImpactoColegio(id: number | null) {
  return useQuery({
    queryKey: CLAVE.impacto(id ?? 0),
    queryFn: () => colegiosApi.impacto(id as number),
    enabled: id !== null,
    // Siempre fresco: se pregunta justo antes de destruir datos.
    staleTime: 0,
    gcTime: 0,
  });
}

function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

function useMutacionDeColegio<TVars, TData>(fn: (vars: TVars) => Promise<TData>, exito: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['colegios'] });
      // Cambiar coordinadores cambia el alcance de esas personas: lo que se ve
      // en Usuarios y en el resto de modulos deja de ser valido.
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
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

export function useCrearColegio() {
  return useMutacionDeColegio((datos: DatosColegio) => colegiosApi.crear(datos), 'Colegio creado');
}

export function useActualizarColegio() {
  return useMutacionDeColegio(
    ({ id, datos }: { id: number; datos: DatosColegio }) => colegiosApi.actualizar(id, datos),
    'Colegio actualizado',
  );
}

export function useEliminarColegio() {
  return useMutacionDeColegio(
    ({ id, confirmacion }: { id: number; confirmacion: string }) =>
      colegiosApi.eliminar(id, confirmacion),
    'Colegio eliminado permanentemente',
  );
}

export function useSubirFotoColegio() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (file: File) => subirFoto(file, colegiosApi.urlDeSubida),
    onError: (error: unknown) => {
      toast({
        title: 'No se pudo subir la foto',
        description: mensajeDe(error),
        variant: 'destructive',
      });
    },
  });
}
