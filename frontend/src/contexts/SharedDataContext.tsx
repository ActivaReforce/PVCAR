import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TrainerAssignment {
  ent_id: number;
  colacthor_id: number;
  col_id: number;
}

interface CoordinatorSchool {
  col_id: number;
}

interface SharedDataContextValue {
  // Trainer assignments (for trainers and auxiliaries)
  trainerAssignments: TrainerAssignment[];
  trainerAssignmentsLoading: boolean;
  
  // Coordinator schools
  coordinatorSchools: CoordinatorSchool[];
  coordinatorSchoolsLoading: boolean;
  
  // Convenience getters
  getTrainerSchoolIds: () => number[];
  getTrainerDisciplineSlots: () => number[];
  getCoordinatorSchoolIds: () => number[];
  
  // Resolved trainer ID for auxiliaries
  effectiveTrainerId: number | null;
  effectiveTrainerIdLoading: boolean;
}

const SharedDataContext = createContext<SharedDataContextValue | null>(null);

export const SharedDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  const isTrainer = user?.roles?.some(role => role.rol_id === 3);
  const isAuxiliary = user?.roles?.some(role => role.rol_id === 6 || role.rol_id === 7);
  const isCoordinator = user?.roles?.some(role => role.rol_id === 2);

  // Resolve auxiliary's trainer ID - cached for 5 minutes
  const { data: auxiliaryTrainerData, isLoading: auxiliaryLoading } = useQuery({
    queryKey: ['auxiliary-trainer-context', user?.usu_id],
    queryFn: async () => {
      if (!user?.usu_id || !isAuxiliary) return null;
      
      const { data, error } = await supabase
        .from('entrenador_auxiliar')
        .select('ent_id')
        .eq('usu_id', user.usu_id)
        .eq('est_id', 1)
        .maybeSingle();
      
      if (error) throw error;
      return data?.ent_id || null;
    },
    enabled: !!user?.usu_id && isAuxiliary,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const effectiveTrainerId = isAuxiliary ? auxiliaryTrainerData : (isTrainer ? user?.usu_id : null);

  // Fetch trainer assignments - cached for 5 minutes
  const { data: trainerAssignments = [], isLoading: trainerAssignmentsLoading } = useQuery({
    queryKey: ['shared-trainer-assignments', effectiveTrainerId],
    queryFn: async () => {
      if (!effectiveTrainerId) return [];
      
      const { data, error } = await supabase
        .from('entrenador_asignacion')
        .select(`
          ent_id,
          colacthor_id,
          colegio_actividad_horario!inner(col_id)
        `)
        .eq('ent_id', effectiveTrainerId)
        .eq('est_id', 1);
      
      if (error) throw error;
      
      return (data || []).map(item => ({
        ent_id: item.ent_id!,
        colacthor_id: item.colacthor_id!,
        col_id: (item.colegio_actividad_horario as any).col_id
      }));
    },
    enabled: !!effectiveTrainerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch coordinator schools - cached for 5 minutes
  const { data: coordinatorSchools = [], isLoading: coordinatorSchoolsLoading } = useQuery({
    queryKey: ['shared-coordinator-schools', user?.usu_id],
    queryFn: async () => {
      if (!user?.usu_id || !isCoordinator) return [];
      
      const { data, error } = await supabase
        .from('colegio_coordinador')
        .select('col_id')
        .eq('usu_id', user.usu_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.usu_id && isCoordinator,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const value = useMemo<SharedDataContextValue>(() => ({
    trainerAssignments,
    trainerAssignmentsLoading: trainerAssignmentsLoading || auxiliaryLoading,
    coordinatorSchools,
    coordinatorSchoolsLoading,
    effectiveTrainerId: effectiveTrainerId ?? null,
    effectiveTrainerIdLoading: auxiliaryLoading,
    
    getTrainerSchoolIds: () => [...new Set(trainerAssignments.map(a => a.col_id))],
    getTrainerDisciplineSlots: () => trainerAssignments.map(a => a.colacthor_id),
    getCoordinatorSchoolIds: () => coordinatorSchools.map(s => s.col_id),
  }), [trainerAssignments, trainerAssignmentsLoading, coordinatorSchools, coordinatorSchoolsLoading, effectiveTrainerId, auxiliaryLoading]);

  return (
    <SharedDataContext.Provider value={value}>
      {children}
    </SharedDataContext.Provider>
  );
};

export const useSharedData = (): SharedDataContextValue => {
  const context = useContext(SharedDataContext);
  if (!context) {
    throw new Error('useSharedData must be used within a SharedDataProvider');
  }
  return context;
};
