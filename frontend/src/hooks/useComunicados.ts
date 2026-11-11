import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { comunicadosApi, type Destino, type FiltroRepresentantes } from '@/api/comunicados';

export function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

const K = 'comunicados';

export function useOpcionesComunicados() {
  return useQuery({ queryKey: [K, 'opciones'], queryFn: comunicadosApi.opciones, staleTime: 5 * 60_000 });
}

export function useContactos(buscar: string, segmento: number | null) {
  return useQuery({
    queryKey: [K, 'contactos', buscar, segmento],
    queryFn: () => comunicadosApi.contactos({ buscar: buscar || undefined, segmento }),
    placeholderData: (prev) => prev,
  });
}

export function useSegmentos() {
  return useQuery({ queryKey: [K, 'segmentos'], queryFn: comunicadosApi.segmentos });
}

export function useRepresentantesCom(f: FiltroRepresentantes & { buscar: string }) {
  return useQuery({
    queryKey: [K, 'representantes', f],
    queryFn: () =>
      comunicadosApi.representantes({
        colegio: f.colegio,
        curso: f.curso,
        disciplina: f.disciplina,
        buscar: f.buscar || undefined,
      }),
    placeholderData: (prev) => prev,
  });
}

export function usePlantillas() {
  return useQuery({ queryKey: [K, 'plantillas'], queryFn: comunicadosApi.plantillas });
}

export function useComunicadosLista() {
  return useQuery({
    queryKey: [K, 'lista'],
    queryFn: comunicadosApi.listar,
    // Mientras uno se envía, se mira cada 15 s hasta que termine.
    refetchInterval: (q) => (q.state.data?.some((c) => c.estado === 'enviando') ? 15_000 : false),
  });
}

export function useComunicado(id: number | null) {
  return useQuery({
    queryKey: [K, 'uno', id],
    queryFn: () => comunicadosApi.obtener(id!),
    enabled: id !== null,
  });
}

export function useContarDestinos(destinos: Destino[]) {
  return useQuery({
    queryKey: [K, 'contar', destinos],
    queryFn: () => comunicadosApi.contar(destinos),
    enabled: destinos.length > 0,
    placeholderData: (prev) => prev,
  });
}

/**
 * Mutación con aviso de error y refresco de todo Comunicados al acabar.
 * El aviso de éxito lo pone quien la usa (cada acción dice lo suyo).
 */
export function useAccionComunicados<A, R>(fn: (a: A) => Promise<R>, exito?: (r: R) => string | null) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: [K] });
      const t = exito?.(r);
      if (t) toast({ title: t });
    },
    onError: (error: unknown) => {
      // El 409 "ya es representante" lo maneja la pantalla con su propia confirmación.
      if (error instanceof ApiError && (error.details as { codigo?: string } | undefined)?.codigo === 'ES_REPRESENTANTE') return;
      toast({ title: 'No se pudo', description: mensajeDe(error), variant: 'destructive' });
    },
  });
}
