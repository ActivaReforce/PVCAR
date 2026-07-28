
import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Disciplina {
  colacthor_id: number;
  actividad_nombre: string;
  dia_nombre?: string;
  hora_inicio?: string;
  hora_fin?: string;
}

interface EstudianteDisciplinasChipsProps {
  estudiante: {
    nino_id: number;
    nino_nombre: string;
  };
  onLinkDisciplines: () => void;
  readonly?: boolean;
}

const EstudianteDisciplinasChips = ({ 
  estudiante, 
  onLinkDisciplines, 
  readonly = false 
}: EstudianteDisciplinasChipsProps) => {
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDisciplinas();
  }, [estudiante.nino_id]);

  const fetchDisciplinas = async () => {
    setLoading(true);
    try {
      const { data: assignments, error } = await supabase
        .from('nino_asignacion')
        .select(`
          colacthor_id,
          colegio_actividad_horario!inner(
            colacthor_hora_inicio,
            colacthor_hora_fin,
            actividad!inner(act_nombre),
            dia(dia_nombre)
          )
        `)
        .eq('nino_id', estudiante.nino_id)
        .eq('est_id', 1); // Only active assignments

      if (error) throw error;

      const formattedDisciplinas: Disciplina[] = (assignments || []).map(assignment => ({
        colacthor_id: assignment.colacthor_id,
        actividad_nombre: assignment.colegio_actividad_horario?.actividad?.act_nombre || 'Sin nombre',
        dia_nombre: assignment.colegio_actividad_horario?.dia?.dia_nombre,
        hora_inicio: assignment.colegio_actividad_horario?.colacthor_hora_inicio,
        hora_fin: assignment.colegio_actividad_horario?.colacthor_hora_fin
      }));

      setDisciplinas(formattedDisciplinas);
    } catch (error) {
      console.error("Error fetching student disciplines:", error);
      setDisciplinas([]);
    } finally {
      setLoading(false);
    }
  };

  const formatSchedule = (disciplina: Disciplina) => {
    const parts = [];
    if (disciplina.dia_nombre) {
      parts.push(disciplina.dia_nombre);
    }
    if (disciplina.hora_inicio && disciplina.hora_fin) {
      parts.push(`${disciplina.hora_inicio} - ${disciplina.hora_fin}`);
    }
    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h4 className="font-semibold text-lg">Disciplinas Activas</h4>
        <div className="text-sm text-muted-foreground">Cargando disciplinas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-lg">Disciplinas Activas</h4>
        {!readonly && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLinkDisciplines}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Gestionar
          </Button>
        )}
      </div>
      
      {disciplinas.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {disciplinas.map((disciplina) => (
            <Badge key={disciplina.colacthor_id} variant="default" className="text-sm">
              {disciplina.actividad_nombre}
              {formatSchedule(disciplina)}
            </Badge>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
          <p className="text-sm">Sin disciplinas asignadas</p>
          {!readonly && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={onLinkDisciplines}
            >
              <Plus className="h-4 w-4 mr-2" />
              Asignar Disciplinas
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EstudianteDisciplinasChips;
