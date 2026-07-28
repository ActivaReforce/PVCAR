import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Static reference data hooks with long cache times
// These rarely change and can be cached aggressively

interface Dia {
  dia_id: number;
  dia_nombre: string;
}

interface AsistenciaEstado {
  asisest_id: number;
  asisest_nombre: string;
}

interface Rol {
  rol_id: number;
  rol_nombre: string;
  rol_titulo: string;
  rol_descripcion: string | null;
}

interface Categoria {
  cat_id: number;
  cat_nombre: string;
  cat_descripcion: string | null;
}

interface CategoriaNinoGrado {
  catninograd_id: number;
  catninograd_nombre: string;
}

// Days of the week - virtually never changes (24 hour cache)
export const useDias = () => {
  return useQuery<Dia[]>({
    queryKey: ['static-dias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dia')
        .select('*')
        .order('dia_id');
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 48 * 60 * 60 * 1000, // 48 hours
  });
};

// Attendance states - virtually never changes (24 hour cache)
export const useAsistenciaEstados = () => {
  return useQuery<AsistenciaEstado[]>({
    queryKey: ['static-asistencia-estados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asistencia_estado')
        .select('*')
        .order('asisest_id');
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 48 * 60 * 60 * 1000, // 48 hours
  });
};

// Roles - virtually never changes (24 hour cache)
export const useRoles = () => {
  return useQuery<Rol[]>({
    queryKey: ['static-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rol')
        .select('*')
        .order('rol_id');
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 48 * 60 * 60 * 1000, // 48 hours
  });
};

// Activity categories - changes infrequently (1 hour cache)
export const useCategorias = () => {
  return useQuery<Categoria[]>({
    queryKey: ['static-categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categoria')
        .select('*')
        .order('cat_nombre');
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  });
};

// Student grade categories - changes infrequently (1 hour cache)
export const useCategoriasNinoGrado = () => {
  return useQuery<CategoriaNinoGrado[]>({
    queryKey: ['static-categorias-nino-grado'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categoria_nino_grado')
        .select('*')
        .order('catninograd_id');
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  });
};

// Convenience hook to prefetch all static data on app load
export const usePrefetchStaticData = () => {
  useDias();
  useAsistenciaEstados();
  useRoles();
  useCategorias();
  useCategoriasNinoGrado();
};
