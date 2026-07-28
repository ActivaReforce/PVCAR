import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EntrenadorWithDetails, Usuario, Entrenador } from "@/components/entrenadores/EntrenadorTypes";

export const useEntrenadoresData = () => {
  const [entrenadores, setEntrenadores] = useState<EntrenadorWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadEntrenadores = async () => {
    // Cancel previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);

      // 1. Get all active trainers with user info
      const { data: entrenadoresData, error: entrenadoresError } = await supabase
        .from('entrenador')
        .select(`
          ent_id,
          ent_cedula,
          ent_fecha_creacion,
          ent_fecha_modificacion,
          est_id,
          usuario!entrenador_ent_id_fkey (
            usu_id,
            usu_nombre,
            usu_correo,
            usu_telefono,
            usu_foto,
            usu_fecha_creacion,
            usu_fecha_modificacion
          )
        `)
        .eq('est_id', 1)
        .order('ent_fecha_creacion', { ascending: false });

      if (entrenadoresError) throw entrenadoresError;

      // Filter out any records where usuario is null
      const validEntrenadores = (entrenadoresData || []).filter(
        (item): item is Entrenador & { usuario: Usuario } => 
          item.usuario !== null && typeof item.usuario === 'object'
      );

      if (validEntrenadores.length === 0) {
        setEntrenadores([]);
        return;
      }

      const trainerIds = validEntrenadores.map(e => e.ent_id);

      // 2. BATCH: Get ALL assignments for ALL trainers in ONE query
      const { data: allAssignmentsData } = await supabase
        .from('entrenador_asignacion')
        .select(`
          ent_id,
          entasig_id,
          colegio_actividad_horario:colacthor_id (
            colacthor_id,
            colacthor_hora_inicio,
            colacthor_hora_fin,
            colegio:col_id (
              col_nombre
            ),
            actividad:act_id (
              act_nombre
            ),
            dia:dia_id (
              dia_nombre
            )
          )
        `)
        .in('ent_id', trainerIds)
        .eq('est_id', 1)
        .is('entasig_fecha_fin', null);

      // 3. BATCH: Get ALL auxiliary trainers count for ALL trainers in ONE query
      const { data: allAuxiliaresData } = await supabase
        .from('entrenador_auxiliar')
        .select('ent_id, entaux_id')
        .in('ent_id', trainerIds)
        .eq('est_id', 1);

      // Group assignments by trainer
      const assignmentsByTrainer = new Map<number, any[]>();
      (allAssignmentsData || []).forEach(assignment => {
        if (assignment.ent_id) {
          const existing = assignmentsByTrainer.get(assignment.ent_id) || [];
          existing.push(assignment);
          assignmentsByTrainer.set(assignment.ent_id, existing);
        }
      });

      // Count auxiliaries by trainer
      const auxiliaresCountByTrainer = new Map<number, number>();
      (allAuxiliaresData || []).forEach(aux => {
        if (aux.ent_id) {
          const count = auxiliaresCountByTrainer.get(aux.ent_id) || 0;
          auxiliaresCountByTrainer.set(aux.ent_id, count + 1);
        }
      });

      // Build final data structure without additional queries
      const entrenadoresWithDetails: EntrenadorWithDetails[] = validEntrenadores.map(entrenador => {
        const assignments = assignmentsByTrainer.get(entrenador.ent_id) || [];
        const auxiliares_count = auxiliaresCountByTrainer.get(entrenador.ent_id) || 0;

        const disciplinas = assignments
          .filter(item => item.colegio_actividad_horario)
          .map(item => {
            const cah = item.colegio_actividad_horario as any;
            return {
              colegio_nombre: cah.colegio?.col_nombre || '',
              actividad_nombre: cah.actividad?.act_nombre || '',
              dia_nombre: cah.dia?.dia_nombre || '',
              hora_inicio: cah.colacthor_hora_inicio,
              hora_fin: cah.colacthor_hora_fin
            };
          });

        const uniqueColegios = [...new Set(disciplinas.map(d => d.colegio_nombre))].filter(Boolean);

        return {
          ...entrenador,
          colegios: uniqueColegios,
          disciplinas_count: disciplinas.length,
          auxiliares_count,
          disciplinas
        };
      });

      setEntrenadores(entrenadoresWithDetails);
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error("Error loading entrenadores:", error);
      toast({
        title: "Error",
        description: "Error al cargar los entrenadores",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntrenadores();
    
    // Cleanup: abort on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    entrenadores,
    loading,
    loadEntrenadores
  };
};
