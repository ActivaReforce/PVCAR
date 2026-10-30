import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { mensualidadesApi } from '@/api/mensualidades';

function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

/** `usuId` en la clave: otra sesión en el mismo navegador no ve lo del anterior. */
export function useMisMensualidades(usuId: number | undefined) {
  return useQuery({
    queryKey: ['mensualidades', 'mias', usuId ?? 0],
    queryFn: () => mensualidadesApi.mias(),
    enabled: usuId !== undefined,
  });
}

export function usePagosMensualidad(f: { estado?: 'pendiente' | 'aprobado'; colegio?: number; buscar?: string; page?: number }) {
  return useQuery({
    queryKey: ['mensualidades', 'pagos', f],
    queryFn: () => mensualidadesApi.listar(f),
    placeholderData: (anterior) => anterior,
  });
}

/** Sin caché: la URL del comprobante está firmada por diez minutos. */
export function usePagoMensualidad(id: number | null) {
  return useQuery({
    queryKey: ['mensualidades', 'pago', id ?? 0],
    queryFn: () => mensualidadesApi.ver(id as number),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useEstadoDelMes(mes: string | undefined, colegio: number | undefined) {
  return useQuery({
    queryKey: ['mensualidades', 'mes', mes ?? '', colegio ?? 0],
    queryFn: () => mensualidadesApi.mes(mes, colegio),
    placeholderData: (anterior) => anterior,
  });
}

export function useConfigMensualidades() {
  return useQuery({ queryKey: ['mensualidades', 'config'], queryFn: () => mensualidadesApi.config() });
}

function useMutacion<TVars, TData>(fn: (vars: TVars) => Promise<TData>, exito: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mensualidades'] });
      if (exito) toast({ title: exito });
    },
    onError: (error: unknown) => {
      toast({ title: 'No se pudo completar la operación', description: mensajeDe(error), variant: 'destructive' });
    },
  });
}

export function useAprobarPago() {
  return useMutacion((id: number) => mensualidadesApi.aprobar(id), 'Pago aprobado');
}

export function useRechazarPago() {
  return useMutacion(
    ({ id, motivo }: { id: number; motivo: string }) => mensualidadesApi.rechazar(id, motivo),
    'Pago rechazado',
  );
}

export function useDescartarPago() {
  return useMutacion((id: number) => mensualidadesApi.descartar(id), null);
}

export function useGuardarConfigMensualidades() {
  return useMutacion(
    (c: { dia_limite: number; dia_corte: number }) => mensualidadesApi.guardarConfig(c),
    'Configuración guardada',
  );
}

export function useGuardarCobroColegio() {
  return useMutacion(
    ({ colId, meses, desde }: { colId: number; meses: number[]; desde: string | null }) =>
      mensualidadesApi.guardarCobroColegio(colId, { meses, desde }),
    'Meses de cobro guardados',
  );
}
