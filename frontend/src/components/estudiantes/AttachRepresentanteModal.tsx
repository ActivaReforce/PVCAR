
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import EstudianteRepresentanteForm from "./EstudianteRepresentanteForm";

type Nino = Database['public']['Tables']['nino']['Row'];

interface EstudianteWithDetails extends Nino {
  colegio: { col_nombre: string } | null;
  representantes: Array<{
    padre: {
      padre_id: number;
      usu_id: number;
      usuario: Database['public']['Tables']['usuario']['Row'];
    };
  }>;
}

interface AttachRepresentanteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estudiante: EstudianteWithDetails | null;
  onSuccess: () => void;
}

const AttachRepresentanteModal = ({
  open,
  onOpenChange,
  estudiante,
  onSuccess
}: AttachRepresentanteModalProps) => {
  const [selectedUsuId, setSelectedUsuId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (estudiante && open) {
      setSelectedUsuId(estudiante.representantes[0]?.padre?.usu_id || null);
    }
  }, [estudiante, open]);

  const handleSave = async () => {
    if (!estudiante) return;

    setLoading(true);

    try {
      const currentUsuId = estudiante.representantes[0]?.padre?.usu_id || null;

      if (selectedUsuId !== currentUsuId) {
        // Remove existing relationships
        await supabase
          .from('nino_padre')
          .delete()
          .eq('nino_id', estudiante.nino_id);

        // Add new relationship if selected
        if (selectedUsuId) {
          // First, get or create the padre record for this usuario
          let padreId: number;
          
          const { data: existingPadre, error: findError } = await supabase
            .from('padre')
            .select('padre_id')
            .eq('usu_id', selectedUsuId)
            .single();

          if (findError && findError.code !== 'PGRST116') {
            throw findError;
          }

          if (existingPadre) {
            padreId = existingPadre.padre_id;
          } else {
            // Create a new padre record
            const { data: newPadre, error: createError } = await supabase
              .from('padre')
              .insert({
                usu_id: selectedUsuId,
                padre_fecha_creacion: new Date().toISOString(),
                padre_fecha_modificacion: new Date().toISOString()
              })
              .select('padre_id')
              .single();

            if (createError) throw createError;
            padreId = newPadre.padre_id;
          }

          // Create the nino_padre relationship
          const { error: relationError } = await supabase
            .from('nino_padre')
            .insert({
              nino_id: estudiante.nino_id,
              padre_id: padreId
            });

          if (relationError) throw relationError;
        }

        toast({
          title: "Éxito",
          description: selectedUsuId 
            ? "Representante asignado correctamente"
            : "Representante removido correctamente",
        });

        onSuccess();
      } else {
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error updating representante:", error);
      toast({
        title: "Error",
        description: error.message || "Error al actualizar representante",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Gestionar Representante - {estudiante?.nino_nombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <EstudianteRepresentanteForm
            selectedPadreId={selectedUsuId}
            onPadreChange={setSelectedUsuId}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttachRepresentanteModal;
