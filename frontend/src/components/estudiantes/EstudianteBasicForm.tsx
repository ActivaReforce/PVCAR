import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ImageUpload from "@/components/ImageUpload";
import { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type Colegio = Database['public']['Tables']['colegio']['Row'];
type CategoriaNinoGrado = Database['public']['Tables']['categoria_nino_grado']['Row'];

interface FormData {
  col_id: number | null;
  nino_nombre: string;
  nino_edad: number | null;
  nino_cedula: string;
  catninograd_id: number | null;
  nino_toma_transporte: boolean | null;
  nino_info_salud: string;
  nino_otra_info: string;
  selectedUsuId: number | null;
}

interface EstudianteBasicFormProps {
  formData: FormData;
  colegios: Colegio[];
  loadingColegios?: boolean;
  initialImageUrl?: string | null;
  onInputChange: (field: keyof FormData, value: any) => void;
  onImageChange: (file: File | null) => void;
}

const EstudianteBasicForm = ({
  formData,
  colegios,
  loadingColegios = false,
  initialImageUrl,
  onInputChange,
  onImageChange
}: EstudianteBasicFormProps) => {
  const [grados, setGrados] = useState<CategoriaNinoGrado[]>([]);
  const [loadingGrados, setLoadingGrados] = useState(true);

  const fetchGrados = async () => {
    try {
      const { data, error } = await supabase
        .from('categoria_nino_grado')
        .select('*')
        .order('catninograd_id');

      if (error) {
        console.error("Error fetching grados:", error);
        throw error;
      }
      
      const gradosData = data || [];
      
      setGrados(gradosData);
    } catch (error) {
      console.error("Error fetching grados:", error);
    } finally {
      setLoadingGrados(false);
    }
  };

  React.useEffect(() => {
    fetchGrados();
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Información del Alumno</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="colegio">Colegio *</Label>
          <Select
            value={formData.col_id?.toString() || ""}
            onValueChange={(value) => onInputChange('col_id', parseInt(value))}
            disabled={loadingColegios}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                loadingColegios ? "Cargando colegios..." : 
                colegios.length === 0 ? "No hay colegios disponibles" :
                "Seleccione un colegio"
              } />
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

        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre del Alumno *</Label>
          <Input
            id="nombre"
            value={formData.nino_nombre}
            onChange={(e) => onInputChange('nino_nombre', e.target.value)}
            placeholder="Nombre completo"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edad">Edad</Label>
          <Input
            id="edad"
            type="number"
            value={formData.nino_edad || ""}
            onChange={(e) => onInputChange('nino_edad', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Edad en años"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cedula">Cédula</Label>
          <Input
            id="cedula"
            value={formData.nino_cedula}
            onChange={(e) => onInputChange('nino_cedula', e.target.value)}
            placeholder="Número de cédula"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="grado">Grado</Label>
          <Select
            value={formData.catninograd_id?.toString() || ""}
            onValueChange={(value) => onInputChange('catninograd_id', parseInt(value))}
            disabled={loadingGrados}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                loadingGrados ? "Cargando grados..." : 
                grados.length === 0 ? "No hay grados disponibles" :
                "Seleccione un grado"
              } />
            </SelectTrigger>
            <SelectContent>
              {grados.map((grado) => (
                <SelectItem key={grado.catninograd_id} value={grado.catninograd_id.toString()}>
                  {grado.catninograd_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Toma Transporte</Label>
        <RadioGroup
          value={formData.nino_toma_transporte === null ? "" : formData.nino_toma_transporte.toString()}
          onValueChange={(value) => onInputChange('nino_toma_transporte', value === "" ? null : value === "true")}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="true" id="transporte-si" />
            <Label htmlFor="transporte-si">Sí</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="false" id="transporte-no" />
            <Label htmlFor="transporte-no">No</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="info-salud">Información de Salud</Label>
        <Textarea
          id="info-salud"
          value={formData.nino_info_salud}
          onChange={(e) => onInputChange('nino_info_salud', e.target.value)}
          placeholder="Alergias, medicamentos, condiciones médicas..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="otra-info">Información Adicional</Label>
        <Textarea
          id="otra-info"
          value={formData.nino_otra_info}
          onChange={(e) => onInputChange('nino_otra_info', e.target.value)}
          placeholder="Otra información relevante..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Foto del Alumno</Label>
        <ImageUpload
          onImageChange={onImageChange}
          initialImageUrl={initialImageUrl}
          maxSizeMB={5}
        />
      </div>
    </div>
  );
};

export default EstudianteBasicForm;
