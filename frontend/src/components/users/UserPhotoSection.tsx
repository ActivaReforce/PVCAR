
import { Label } from "@/components/ui/label";
import ImageUpload from "@/components/ImageUpload";

interface UserPhotoSectionProps {
  initialImageUrl?: string | null;
  onImageChange: (file: File | null) => void;
}

const UserPhotoSection = ({ initialImageUrl, onImageChange }: UserPhotoSectionProps) => {
  return (
    <div>
      <Label>Foto de Perfil</Label>
      <ImageUpload
        initialImageUrl={initialImageUrl}
        onImageChange={onImageChange}
        buttonText="Subir Foto"
      />
    </div>
  );
};

export default UserPhotoSection;
