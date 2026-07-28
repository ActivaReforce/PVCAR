
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useRoleTransitions } from "./useRoleTransitions";

type Usuario = Database['public']['Tables']['usuario']['Row'];
type Rol = Database['public']['Tables']['rol']['Row'];

interface FormData {
  usu_nombre: string;
  usu_correo: string;
  usu_telefono: string;
  usu_contrasena: string;
  selectedRoles: number[];
  ent_cedula: string;
  padre_sector_residencia: string;
}

interface SubmissionProps {
  user?: Usuario | null;
  roles: Rol[];
  formData: FormData;
  photoFile: File | null;
  photoCleared: boolean;
  uploadPhoto: (file: File) => Promise<string | null>;
  deleteOldPhoto: (url: string) => Promise<boolean>;
  hasCoachRole: boolean;
  hasParentRole: boolean;
}

export const useUserFormSubmission = ({ 
  user, 
  roles, 
  formData, 
  photoFile, 
  photoCleared, 
  uploadPhoto, 
  deleteOldPhoto,
  hasCoachRole,
  hasParentRole
}: SubmissionProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { handleRoleTransitions } = useRoleTransitions(roles);

  const isEditMode = !!user;

  const handleSubmit = async (onSuccess: () => void) => {
    setLoading(true);

    console.log("🚀 FORM SUBMISSION STARTED");
    console.log("📋 Current state:", {
      isEditMode,
      hasPhotoFile: !!photoFile,
      photoCleared,
      currentPhotoUrl: user?.usu_foto,
      selectedRoles: formData.selectedRoles
    });

    try {
      if (formData.selectedRoles.length === 0) {
        throw new Error("Debe seleccionar al menos un rol");
      }

      // Handle photo upload/deletion logic
      let photoUrl = user?.usu_foto;
      
      // If user cleared the photo and we're editing
      if (isEditMode && photoCleared && user?.usu_foto) {
        console.log("🗑️ Photo was cleared, attempting to delete old photo");
        const deleteSuccess = await deleteOldPhoto(user.usu_foto);
        if (deleteSuccess) {
          photoUrl = null;
          console.log("✅ Old photo deleted, setting URL to null");
        } else {
          console.log("⚠️ Old photo deletion failed, but continuing...");
          photoUrl = null; // Still clear the URL even if deletion failed
        }
      }

      // If user selected a new photo
      if (photoFile) {
        console.log("⬆️ New photo selected, attempting upload");
        const uploadedUrl = await uploadPhoto(photoFile);
        if (!uploadedUrl) {
          throw new Error("Error al subir la foto");
        }
        photoUrl = uploadedUrl;
        console.log("✅ New photo uploaded successfully");
      }

      // Prepare user data
      const userData = {
        usu_nombre: formData.usu_nombre,
        usu_correo: formData.usu_correo,
        usu_telefono: formData.usu_telefono || null,
        usu_foto: photoUrl,
        ...(formData.usu_contrasena && { usu_contrasena: formData.usu_contrasena }),
        usu_fecha_modificacion: new Date().toISOString(),
      };

      console.log("💾 Final user data:", userData);

      let usuarioId: number;
      let oldRoleIds: number[] = [];

      if (isEditMode && user) {
        // Get current roles for transition logic
        const { data: currentRoles } = await supabase
          .from('usuario_rol')
          .select('rol_id')
          .eq('usu_id', user.usu_id);
        
        oldRoleIds = (currentRoles || []).map(ur => ur.rol_id);

        // Handle role transitions BEFORE updating user
        await handleRoleTransitions(user.usu_id, formData.selectedRoles, oldRoleIds, formData);

        // Update existing user
        const { error } = await supabase
          .from('usuario')
          .update(userData)
          .eq('usu_id', user.usu_id);

        if (error) throw error;
        usuarioId = user.usu_id;

        // Update user roles
        // First, delete existing roles
        await supabase
          .from('usuario_rol')
          .delete()
          .eq('usu_id', usuarioId);

        // Then insert new roles
        if (formData.selectedRoles.length > 0) {
          const roleInserts = formData.selectedRoles.map(roleId => ({
            usu_id: usuarioId,
            rol_id: roleId
          }));

          const { error: roleError } = await supabase
            .from('usuario_rol')
            .insert(roleInserts);

          if (roleError) throw roleError;
        }

        // Update role-specific data
        if (hasCoachRole) {
          const { data: existingCoach } = await supabase
            .from('entrenador')
            .select('ent_id, est_id')
            .eq('ent_id', usuarioId)
            .maybeSingle();

          if (existingCoach && existingCoach.est_id === 1) {
            const { error } = await supabase
              .from('entrenador')
              .update({
                ent_cedula: formData.ent_cedula || null,
                ent_fecha_modificacion: new Date().toISOString(),
              })
              .eq('ent_id', usuarioId);

            if (error) throw error;
          }
        }

        if (hasParentRole) {
          const { data: existingParent } = await supabase
            .from('padre')
            .select('padre_id')
            .eq('usu_id', usuarioId)
            .maybeSingle();

          if (existingParent) {
            const { error } = await supabase
              .from('padre')
              .update({
                padre_sector_residencia: formData.padre_sector_residencia || null,
                padre_fecha_modificacion: new Date().toISOString(),
              })
              .eq('usu_id', usuarioId);

            if (error) throw error;
          }
        }
      } else {
        // Create new user
        const { data, error } = await supabase
          .from('usuario')
          .insert([{
            ...userData,
            usu_contrasena: formData.usu_contrasena,
            usu_fecha_creacion: new Date().toISOString(),
          }])
          .select()
          .single();

        if (error) throw error;
        usuarioId = data.usu_id;

        // Insert user roles
        const roleInserts = formData.selectedRoles.map(roleId => ({
          usu_id: usuarioId,
          rol_id: roleId
        }));

        const { error: roleError } = await supabase
          .from('usuario_rol')
          .insert(roleInserts);

        if (roleError) throw roleError;

        // Handle role-specific data for new users
        if (hasCoachRole) {
          const { error } = await supabase
            .from('entrenador')
            .insert({
              ent_id: usuarioId,
              ent_cedula: formData.ent_cedula || null,
              est_id: 1,
              ent_fecha_creacion: new Date().toISOString(),
            });

          if (error) throw error;
        }

        if (hasParentRole) {
          const { error } = await supabase
            .from('padre')
            .insert({
              usu_id: usuarioId,
              padre_sector_residencia: formData.padre_sector_residencia || null,
              padre_fecha_creacion: new Date().toISOString(),
            });

          if (error) throw error;
        }
      }

      console.log("✅ Form submission completed successfully");

      toast({
        title: "Éxito",
        description: `Usuario ${isEditMode ? "actualizado" : "creado"} correctamente`,
      });

      onSuccess();
    } catch (error: any) {
      console.error("💥 Form submission error:", error);
      toast({
        title: "Error",
        description: error.message || `Error al ${isEditMode ? "actualizar" : "crear"} el usuario`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    handleSubmit,
  };
};
