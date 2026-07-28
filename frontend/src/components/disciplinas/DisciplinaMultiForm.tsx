import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";

interface DisciplinaMultiFormProps {
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

const DisciplinaMultiForm = ({ onSuccess, onCancel }: DisciplinaMultiFormProps) => {
  const [formData, setFormData] = useState({
    act_id: null as number | null,
    selectedColegios: [] as number[],
    selectedDias: [] as number[],
    colacthor_hora_inicio: "",
    colacthor_hora_fin: "",
  });
  
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [dias, setDias] = useState<Dia[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadSelectData();
  }, []);

  const isCoordinator = () => {
    return user?.roles?.some(role => role.rol_id === 2);
  };

  const getCoordinatorSchools = async (): Promise<number[]> => {
    if (!isCoordinator() || !user?.usu_id) {
      return [];
    }

    const { data, error } = await supabase
      .from('colegio_coordinador')
      .select('col_id')
      .eq('usu_id', user.usu_id);

    if (error) {
      console.error("Error fetching coordinator schools:", error);
      return [];
    }

    return (data || []).map(item => item.col_id).filter(Boolean);
  };

  const loadSelectData = async () => {
    try {
      // Get coordinator's schools if applicable
      const coordinatorSchools = await getCoordinatorSchools();

      // Build colegios query
      let colegiosQuery = supabase
        .from('colegio')
        .select('col_id, col_nombre')
        .order('col_nombre');

      // Filter by coordinator's schools if coordinator
      if (coordinatorSchools.length > 0) {
        colegiosQuery = colegiosQuery.in('col_id', coordinatorSchools);
      }

      const [colegiosResult, actividadesResult, diasResult] = await Promise.all([
        colegiosQuery,
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

  const handleColegioToggle = (colegioId: number) => {
    setFormData(prev => ({
      ...prev,
      selectedColegios: prev.selectedColegios.includes(colegioId)
        ? prev.selectedColegios.filter(id => id !== colegioId)
        : [...prev.selectedColegios, colegioId]
    }));
  };

  const handleDiaToggle = (diaId: number) => {
    setFormData(prev => ({
      ...prev,
      selectedDias: prev.selectedDias.includes(diaId)
        ? prev.selectedDias.filter(id => id !== diaId)
        : [...prev.selectedDias, diaId]
    }));
  };

  const validateForm = () => {
    if (!formData.act_id) {
      toast({
        title: "Error de validación",
        description: "Por favor selecciona una actividad.",
        variant: "destructive",
      });
      return false;
    }

    if (formData.selectedColegios.length === 0) {
      toast({
        title: "Error de validación",
        description: "Por favor selecciona al menos un colegio.",
        variant: "destructive",
      });
      return false;
    }

    if (formData.selectedDias.length === 0) {
      toast({
        title: "Error de validación",
        description: "Por favor selecciona al menos un día.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    
    try {
      const disciplinasToCreate = [];
      
      // Create combinations of colegios and dias
      for (const colegioId of formData.selectedColegios) {
        for (const diaId of formData.selectedDias) {
          disciplinasToCreate.push({
            col_id: colegioId,
            act_id: formData.act_id,
            dia_id: diaId,
            colacthor_hora_inicio: formData.colacthor_hora_inicio || null,
            colacthor_hora_fin: formData.colacthor_hora_fin || null,
            est_id: 1, // Default to active status
          });
        }
      }

      const { error } = await supabase
        .from("colegio_actividad_horario")
        .insert(disciplinasToCreate);

      if (error) throw error;

      const totalCreated = disciplinasToCreate.length;
      toast({
        title: "Éxito",
        description: `Se han creado ${totalCreated} disciplina${totalCreated > 1 ? 's' : ''} exitosamente.`,
      });

      onSuccess();
    } catch (error) {
      console.error("Error saving disciplinas:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado. Por favor intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {/* Actividad - moved to top */}
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

        {/* Colegios - Multi-select */}
        <div>
          <Label>Colegios * ({formData.selectedColegios.length} seleccionados)</Label>
          <ScrollArea className="h-32 border rounded-md p-2">
            <div className="space-y-2">
              {colegios.map((colegio) => (
                <div key={colegio.col_id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`colegio-${colegio.col_id}`}
                    checked={formData.selectedColegios.includes(colegio.col_id)}
                    onCheckedChange={() => handleColegioToggle(colegio.col_id)}
                  />
                  <label 
                    htmlFor={`colegio-${colegio.col_id}`} 
                    className="text-sm cursor-pointer flex-1"
                  >
                    {colegio.col_nombre}
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Días - Multi-select */}
        <div>
          <Label>Días * ({formData.selectedDias.length} seleccionados)</Label>
          <ScrollArea className="h-32 border rounded-md p-2">
            <div className="space-y-2">
              {dias.map((dia) => (
                <div key={dia.dia_id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`dia-${dia.dia_id}`}
                    checked={formData.selectedDias.includes(dia.dia_id)}
                    onCheckedChange={() => handleDiaToggle(dia.dia_id)}
                  />
                  <label 
                    htmlFor={`dia-${dia.dia_id}`} 
                    className="text-sm cursor-pointer flex-1 capitalize"
                  >
                    {dia.dia_nombre}
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Time range */}
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

        {/* Summary */}
        {formData.selectedColegios.length > 0 && formData.selectedDias.length > 0 && (
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">
              Se crearán {formData.selectedColegios.length * formData.selectedDias.length} disciplina(s) 
              ({formData.selectedColegios.length} colegio(s) × {formData.selectedDias.length} día(s))
            </p>
          </div>
        )}
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
          {loading ? "Creando..." : "Crear Disciplinas"}
        </Button>
      </div>
    </form>
  );
};

export default DisciplinaMultiForm;
