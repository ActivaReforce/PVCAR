
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

const actividadSchema = z.object({
  act_nombre: z.string().min(1, 'El nombre es requerido'),
  cat_id: z.number().min(1, 'La categoría es requerida'),
  act_descripcion: z.string().optional(),
  act_tipo_espacio: z.string().optional(),
  act_espacio_trabajo: z.string().optional(),
  act_espacio_secundario: z.string().optional(),
  act_indumentaria_tipo: z.string().optional(),
  act_materiales_alumno: z.array(z.string()).optional(),
});

type ActividadFormData = z.infer<typeof actividadSchema>;

interface Actividad {
  act_id: number;
  act_nombre: string;
  cat_id?: number;
  act_descripcion?: string;
  act_tipo_espacio?: string;
  act_espacio_trabajo?: string;
  act_espacio_secundario?: string;
  act_indumentaria_tipo?: string;
  act_materiales_alumno?: string[];
  act_fecha_creacion?: string;
  act_fecha_modificacion?: string;
}

interface ActivityFormProps {
  actividad?: Actividad | null;
  onSubmit: (data: ActividadFormData & { act_materiales_alumno?: string[] }) => void;
  onCancel: () => void;
  isLoading: boolean;
  materialesInput: string;
  setMaterialesInput: (value: string) => void;
}

const ActivityForm: React.FC<ActivityFormProps> = ({
  actividad,
  onSubmit,
  onCancel,
  isLoading,
  materialesInput,
  setMaterialesInput,
}) => {
  // Fetch categories
  const { data: categorias = [], isLoading: isLoadingCategorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categoria')
        .select('cat_id, cat_nombre')
        .order('cat_nombre');
      
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<ActividadFormData>({
    resolver: zodResolver(actividadSchema),
    defaultValues: {
      act_nombre: actividad?.act_nombre || '',
      cat_id: actividad?.cat_id || undefined,
      act_descripcion: actividad?.act_descripcion || '',
      act_tipo_espacio: actividad?.act_tipo_espacio || '',
      act_espacio_trabajo: actividad?.act_espacio_trabajo || '',
      act_espacio_secundario: actividad?.act_espacio_secundario || '',
      act_indumentaria_tipo: actividad?.act_indumentaria_tipo || '',
    },
  });

  const handleSubmit = (data: ActividadFormData) => {
    const materialesArray = materialesInput
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
    
    onSubmit({
      ...data,
      act_materiales_alumno: materialesArray.length > 0 ? materialesArray : undefined,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="act_nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre *</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Fútbol, Pintura, Matemáticas" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="cat_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría *</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(parseInt(value))} 
                  value={field.value?.toString() || ''}
                  disabled={isLoadingCategorias}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categorias.map((categoria) => (
                      <SelectItem key={categoria.cat_id} value={categoria.cat_id.toString()}>
                        {categoria.cat_nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="act_descripcion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Descripción de la actividad..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="act_tipo_espacio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Espacio</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Cancha, Aula, Laboratorio" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="act_espacio_trabajo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Espacio de Trabajo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Cancha principal, Aula 101" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="act_espacio_secundario"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Espacio Secundario</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Vestidores, Bodega" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="act_indumentaria_tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Indumentaria</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Uniforme deportivo, Delantal" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div>
          <Label>Materiales del Alumno</Label>
          <Input
            placeholder="Ej: Balón, Pinceles, Calculadora (separados por comas)"
            value={materialesInput}
            onChange={(e) => setMaterialesInput(e.target.value)}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="bg-[#FD5757] hover:bg-[#E04747]"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {actividad ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default ActivityForm;
