import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAvisoAuxiliares } from '@/contexts/AvisoAuxiliaresContext';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import {
  disciplinasApi,
  type DatosDisciplina,
  type DatosNuevaDisciplina,
  type FiltrosDisciplinas,
} from '@/api/disciplinas';

const CLAVE = {
  lista: (filtros: FiltrosDisciplinas) => ['disciplinas', 'lista', filtros] as const,
  dias: ['disciplinas', 'dias'] as const,
  grados: ['disciplinas', 'grados'] as const,
  previoBaja: (id: number) => ['disciplinas', 'previo-baja', id] as const,
  impacto: (id: number) => ['disciplinas', 'impacto', id] as const,
};

export function useDisciplinas(filtros: FiltrosDisciplinas, enabled = true) {
  return useQuery({
    queryKey: CLAVE.lista(filtros),
    queryFn: () => disciplinasApi.listar(filtros),
    placeholderData: (anterior) => anterior,
    enabled,
  });
}

export function useDias() {
  return useQuery({
    queryKey: CLAVE.dias,
    queryFn: () => disciplinasApi.dias(),
    staleTime: Infinity, // los siete días de la semana no cambian
  });
}

/** El catálogo de cursos, para marcar a quién va cada disciplina. */
export function useGradosDisciplina() {
  return useQuery({
    queryKey: CLAVE.grados,
    queryFn: () => disciplinasApi.grados(),
    staleTime: Infinity,
  });
}

/** Qué se va a cerrar con la baja. Siempre fresco: se pide justo antes. */
export function usePrevioBaja(id: number | null) {
  return useQuery({
    queryKey: CLAVE.previoBaja(id ?? 0),
    queryFn: () => disciplinasApi.previoBaja(id as number),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useImpactoDisciplina(id: number | null) {
  return useQuery({
    queryKey: CLAVE.impacto(id ?? 0),
    queryFn: () => disciplinasApi.impacto(id as number),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

interface Exito {
  title: string;
  description?: string;
}

function useMutacion<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  exito: string | ((data: TData) => Exito),
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: fn,
    onSuccess: async (data: TData) => {
      await queryClient.invalidateQueries({ queryKey: ['disciplinas'] });
      // Los conteos de disciplinas viven también en la tarjeta del colegio y
      // en la de la actividad.
      await queryClient.invalidateQueries({ queryKey: ['colegios'] });
      await queryClient.invalidateQueries({ queryKey: ['actividades'] });
      // Un solo toast a la vez (TOAST_LIMIT = 1): el aviso va en el de éxito.
      toast(typeof exito === 'string' ? { title: exito } : exito(data));
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

export function useCrearDisciplina() {
  return useMutacion((datos: DatosNuevaDisciplina) => disciplinasApi.crear(datos), 'Disciplina creada');
}

export function useActualizarDisciplina() {
  return useMutacion(
    ({ id, datos }: { id: number; datos: DatosDisciplina }) =>
      disciplinasApi.actualizar(id, datos),
    (d) =>
      d.entrenadores_cruzados?.length
        ? {
            title: 'Disciplina actualizada, con cruce de horario',
            description: `Con este horario la dará a la vez que otra suya: ${d.entrenadores_cruzados.join('; ')}. Se guardó igual.`,
          }
        : { title: 'Disciplina actualizada' },
  );
}

export function useDarDeBajaDisciplina() {
  const avisar = useAvisoAuxiliares();
  return useMutacion(async (id: number) => {
    const r = await disciplinasApi.darDeBaja(id);
    avisar(r.auxiliares_desvinculados);
    return r;
  }, 'Disciplina dada de baja');
}

export function useReactivarDisciplina() {
  return useMutacion((id: number) => disciplinasApi.reactivar(id), 'Disciplina reactivada');
}

export function useEliminarDisciplina() {
  return useMutacion(
    ({ id, confirmacion }: { id: number; confirmacion: string }) =>
      disciplinasApi.eliminar(id, confirmacion),
    'Disciplina eliminada',
  );
}
