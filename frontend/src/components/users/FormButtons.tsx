
import { Button } from "@/components/ui/button";

interface FormButtonsProps {
  onCancel: () => void;
  loading: boolean;
  isEditMode: boolean;
}

const FormButtons = ({ onCancel, loading, isEditMode }: FormButtonsProps) => {
  return (
    <div className="flex justify-end space-x-4">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" variant="brand" disabled={loading}>
        {loading ? "Guardando..." : isEditMode ? "Actualizar" : "Crear"}
      </Button>
    </div>
  );
};

export default FormButtons;
