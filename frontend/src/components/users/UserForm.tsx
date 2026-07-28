
import { Database } from "@/integrations/supabase/types";
import BasicUserFields from "./BasicUserFields";
import RoleSpecificFields from "./RoleSpecificFields";
import UserPhotoSection from "./UserPhotoSection";
import FormButtons from "./FormButtons";
import UserRoleSelection from "./UserRoleSelection";
import { useUserForm } from "@/hooks/useUserForm";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import { useUserFormSubmission } from "@/hooks/useUserFormSubmission";

type Usuario = Database['public']['Tables']['usuario']['Row'];
type Rol = Database['public']['Tables']['rol']['Row'];

interface UserFormProps {
  user?: Usuario | null;
  roles: Rol[];
  onSuccess: () => void;
  onCancel: () => void;
}

const UserForm = ({ user, roles, onSuccess, onCancel }: UserFormProps) => {
  const {
    formData,
    handleInputChange,
    isEditMode,
    hasCoachRole,
    hasParentRole,
    isAssignedAsColegioAdmin,
  } = useUserForm(user, roles);

  const {
    photoFile,
    photoCleared,
    uploadPhoto,
    deleteOldPhoto,
    handlePhotoChange,
  } = usePhotoUpload(user?.usu_foto);

  const { loading, handleSubmit } = useUserFormSubmission({
    user,
    roles,
    formData,
    photoFile,
    photoCleared,
    uploadPhoto,
    deleteOldPhoto,
    hasCoachRole,
    hasParentRole,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(onSuccess);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <BasicUserFields
          formData={formData}
          isEditMode={isEditMode}
          onInputChange={handleInputChange}
        />

        {/* Photo and Role-specific fields */}
        <div className="space-y-4">
          <UserPhotoSection
            initialImageUrl={user?.usu_foto}
            onImageChange={handlePhotoChange}
          />

          <UserRoleSelection
            roles={roles}
            selectedRoles={formData.selectedRoles}
            onRoleChange={(roles) => handleInputChange("selectedRoles", roles)}
            isAssignedAsColegioAdmin={isAssignedAsColegioAdmin}
          />

          <RoleSpecificFields
            formData={formData}
            roles={roles}
            onInputChange={handleInputChange}
          />
        </div>
      </div>

      <FormButtons
        onCancel={onCancel}
        loading={loading}
        isEditMode={isEditMode}
      />
    </form>
  );
};

export default UserForm;
