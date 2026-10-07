import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { subirFoto } from '@/hooks/useUsuarios';
import { usePermissions } from '@/hooks/usePermissions';
import { useDisciplinas } from '@/hooks/useDisciplinas';
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

export function useColegios(filtros: FiltrosColegios, enabled = true) {
  return useQuery({
    queryKey: CLAVE.lista(filtros),
    queryFn: () => colegiosApi.listar(filtros),
    placeholderData: (anterior) => anterior,
    enabled,
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
 * Candidatos a coordinador: usuarios activos con el rol 2.
 *
 * Cambia solo cuando cambia el catalogo de usuarios, y de eso se encarga
 * `useUsuarios`, que invalida esta clave en cada alta, edicion, baja y
 * reactivacion. Por eso puede cachearse de verdad: antes llevaba un staleTime
 * de 5 minutos como parche, y durante esos 5 minutos un coordinador recien
 * creado no aparecia aqui hasta recargar la pagina.
 */
export function useCandidatosACoordinador(habilitado: boolean) {
  return useQuery({
    queryKey: CLAVE.candidatos,
    queryFn: () => colegiosApi.candidatos(),
    enabled: habilitado,
    staleTime: 30 * 60 * 1000,
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

/**
 * Los colegios que puede elegir esta persona en un filtro o selector.
 *
 * Quien tiene permiso de Colegios los saca de ahí. Quien no (entrenador,
 * asistente, respaldo, representante) los deduce de sus propias disciplinas,
 * que el backend ya filtra por alcance. Sin esto, la lista de Colegios le
 * respondía 403 y el selector salía vacío: un entrenador no podía ni elegir
 * colegio para pasar lista.
 */
export function useColegiosVisibles(): {
  data: { items: Array<{ col_id: number; col_nombre: string }> } | undefined;
  isLoading: boolean;
} {
  const { hasPermission } = usePermissions();
  const veColegios = hasPermission('colegios', 'ver');
  const colegios = useColegios({ limit: 200, orden: 'nombre' }, veColegios);
  const disciplinas = useDisciplinas({ limit: 200, estado: 1, orden: 'horario' }, !veColegios);

  if (veColegios) return { data: colegios.data, isLoading: colegios.isLoading };
  if (!disciplinas.data) return { data: undefined, isLoading: disciplinas.isLoading };
  const unicos = new Map<number, string>();
  for (const d of disciplinas.data.items) unicos.set(d.col_id, d.col_nombre);
  return {
    data: {
      items: [...unicos.entries()]
        .map(([col_id, col_nombre]) => ({ col_id, col_nombre }))
        .sort((a, b) => a.col_nombre.localeCompare(b.col_nombre, 'es')),
    },
    isLoading: false,
  };
}
