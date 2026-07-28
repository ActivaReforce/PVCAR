import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DisciplinaWithDetails {
  colacthor_id: number;
  colegio: { col_nombre: string } | null;
  actividad: { act_nombre: string } | null;
  dia: { dia_nombre: string } | null;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  colacthor_fecha_creacion: string;
}

interface EditDisciplinaFormProps {
  disciplina: DisciplinaWithDetails;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormData {
  colegioId: string;
  actividadId: string;
  diaId: string;
  horaInicio: string;
  horaFin: string;
}

const EditDisciplinaForm = ({ disciplina, onSuccess, onCancel }: EditDisciplinaFormProps) => {
  const [formData, setFormData] = useState<FormData>({
    colegioId: "",
    actividadId: "",
    diaId: "",
    horaInicio: "",
    horaFin: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Load current disciplina data
  useEffect(() => {
    const loadDisciplinaData = async () => {
      try {
        const { data, error } = await supabase
          .from('colegio_actividad_horario')
          .select(`
            col_id,
            act_id,
            dia_id,
            colacthor_hora_inicio,
            colacthor_hora_fin
          `)
          .eq('colacthor_id', disciplina.colacthor_id)
          .single();

        if (error) throw error;

        setFormData({
          colegioId: data.col_id?.toString() || "",
          actividadId: data.act_id?.toString() || "",
          diaId: data.dia_id?.toString() || "",
          horaInicio: data.colacthor_hora_inicio || "",
          horaFin: data.colacthor_hora_fin || "",
        });
      } catch (error) {
        console.error("Error loading disciplina data:", error);
        toast({
          title: "Error",
          description: "Error al cargar los datos de la disciplina",
          variant: "destructive"
        });
      }
    };

    loadDisciplinaData();
  }, [disciplina.colacthor_id, toast]);

  // Fetch colegios
  const { data: colegios = [] } = useQuery({
    queryKey: ["colegios-for-disciplina"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colegio")
        .select("col_id, col_nombre")
        .order("col_nombre");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch actividades
  const { data: actividades = [] } = useQuery({
    queryKey: ["actividades-for-disciplina"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("actividad")
        .select("act_id, act_nombre")
        .order("act_nombre");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch dias
  const { data: dias = [] } = useQuery({
    queryKey: ["dias-for-disciplina"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dia")
        .select("dia_id, dia_nombre")
        .order("dia_id");
      
      if (error) throw error;
      return data || [];
    },
  });

  const checkScheduleOverlap = async () => {
    if (!formData.colegioId || !formData.actividadId || !formData.diaId || !formData.horaInicio || !formData.horaFin) {
      return false;
    }

    try {
      const { data: existingSchedules, error } = await supabase
        .from("colegio_actividad_horario")
        .select("colacthor_id, colacthor_hora_inicio, colacthor_hora_fin")
        .eq("col_id", parseInt(formData.colegioId))
        .eq("act_id", parseInt(formData.actividadId))
        .eq("dia_id", parseInt(formData.diaId))
        .neq("colacthor_id", disciplina.colacthor_id); // Exclude current record

      if (error) throw error;

      if (!existingSchedules || existingSchedules.length === 0) {
        return false;
      }

      // Check for time overlap
      const newStart = formData.horaInicio;
      const newEnd = formData.horaFin;

      for (const schedule of existingSchedules) {
        const existingStart = schedule.colacthor_hora_inicio;
        const existingEnd = schedule.colacthor_hora_fin;

        if (!existingStart || !existingEnd) continue;

        // Check if there's an overlap
        // Overlap occurs if: newStart < existingEnd AND newEnd > existingStart
        if (newStart < existingEnd && newEnd > existingStart) {
          return true; // Overlap found
        }
      }

      return false; // No overlap
    } catch (error) {
      console.error("Error checking schedule overlap:", error);
      return false;
    }
  };

  const validateForm = async () => {
    if (!formData.colegioId) {
      toast({
        title: "Error de validación",
        description: "Por favor selecciona un colegio.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.actividadId) {
      toast({
        title: "Error de validación",
        description: "Por favor selecciona una actividad.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.diaId) {
      toast({
        title: "Error de validación",
        description: "Por favor selecciona un día.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.horaInicio) {
      toast({
        title: "Error de validación",
        description: "Por favor ingresa la hora de inicio.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.horaFin) {
      toast({
        title: "Error de validación",
        description: "Por favor ingresa la hora de fin.",
        variant: "destructive",
      });
      return false;
    }

    // Validate that end time is after start time
    if (formData.horaInicio >= formData.horaFin) {
      toast({
        title: "Error de validación",
        description: "La hora de fin debe ser posterior a la hora de inicio.",
        variant: "destructive",
      });
      return false;
    }

    // Check for schedule overlap
    const hasOverlap = await checkScheduleOverlap();
    if (hasOverlap) {
      toast({
        title: "Error de validación",
        description: "Ya existe una disciplina para este colegio, actividad y día en el horario seleccionado. Por favor elige un horario diferente.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isValid = await validateForm();
    if (!isValid) return;

    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase
        .from("colegio_actividad_horario")
        .update({
          col_id: parseInt(formData.colegioId),
          act_id: parseInt(formData.actividadId),
          dia_id: parseInt(formData.diaId),
          colacthor_hora_inicio: formData.horaInicio,
          colacthor_hora_fin: formData.horaFin,
        })
        .eq('colacthor_id', disciplina.colacthor_id)
        .select();

      if (error) {
        console.error("Error updating disciplina:", error);
        toast({
          title: "Error",
          description: "No se pudo actualizar la disciplina. Por favor intenta nuevamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Éxito",
        description: "La disciplina ha sido actualizada exitosamente.",
      });

      onSuccess();
    } catch (error) {
      console.error("Error updating disciplina:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado. Por favor intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="colegio">Colegio *</Label>
          <Select
            value={formData.colegioId}
            onValueChange={(value) => setFormData(prev => ({ ...prev, colegioId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un colegio" />
            </SelectTrigger>
            <SelectContent>
              {colegios.map((colegio) => (
                <SelectItem key={colegio.col_id} value={colegio.col_id.toString()}>
                  {colegio.col_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="actividad">Actividad *</Label>
          <Select
            value={formData.actividadId}
            onValueChange={(value) => setFormData(prev => ({ ...prev, actividadId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una actividad" />
            </SelectTrigger>
            <SelectContent>
              {actividades.map((actividad) => (
                <SelectItem key={actividad.act_id} value={actividad.act_id.toString()}>
                  {actividad.act_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="dia">Día de la semana *</Label>
          <Select
            value={formData.diaId}
            onValueChange={(value) => setFormData(prev => ({ ...prev, diaId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un día" />
            </SelectTrigger>
            <SelectContent>
              {dias.map((dia) => (
                <SelectItem key={dia.dia_id} value={dia.dia_id.toString()}>
                  {dia.dia_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="horaInicio">Hora de Inicio *</Label>
            <Input
              id="horaInicio"
              type="time"
              value={formData.horaInicio}
              onChange={(e) => setFormData(prev => ({ ...prev, horaInicio: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="horaFin">Hora de Fin *</Label>
            <Input
              id="horaFin"
              type="time"
              value={formData.horaFin}
              onChange={(e) => setFormData(prev => ({ ...prev, horaFin: e.target.value }))}
              required
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Actualizando..." : "Actualizar Disciplina"}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default EditDisciplinaForm;
