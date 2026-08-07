
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { es } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { perfilApi } from "@/api/perfil";

const Perfil = () => {
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const { user, changePassword } = useAuth();
  const { toast } = useToast();

  /**
   * El bucket de fotos es privado desde la migracion 0003: usuario.usu_foto
   * guarda la ruta del objeto, no una URL que sirva. GET /perfil devuelve
   * usu_foto_url ya firmada, valida una hora, y es la unica que se puede pintar.
   */
  const perfil = useQuery({
    queryKey: ['perfil'],
    queryFn: () => perfilApi.obtener(),
  });

  const fotoUrl = perfil.data?.usu_foto_url ?? null;

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

  /**
   * Cambio de contraseña contra POST /auth/change-password.
   * Antes esto leía y escribía usu_contrasena en texto plano desde el
   * navegador: la contraseña actual se comparaba con un .eq() y la nueva se
   * guardaba tal cual. Ahora el backend reautentica y Supabase Auth la hashea;
   * la validación de la nueva la hace el servidor, no solo esta pantalla.
   */
  const handlePasswordUpdate = async () => {
    if (!user) return;

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: "Campos incompletos",
        description: "Complete los tres campos de contraseña",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Las contraseñas no coinciden",
        description: "La nueva contraseña y su confirmación son distintas",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive"
      });
      return;
    }

    setIsSavingPassword(true);

    const { error } = await changePassword(
      passwordData.currentPassword,
      passwordData.newPassword
    );

    setIsSavingPassword(false);

    if (error) {
      toast({
        title: "No se pudo cambiar la contraseña",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Contraseña actualizada",
      description: "Su contraseña fue actualizada correctamente"
    });

    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
    setIsEditingPassword(false);
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
                {fotoUrl ? (
                  <AvatarImage src={fotoUrl} alt={user?.usu_nombre} />
                ) : (
                  <AvatarFallback className="text-2xl sm:text-3xl bg-muted text-muted-foreground">
                    {user?.usu_nombre?.split(' ').map(name => name[0]).join('').toUpperCase() || "?"}
                  </AvatarFallback>
                )}
              </Avatar>
              {/*
                Todos los roles, no solo el "principal". Quien es coordinador y
                entrenador a la vez lo es de verdad; ensenar uno solo fue parte
                del problema que el cliente pidio arreglar (decision D2).
              */}
              <div className="flex flex-wrap justify-center gap-2">
                {(user?.roles ?? []).map((rol) => (
                  <Badge
                    key={rol.rol_id}
                    className={`${getRoleBadgeColor(rol.rol_titulo)} text-xs sm:text-sm px-3 sm:px-4 py-1 sm:py-2`}
                  >
                    {rol.rol_titulo}
                  </Badge>
                ))}
                {(user?.roles?.length ?? 0) === 0 && (
                  <Badge className={getRoleBadgeColor()}>{getPrimaryRole()}</Badge>
                )}
              </div>
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
                        disabled={isSavingPassword}
                        className="bg-[#FD5757] hover:bg-[#E04747] text-white dark:bg-[#FD5757] dark:hover:bg-[#E04747] dark:text-white"
                      >
                        {isSavingPassword ? "Actualizando..." : "Actualizar Contraseña"}
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
