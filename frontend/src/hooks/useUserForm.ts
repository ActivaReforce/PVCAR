
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

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

export const useUserForm = (user?: Usuario | null, roles: Rol[] = []) => {
  const [formData, setFormData] = useState<FormData>({
    usu_nombre: user?.usu_nombre || "",
    usu_correo: user?.usu_correo || "",
    usu_telefono: user?.usu_telefono || "",
    usu_contrasena: "",
    selectedRoles: [],
    ent_cedula: "",
    padre_sector_residencia: "",
  });
  const [isAssignedAsColegioAdmin, setIsAssignedAsColegioAdmin] = useState(false);

  const isEditMode = !!user;
  
  // Get selected role information with simpler type checking
  const hasCoachRole = formData.selectedRoles.some(roleId => {
    const role = roles.find(r => r.rol_id === roleId);
    return roleId === 3 || role?.rol_nombre === "entrenador";
  });
  
  const hasParentRole = formData.selectedRoles.some(roleId => {
    const role = roles.find(r => r.rol_id === roleId);
    return roleId === 4 || role?.rol_nombre === "padre de familia" || role?.rol_nombre === "padre";
  });

  // Check if user is assigned as colegio admin
  useEffect(() => {
    const checkColegioAdminAssignment = async () => {
      if (!isEditMode || !user) return;

      try {
        const { data, error } = await supabase
          .from('colegio_coordinador')
          .select('col_id')
          .eq('usu_id', user.usu_id)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error checking colegio admin assignment:", error);
          return;
        }

        setIsAssignedAsColegioAdmin(!!data);
      } catch (error) {
        console.error("Error checking colegio admin assignment:", error);
      }
    };

    checkColegioAdminAssignment();
  }, [isEditMode, user]);

  // Load user roles when editing
  useEffect(() => {
    const loadUserRoles = async () => {
      if (!isEditMode || !user) return;

      try {
        const { data: userRoles, error } = await supabase
          .from('usuario_rol')
          .select('rol_id')
          .eq('usu_id', user.usu_id);

        if (error) {
          console.error("Error loading user roles:", error);
          return;
        }

        const roleIds = (userRoles || []).map(ur => ur.rol_id);
        setFormData(prev => ({ ...prev, selectedRoles: roleIds }));
      } catch (error) {
        console.error("Error loading user roles:", error);
      }
    };

    loadUserRoles();
  }, [isEditMode, user]);

  // Load role-specific data when editing
  useEffect(() => {
    const loadRoleSpecificData = async () => {
      if (!isEditMode || !user) return;

      try {
        if (hasCoachRole) {
          const { data, error } = await supabase
            .from('entrenador')
            .select('ent_cedula')
            .eq('ent_id', user.usu_id)
            .eq('est_id', 1)
            .maybeSingle();
          
          if (error) {
            console.error("Error loading coach data:", error);
          } else if (data) {
            setFormData(prev => ({ ...prev, ent_cedula: data.ent_cedula || "" }));
          }
        }

        if (hasParentRole) {
          const { data, error } = await supabase
            .from('padre')
            .select('padre_sector_residencia')
            .eq('usu_id', user.usu_id)
            .maybeSingle();
          
          if (error) {
            console.error("Error loading parent data:", error);
          } else if (data) {
            setFormData(prev => ({ ...prev, padre_sector_residencia: data.padre_sector_residencia || "" }));
          }
        }
      } catch (error) {
        console.error("Error loading role-specific data:", error);
      }
    };

    loadRoleSpecificData();
  }, [isEditMode, user, hasCoachRole, hasParentRole]);

  // Clear role-specific fields when roles change
  useEffect(() => {
    if (!hasCoachRole) {
      setFormData(prev => ({ ...prev, ent_cedula: "" }));
    }
    if (!hasParentRole) {
      setFormData(prev => ({ ...prev, padre_sector_residencia: "" }));
    }
  }, [hasCoachRole, hasParentRole]);

  const handleInputChange = (field: string, value: string | number[]) => {
    setFormData(prev => {
      const newData = { ...prev };
      (newData as any)[field] = value;
      return newData;
    });
  };

  return {
    formData,
    setFormData,
    handleInputChange,
    isEditMode,
    hasCoachRole,
    hasParentRole,
    isAssignedAsColegioAdmin,
  };
};
