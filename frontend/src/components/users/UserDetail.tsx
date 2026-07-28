
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DialogFooter } from "@/components/ui/dialog";
import { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type Usuario = Database['public']['Tables']['usuario']['Row'];
type Rol = Database['public']['Tables']['rol']['Row'];

interface UserWithRoles extends Usuario {
  user_roles: Array<{ rol_id: number }>;
}

interface UserDetailProps {
  user: UserWithRoles;
  roles: Rol[];
  onClose: () => void;
}

interface CoachData {
  ent_cedula: string;
}

interface ParentData {
  padre_sector_residencia: string;
}

const UserDetail = ({ user, roles, onClose }: UserDetailProps) => {
  const [coachData, setCoachData] = useState<CoachData | null>(null);
  const [parentData, setParentData] = useState<ParentData | null>(null);
  const [loading, setLoading] = useState(true);

  const getUserRoles = () => {
    const userRoleIds = user.user_roles?.map(ur => ur.rol_id) || [];
    return roles.filter(r => userRoleIds.includes(r.rol_id));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const hasCoachRole = () => {
    const userRoles = getUserRoles();
    return userRoles.some(role => 
      role.rol_id === 3 || role.rol_nombre === "entrenador"
    );
  };

  const hasParentRole = () => {
    const userRoles = getUserRoles();
    return userRoles.some(role => 
      role.rol_id === 4 || role.rol_nombre === "padre de familia" || role.rol_nombre === "padre"
    );
  };

  useEffect(() => {
    const loadRoleSpecificData = async () => {
      setLoading(true);
      try {
        if (hasCoachRole()) {
          const { data, error } = await supabase
            .from('entrenador')
            .select('ent_cedula')
            .eq('ent_id', user.usu_id)
            .maybeSingle();
          
          if (error) {
            console.error("Error loading coach data:", error);
          } else {
            setCoachData(data);
          }
        }

        if (hasParentRole()) {
          const { data, error } = await supabase
            .from('padre')
            .select('padre_sector_residencia')
            .eq('padre_id', user.usu_id)
            .maybeSingle();
          
          if (error) {
            console.error("Error loading parent data:", error);
          } else {
            setParentData(data);
          }
        }
      } catch (error) {
        console.error("Error loading role-specific data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRoleSpecificData();
  }, [user.usu_id]);

  const userRoles = getUserRoles();

  return (
    <div className="space-y-6">
      {/* User Avatar and Basic Info */}
      <div className="flex items-center space-x-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.usu_foto || undefined} />
          <AvatarFallback className="text-lg">
            {getInitials(user.usu_nombre)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-xl font-semibold">{user.usu_nombre}</h3>
          <div className="flex flex-wrap gap-1 mt-2">
            {userRoles.length > 0 ? (
              userRoles.map((role) => (
                <Badge key={role.rol_id} variant="secondary">
                  {role.rol_titulo}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">Sin roles</Badge>
            )}
          </div>
        </div>
      </div>

      {/* User Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="font-semibold">Email:</Label>
          <p className="mt-1">{user.usu_correo}</p>
        </div>

        <div>
          <Label className="font-semibold">Teléfono:</Label>
          <p className="mt-1">{user.usu_telefono || "—"}</p>
        </div>

        <div>
          <Label className="font-semibold">Fecha de creación:</Label>
          <p className="mt-1">
            {user.usu_fecha_creacion 
              ? new Date(user.usu_fecha_creacion).toLocaleDateString()
              : "—"
            }
          </p>
        </div>

        <div>
          <Label className="font-semibold">Última modificación:</Label>
          <p className="mt-1">
            {user.usu_fecha_modificacion 
              ? new Date(user.usu_fecha_modificacion).toLocaleDateString()
              : "—"
            }
          </p>
        </div>

        {/* Role-specific fields */}
        {loading ? (
          <div className="col-span-2 text-center py-4">
            Cargando información adicional...
          </div>
        ) : (
          <>
            {hasCoachRole() && (
              <div>
                <Label className="font-semibold">Cédula:</Label>
                <p className="mt-1">{coachData?.ent_cedula || "—"}</p>
              </div>
            )}

            {hasParentRole() && (
              <div>
                <Label className="font-semibold">Sector de Residencia:</Label>
                <p className="mt-1">{parentData?.padre_sector_residencia || "—"}</p>
              </div>
            )}
          </>
        )}
      </div>

      <DialogFooter className="mt-6">
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </div>
  );
};

export default UserDetail;
