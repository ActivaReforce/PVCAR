
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface DisciplinaWithDetails {
  colacthor_id: number;
  colegio: { col_nombre: string } | null;
  actividad: { act_nombre: string } | null;
  dia: { dia_nombre: string } | null;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  colacthor_fecha_creacion: string;
  col_id: number | null;
  act_id: number | null;
  dia_id: number | null;
  est_id: number | null;
}

interface DisciplinaFormProps {
  disciplina?: DisciplinaWithDetails | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface Colegio {
  col_id: number;
  col_nombre: string;
}

interface Actividad {
  act_id: number;
  act_nombre: string;
}

interface Dia {
  dia_id: number;
  dia_nombre: string;
}

const DisciplinaForm = ({ disciplina, onSuccess, onCancel }: DisciplinaFormProps) => {
  const [formData, setFormData] = useState({
    col_id: disciplina?.col_id || null,
    act_id: disciplina?.act_id || null,
    dia_id: disciplina?.dia_id || null,
    colacthor_hora_inicio: disciplina?.colacthor_hora_inicio || "",
    colacthor_hora_fin: disciplina?.colacthor_hora_fin || "",
  });
  
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [dias, setDias] = useState<Dia[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!disciplina;

  useEffect(() => {
    loadSelectData();
  }, []);

  const loadSelectData = async () => {
    try {
      const [colegiosResult, actividadesResult, diasResult] = await Promise.all([
        supabase.from('colegio').select('col_id, col_nombre').order('col_nombre'),
        supabase.from('actividad').select('act_id, act_nombre').order('act_nombre'),
        supabase.from('dia').select('dia_id, dia_nombre').order('dia_id')
      ]);

      if (colegiosResult.error) throw colegiosResult.error;
      if (actividadesResult.error) throw actividadesResult.error;
      if (diasResult.error) throw diasResult.error;

      setColegios(colegiosResult.data || []);
      setActividades(actividadesResult.data || []);
      setDias(diasResult.data || []);
    } catch (error) {
      console.error("Error loading select data:", error);
      toast({
        title: "Error",
        description: "Error al cargar los datos del formulario",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isValid = await validateForm();
    if (!isValid) return;

    setLoading(true);
    
    try {
      const dataToSubmit = {
        col_id: formData.col_id,
        act_id: formData.act_id,
        dia_id: formData.dia_id,
        colacthor_hora_inicio: formData.colacthor_hora_inicio || null,
        colacthor_hora_fin: formData.colacthor_hora_fin || null,
        est_id: 1, // Default to active status
      };

      if (isEditMode && disciplina) {
        const { error } = await supabase
          .from("colegio_actividad_horario")
          .update(dataToSubmit)
          .eq('colacthor_id', disciplina.colacthor_id);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "La disciplina ha sido actualizada exitosamente.",
        });
      } else {
        const { error } = await supabase
          .from("colegio_actividad_horario")
          .insert(dataToSubmit);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "La disciplina ha sido creada exitosamente.",
        });
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving disciplina:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado. Por favor intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = async () => {
    if (!formData.col_id) {
      toast({
        title: "Error de validación",
        description: "Por favor selecciona un colegio.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.act_id) {
      toast({
        title: "Error de validación",
        description: "Por favor selecciona una actividad.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.dia_id) {
      toast({
        title: "Error de validación",
        description: "Por favor selecciona un día.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="col_id">Colegio *</Label>
          <Select
            value={formData.col_id?.toString() || ""}
            onValueChange={(value) => setFormData(prev => ({ ...prev, col_id: parseInt(value) }))}
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
          <Label htmlFor="act_id">Actividad *</Label>
          <Select
            value={formData.act_id?.toString() || ""}
            onValueChange={(value) => setFormData(prev => ({ ...prev, act_id: parseInt(value) }))}
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
          <Label htmlFor="dia_id">Día *</Label>
          <Select
            value={formData.dia_id?.toString() || ""}
            onValueChange={(value) => setFormData(prev => ({ ...prev, dia_id: parseInt(value) }))}
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
            <Label htmlFor="colacthor_hora_inicio">Hora Inicio</Label>
            <Input
              id="colacthor_hora_inicio"
              type="time"
              value={formData.colacthor_hora_inicio}
              onChange={(e) => setFormData(prev => ({ ...prev, colacthor_hora_inicio: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="colacthor_hora_fin">Hora Fin</Label>
            <Input
              id="colacthor_hora_fin"
              type="time"
              value={formData.colacthor_hora_fin}
              onChange={(e) => setFormData(prev => ({ ...prev, colacthor_hora_fin: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={loading} 
          className="bg-[#FD5757] hover:bg-[#E04747]"
        >
          {loading ? "Guardando..." : isEditMode ? "Actualizar" : "Crear Disciplina"}
        </Button>
      </div>
    </form>
  );
};

export default DisciplinaForm;
