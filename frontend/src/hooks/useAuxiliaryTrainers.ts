
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AuxiliaryTrainerWithDetails, AvailableAuxiliary } from "@/components/entrenadores/AuxiliaryTrainerTypes";

export const useAuxiliaryTrainers = (entrenadorId?: number) => {
  const [assignedAuxiliaries, setAssignedAuxiliaries] = useState<AuxiliaryTrainerWithDetails[]>([]);
  const [availableAuxiliaries, setAvailableAuxiliaries] = useState<AvailableAuxiliary[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Load assigned auxiliaries for a specific trainer
  const loadAssignedAuxiliaries = async (entId: number) => {
    try {
      setLoading(true);

      // Cast to any to avoid TS generic depth errors and table union constraints
      const query = (supabase.from('entrenador_auxiliar') as any)
        .select(`
          *,
          usuario!entrenador_auxiliar_usu_id_fkey (
            usu_id,
            usu_nombre,
            usu_correo,
            usu_telefono,
            usu_foto
          ),
          rol!entrenador_auxiliar_rol_id_fkey (
            rol_id,
            rol_nombre,
            rol_titulo
          )
        `)
        .eq('ent_id', entId)
        .eq('est_id', 1)
        .order('entaux_id', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      const validAuxiliaries = (data || []).filter(
        (item: any): item is AuxiliaryTrainerWithDetails => 
          item?.usuario && item?.rol
      );

      setAssignedAuxiliaries(validAuxiliaries);
    } catch (error) {
      console.error("Error loading assigned auxiliaries:", error);
      toast({
        title: "Error",
        description: "Error al cargar los auxiliares asignados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Load available auxiliaries (roles 6 and 7)
  const loadAvailableAuxiliaries = async () => {
    try {
      setLoading(true);
  
      // 1) Traer candidatos (usuario_rol: roles 6 y 7, usuario.est_id = 1)
      const candidatesQ = (supabase.from('usuario_rol') as any)
        .select(`
          usuario!usuario_rol_usu_id_fkey (
            usu_id,
            usu_nombre,
            usu_correo,
            usu_telefono,
            usu_foto,
            est_id
          ),
          rol!usuario_rol_rol_id_fkey (
            rol_id,
            rol_nombre,
            rol_titulo
          )
        `)
        .in('rol_id', [6, 7])
        .eq('usuario.est_id', 1);
  
      // 2) Traer TODOS los auxiliares YA ASIGNADOS ACTIVOS en cualquier entrenador
      //    (entrenador_auxiliar: est_id = 1)
      const activeAssignedQ = (supabase.from('entrenador_auxiliar') as any)
        .select('usu_id')
        .eq('est_id', 1);
  
      const [{ data: candidates, error: candidatesErr }, { data: activeAssigned, error: activeErr }] =
        await Promise.all([candidatesQ, activeAssignedQ]);
  
      if (candidatesErr) throw candidatesErr;
      if (activeErr) throw activeErr;
  
      const activeIds = new Set<number>((activeAssigned || []).map((x: { usu_id: number }) => x.usu_id));
      // setGloballyAssignedActiveIds(activeIds); // opcional, si lo quieres exponer
  
      const validAuxiliaries: AvailableAuxiliary[] = (candidates || [])
        .filter((item: any) => item?.usuario && item?.rol && item.usuario.est_id === 1)
        // 3) FILTRO CLAVE: excluir los que ya están activos en cualquier entrenador
        .filter((item: any) => !activeIds.has(item.usuario.usu_id))
        .map((item: any) => ({
          ...item.usuario,
          rol: item.rol
        }));
  
      setAvailableAuxiliaries(validAuxiliaries);
    } catch (error) {
      console.error("Error loading available auxiliaries:", error);
      toast({
        title: "Error",
        description: "Error al cargar los auxiliares disponibles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Assign auxiliary trainer
  const assignAuxiliary = async (entId: number, usuId: number, rolId: number) => {
    try {
      const { error } = await (supabase.from('entrenador_auxiliar') as any).insert({
        ent_id: entId,
        usu_id: usuId,
        rol_id: rolId,
        est_id: 1
      });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Auxiliar asignado correctamente"
      });

      // Reload assigned auxiliaries
      await loadAssignedAuxiliaries(entId);
      return true;
    } catch (error) {
      console.error("Error assigning auxiliary:", error);
      toast({
        title: "Error",
        description: "Error al asignar el auxiliar",
        variant: "destructive"
      });
      return false;
    }
  };

  // Remove auxiliary trainer
  const removeAuxiliary = async (entauxId: number, entId: number) => {
    try {
      const { error } = await (supabase.from('entrenador_auxiliar') as any)
        .update({ est_id: 2 })
        .eq('entaux_id', entauxId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Auxiliar removido correctamente"
      });

      // Reload assigned auxiliaries
      await loadAssignedAuxiliaries(entId);
      return true;
    } catch (error) {
      console.error("Error removing auxiliary:", error);
      toast({
        title: "Error",
        description: "Error al remover el auxiliar",
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    if (entrenadorId) {
      loadAssignedAuxiliaries(entrenadorId);
    }
  }, [entrenadorId]);

  return {
    assignedAuxiliaries,
    availableAuxiliaries,
    loading,
    loadAssignedAuxiliaries,
    loadAvailableAuxiliaries,
    assignAuxiliary,
    removeAuxiliary
  };
};
