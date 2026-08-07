
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
      {/* El rojo de marca es fijo, asi que el texto tambien: sin esto hereda
          primary-foreground, que en modo oscuro es casi negro sobre el rojo. */}
      <Button
        type="submit"
        disabled={loading}
        className="bg-[#FD5757] hover:bg-[#E04747] text-white"
      >
        {loading ? "Guardando..." : isEditMode ? "Actualizar" : "Crear"}
      </Button>
    </div>
  );
};

export default FormButtons;
