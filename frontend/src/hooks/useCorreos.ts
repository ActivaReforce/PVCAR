import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { correosApi, type ConfigCorreoInput, type TipoCorreo } from '@/api/correos';

function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

export function useConfigCorreo(tipo: TipoCorreo, activo: boolean) {
  return useQuery({
    queryKey: ['correos', tipo],
    queryFn: () => correosApi.obtener(tipo),
    enabled: activo,
  });
}

export function useGuardarConfigCorreo(tipo: TipoCorreo) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (datos: ConfigCorreoInput) => correosApi.guardar(tipo, datos),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['correos', tipo] });
      toast({ title: 'Correo guardado' });
    },
    onError: (error: unknown) => {
      toast({ title: 'No se pudo guardar', description: mensajeDe(error), variant: 'destructive' });
    },
  });
}
