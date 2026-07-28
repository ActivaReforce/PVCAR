
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BasicUserFieldsProps {
  formData: {
    usu_nombre: string;
    usu_correo: string;
    usu_telefono: string;
    usu_contrasena: string;
  };
  isEditMode: boolean;
  onInputChange: (field: string, value: string) => void;
}

const BasicUserFields = ({ formData, isEditMode, onInputChange }: BasicUserFieldsProps) => {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="usu_nombre">Nombre Completo *</Label>
        <Input
          id="usu_nombre"
          value={formData.usu_nombre}
          onChange={(e) => onInputChange("usu_nombre", e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="usu_correo">Email *</Label>
        <Input
          id="usu_correo"
          type="email"
          value={formData.usu_correo}
          onChange={(e) => onInputChange("usu_correo", e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="usu_telefono">Teléfono</Label>
        <Input
          id="usu_telefono"
          value={formData.usu_telefono}
          onChange={(e) => onInputChange("usu_telefono", e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="usu_contrasena">
          Contraseña {isEditMode ? "(dejar vacío para mantener actual)" : "*"}
        </Label>
        <Input
          id="usu_contrasena"
          type="password"
          value={formData.usu_contrasena}
          onChange={(e) => onInputChange("usu_contrasena", e.target.value)}
          required={!isEditMode}
        />
      </div>
    </div>
  );
};

export default BasicUserFields;
