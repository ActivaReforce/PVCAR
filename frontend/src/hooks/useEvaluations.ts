
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Evaluation {
  eva_id: number;
  eva_titulo: string;
  eva_descripcion: string | null;
  eva_categoria: string | null;
  eva_creador: number;
  eva_fecha_creacion: string;
  eva_puntaje_total: number | null;
  est_id: number;
}

interface EvaluationParameter {
  evaparam_id: number;
  eva_id: number;
  evaparam_nombre: string;
  evaparam_nota: string | null;
  evaparam_puntaje: number;
  evaparam_intentos: number;
  evatipometo_id: number;
  evaparam_escala_min: number | null;
  evaparam_escala_max: number | null;
}

export const useEvaluations = () => {
  const { toast } = useToast();

  const fetchEvaluationWithParameters = async (evaluationId: number) => {
    try {
      // Fetch evaluation details
      const { data: evaluation, error: evalError } = await supabase
        .from('evaluacion')
        .select('*')
        .eq('eva_id', evaluationId)
        .single();

      if (evalError) {
        console.error('Error fetching evaluation:', evalError);
        return null;
      }

      // Fetch parameters
      const { data: parameters, error: paramsError } = await supabase
        .from('evaluacion_parametro')
        .select('*')
        .eq('eva_id', evaluationId)
        .order('evaparam_id');

      if (paramsError) {
        console.error('Error fetching parameters:', paramsError);
        return null;
      }

      return {
        evaluation,
        parameters: parameters || []
      };
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la evaluación.",
        variant: "destructive",
      });
      return null;
    }
  };

  const fetchEvaluationMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('evaluacion_tipo_metodo')
        .select('*')
        .order('evatipometo_id');

      if (error) {
        console.error('Error fetching evaluation methods:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Unexpected error:', error);
      return [];
    }
  };

  return {
    fetchEvaluationWithParameters,
    fetchEvaluationMethods
  };
};
