
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { es } from "date-fns/locale";

const Perfil = () => {
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const { user } = useAuth();
  const { toast } = useToast();

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case "Propietario PVCAR":
        return "bg-red-500 hover:bg-red-600 text-white";
      case "AdminColegio":
        return "bg-orange-500 hover:bg-orange-600 text-white";
      case "Entrenador":
        return "bg-yellow-500 hover:bg-yellow-600 text-white";
      case "Representante":
        return "bg-green-500 hover:bg-green-600 text-white";
      default:
        return "bg-gray-500 hover:bg-gray-600 text-white";
    }
  };

  const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    return format(new Date(dateString), "d 'de' MMMM, yyyy", { locale: es });
  } catch (error) {
    return "Fecha inválida";
  }
};

  const getPrimaryRole = () => {
    if (!user?.roles || user.roles.length === 0) return "Usuario";
    
    // Priority order: AdminGlobal > AdminColegio > Entrenador > Representante
    const rolePriority = [
      { id: 1, name: "Propietario PVCAR" },
      { id: 2, name: "AdminColegio" },
      { id: 3, name: "Entrenador" },
      { id: 4, name: "Representante" }
    ];
    
    for (const priority of rolePriority) {
      const role = user.roles.find(r => r.rol_id === priority.id);
      if (role) return priority.name;
    }
    
    return user.roles[0]?.rol_titulo || "Usuario";
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordUpdate = async () => {
    if (!user) return;

    // Validate password inputs
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all password fields",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirmation do not match",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }

    // First verify the current password
    try {
      const { data, error } = await supabase
        .from('usuario')
        .select('usu_id')
        .eq('usu_id', user.usu_id)
        .eq('usu_contrasena', passwordData.currentPassword)
        .single();

      if (error || !data) {
        toast({
          title: "Password Error",
          description: "Current password is incorrect",
          variant: "destructive"
        });
        return;
      }

      // Update the password
      const { error: updateError } = await supabase
        .from('usuario')
        .update({
          usu_contrasena: passwordData.newPassword,
          usu_fecha_modificacion: new Date().toISOString()
        })
        .eq('usu_id', user.usu_id);

      if (updateError) {
        toast({
          title: "Error en la Actualización",
          description: "Fallo al actualizar la contraseña. Porfavor intente nuevamente.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Contraseña actualizada",
        description: "Su contraseña fue actualizada correctamente"
      });

      // Reset form and close edit mode
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setIsEditingPassword(false);
    } catch (error) {
      console.error("Password update error:", error);
      toast({
        title: "Error",
        description: "Error inesperado, comuniquese con el administrador",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto px-4 max-w-6xl py-4 lg:py-6">
      {/* Profile Card - Made responsive */}
      <Card className="border-none shadow-lg transition-colors dark:bg-card dark:border-border">
        <CardHeader className="pb-4">
          <h2 className="font-bold text-2xl sm:text-3xl">Perfil del Usuario</h2>
        </CardHeader>
        <CardContent className="p-4 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            {/* Profile Image */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="w-32 h-32 sm:w-40 sm:h-40 border-4 border-primary">
                {user?.usu_foto ? (
                  <AvatarImage src={user.usu_foto} alt={user.usu_nombre} />
                ) : (
                  <AvatarFallback className="text-2xl sm:text-3xl bg-muted text-muted-foreground">
                    {user?.usu_nombre?.split(' ').map(name => name[0]).join('').toUpperCase() || "?"}
                  </AvatarFallback>
                )}
              </Avatar>
              <Badge className={`${getRoleBadgeColor(getPrimaryRole())} text-xs sm:text-sm px-3 sm:px-4 py-1 sm:py-2`}>
                {getPrimaryRole()}
              </Badge>
            </div>
            
            {/* User Details - Made responsive */}
            <div className="flex-1 space-y-4 sm:space-y-6">
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-2">{user?.usu_nombre}</h3>
                  <p className="text-lg sm:text-xl text-muted-foreground mb-4">{user?.usu_correo}</p>
                  {user?.usu_telefono && (
                    <p className="text-base sm:text-lg">
                      <span className="font-semibold text-foreground">Teléfono: </span>
                      {user.usu_telefono}
                    </p>
                  )}
                </div>
                
                <div className="pt-4 sm:pt-6 border-t border-border">
                  <p className="text-sm sm:text-base mb-2">
                    <span className="font-semibold text-foreground">Cuenta Creada: </span>
                    {formatDate(user?.usu_fecha_creacion)}
                  </p>
                  <p className="text-sm sm:text-base">
                    <span className="font-semibold text-foreground">Ultima Actualización: </span>
                    {formatDate(user?.usu_fecha_modificacion)}
                  </p>
                </div>
              </div>
              
              {/* Password update section */}
              <div className="pt-4 sm:pt-6 mt-4 sm:mt-6 border-t border-border">
                {!isEditingPassword ? (
                  <Button 
                    onClick={() => setIsEditingPassword(true)} 
                    className="bg-[#FD5757] hover:bg-[#E04747] text-white w-full sm:w-auto dark:bg-[#FD5757] dark:hover:bg-[#E04747] dark:text-white"
                  >
                    Cambiar Contraseña
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <h4 className="text-base sm:text-lg font-medium">Cambiar Contraseña</h4>
                    <div>
                      <label htmlFor="currentPassword" className="block text-sm sm:text-base font-medium mb-2">
                        Contraseña Actual
                      </label>
                      <Input
                        id="currentPassword"
                        name="currentPassword"
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        className="text-base sm:text-lg p-3 sm:p-4 bg-background border-input text-foreground"
                      />
                    </div>
                    <div>
                      <label htmlFor="newPassword" className="block text-sm sm:text-base font-medium mb-2">
                        Nueva Contraseña
                      </label>
                      <Input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        className="text-base sm:text-lg p-3 sm:p-4 bg-background border-input text-foreground"
                      />
                    </div>
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm sm:text-base font-medium mb-2">
                        Confirma Nueva Contraseña
                      </label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        className="text-base sm:text-lg p-3 sm:p-4 bg-background border-input text-foreground"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button 
                        onClick={handlePasswordUpdate} 
                        className="bg-[#FD5757] hover:bg-[#E04747] text-white dark:bg-[#FD5757] dark:hover:bg-[#E04747] dark:text-white"
                      >
                        Actualizar Contraseña
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setIsEditingPassword(false);
                          setPasswordData({
                            currentPassword: "",
                            newPassword: "",
                            confirmPassword: ""
                          });
                        }} 
                        className="border-border text-foreground hover:bg-accent hover:text-accent-foreground dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700 dark:hover:text-white"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Perfil;
