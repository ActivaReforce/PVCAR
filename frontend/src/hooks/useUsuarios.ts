import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import {
  usuariosApi,
  type DatosUsuario,
  type FiltrosUsuarios,
  type SubidaFirmada,
} from '@/api/usuarios';

/**
 * Acceso a usuarios, todo por react-query.
 *
 * El sistema viejo tenia dos modelos de estado conviviendo (38 archivos con
 * react-query y 70 con useEffect + useState a mano) y para comunicarlos se
 * inventaba un evento del DOM: window.dispatchEvent('disciplineAssignmentChanged').
 * Aqui la invalidacion por clave hace ese trabajo, y se ve en el codigo.
 */

const CLAVE = {
  lista: (filtros: FiltrosUsuarios) => ['usuarios', 'lista', filtros] as const,
  detalle: (id: number) => ['usuarios', 'detalle', id] as const,
  roles: ['usuarios', 'roles'] as const,
  impacto: (id: number) => ['usuarios', 'impacto', id] as const,
};

export function useUsuarios(filtros: FiltrosUsuarios) {
  return useQuery({
    queryKey: CLAVE.lista(filtros),
    queryFn: () => usuariosApi.listar(filtros),
    // Mantener la pagina anterior mientras carga la siguiente evita el
    // parpadeo de la tabla al cambiar de pagina o de filtro.
    placeholderData: (anterior) => anterior,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: CLAVE.roles,
    queryFn: () => usuariosApi.roles(),
    staleTime: 30 * 60 * 1000, // catalogo: no cambia durante la sesion
  });
}

export function useUsuario(id: number | null) {
  return useQuery({
    queryKey: CLAVE.detalle(id ?? 0),
    queryFn: () => usuariosApi.obtener(id as number),
    enabled: id !== null,
  });
}

export function useImpactoEliminacion(id: number | null) {
  return useQuery({
    queryKey: CLAVE.impacto(id ?? 0),
    queryFn: () => usuariosApi.impacto(id as number),
    enabled: id !== null,
    // Siempre fresco: se pregunta justo antes de destruir datos.
    staleTime: 0,
    gcTime: 0,
  });
}

/** Mensaje de error legible, venga del API o de donde sea. */
function mensajeDe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}

function useMutacionDeUsuario<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  exito: string,
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      // Una sola clave raiz: cualquier lista, ficha o conteo se recarga.
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

export function useCrearUsuario() {
  return useMutacionDeUsuario(
    (datos: DatosUsuario) => usuariosApi.crear(datos),
    'Usuario creado',
  );
}

export function useActualizarUsuario() {
  return useMutacionDeUsuario(
    ({ id, datos }: { id: number; datos: DatosUsuario }) => usuariosApi.actualizar(id, datos),
    'Usuario actualizado',
  );
}

export function useDarDeBaja() {
  return useMutacionDeUsuario((id: number) => usuariosApi.darDeBaja(id), 'Usuario dado de baja');
}

export function useReactivarUsuario() {
  return useMutacionDeUsuario((id: number) => usuariosApi.reactivar(id), 'Usuario reactivado');
}

export function useEliminarUsuario() {
  return useMutacionDeUsuario(
    ({ id, confirmacion }: { id: number; confirmacion: string }) =>
      usuariosApi.eliminar(id, confirmacion),
    'Usuario eliminado permanentemente',
  );
}

/**
 * Sube una foto y devuelve la ruta que hay que guardar en el usuario.
 *
 * El bucket es privado: el navegador no puede subir con la anon key. El
 * backend firma una URL de un solo uso y el archivo va directo a Storage sin
 * pasar por el API. La compresion previa se mantiene del sistema viejo: el
 * bucket rechaza cualquier cosa por encima de 500 KB.
 */
export async function subirFoto(
  file: File,
  pedirUrl: (mimeType: string) => Promise<SubidaFirmada>,
): Promise<string> {
  let archivo = file;
  try {
    archivo = await compressImage(file, {
      maxSizeMB: 0.4,
      maxWidthOrHeight: 800,
      initialQuality: 0.8,
      useWebWorker: true,
    });
  } catch {
    // Si la compresion falla se sube el original; el bucket dira que no si
    // pasa de 500 KB, y ese mensaje es mas util que fallar aqui en silencio.
  }

  const { path, token } = await pedirUrl(archivo.type || file.type);

  const { error } = await supabase.storage
    .from('usufoto')
    .uploadToSignedUrl(path, token, archivo);

  if (error) {
    throw new Error(`No se pudo subir la foto: ${error.message}`);
  }

  return path;
}

export function useSubirFotoUsuario() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (file: File) => subirFoto(file, usuariosApi.urlDeSubida),
    onError: (error: unknown) => {
      toast({
        title: 'No se pudo subir la foto',
        description: mensajeDe(error),
        variant: 'destructive',
      });
    },
  });
}
