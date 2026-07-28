
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ActivityForm from "@/components/activities/ActivityForm";
import ActivityDetails from "@/components/activities/ActivityDetails";

interface Categoria {
  cat_id: number;
  cat_nombre: string;
  cat_descripcion?: string | null;
}

interface Actividad {
  act_id: number;
  act_nombre: string;
  act_descripcion?: string | null;
  act_materiales_alumno?: string[] | null;
  act_indumentaria_tipo?: string | null;
  act_espacio_trabajo?: string | null;
  act_tipo_espacio?: string | null;
  act_espacio_secundario?: string | null;
  cat_id?: number | null;
  act_fecha_creacion: string;
  act_fecha_modificacion: string;
  categoria?: Categoria | null;
}

type ActividadFormValues = {
  act_nombre: string;
  act_descripcion?: string | null;
  act_materiales_alumno?: string[] | null;
  act_indumentaria_tipo?: string | null;
  act_espacio_trabajo?: string | null;
  act_tipo_espacio?: string | null;
  act_espacio_secundario?: string | null;
  cat_id?: number | null;
};

interface ActivityDialogsProps {
  isFormDialogOpen: boolean;
  setIsFormDialogOpen: (open: boolean) => void;
  isDetailsDialogOpen: boolean;
  setIsDetailsDialogOpen: (open: boolean) => void;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (open: boolean) => void;
  selectedActividad: Actividad | null;
  isFormLoading: boolean;
  materialesInput: string;
  setMaterialesInput: (value: string) => void;
  onFormSubmit: (values: ActividadFormValues) => Promise<void>;
  onDelete: () => Promise<void>;
}

const ActivityDialogs = ({
  isFormDialogOpen,
  setIsFormDialogOpen,
  isDetailsDialogOpen,
  setIsDetailsDialogOpen,
  isDeleteDialogOpen,
  setIsDeleteDialogOpen,
  selectedActividad,
  isFormLoading,
  materialesInput,
  setMaterialesInput,
  onFormSubmit,
  onDelete
}: ActivityDialogsProps) => {
  return (
    <>
      {/* Create/Edit Form Dialog */}
      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-md md:max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {selectedActividad ? "Editar Actividad" : "Nueva Actividad"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {selectedActividad 
                ? "Actualiza la información de la actividad." 
                : "Completa el formulario para crear una nueva actividad."
              }
            </DialogDescription>
          </DialogHeader>

          <ActivityForm 
            actividad={selectedActividad} 
            onSubmit={onFormSubmit} 
            onCancel={() => setIsFormDialogOpen(false)}
            isLoading={isFormLoading}
            materialesInput={materialesInput}
            setMaterialesInput={setMaterialesInput}
          />
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-md md:max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Detalles de la Actividad</DialogTitle>
          </DialogHeader>

          {selectedActividad && (
            <ActivityDetails 
              actividad={selectedActividad} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Esta acción eliminará la actividad "{selectedActividad?.act_nombre}" permanentemente.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={onDelete} 
              className="bg-destructive text-destructive-foreground w-full sm:w-auto"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ActivityDialogs;
