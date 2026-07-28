
import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface EvaluationDetailsStepProps {
  data: {
    eva_titulo: string;
    eva_descripcion: string;
    eva_categoria: string;
  };
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}

const EvaluationDetailsStep: React.FC<EvaluationDetailsStepProps> = ({
  data,
  onSubmit,
  isSubmitting
}) => {
  const form = useForm({
    defaultValues: data,
    mode: 'onChange'
  });

  const handleSubmit = (formData: any) => {
    onSubmit(formData);
  };

  const watchedTitle = form.watch('eva_titulo');
  const isTitleValid = watchedTitle && watchedTitle.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Completa la información básica de la evaluación
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="eva_titulo"
            rules={{ required: "El título es obligatorio" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Título *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Nombre de la evaluación"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="eva_descripcion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Describe los objetivos de esta evaluación..."
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="eva_categoria"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Ej: Sub 12, Sub 18, Principiantes..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              disabled={isSubmitting || !isTitleValid}
            >
              {isSubmitting ? 'Creando...' : 'Siguiente'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default EvaluationDetailsStep;
