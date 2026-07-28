import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { usePagination } from "@/hooks/usePagination";
import { useSorting } from "@/hooks/useSorting";
import { useCoachStatusUpdates } from "@/hooks/useCoachStatusUpdates";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import UserForm from "@/components/users/UserForm";
import UserDetail from "@/components/users/UserDetail";
import UsuariosHeader from "@/components/users/UsuariosHeader";
import UsuariosSearch from "@/components/users/UsuariosSearch";
import UsuariosFilters from "@/components/users/UsuariosFilters";
import UsuariosContent from "@/components/users/UsuariosContent";
import UserStatusFilters from "@/components/users/UserStatusFilters";
import { UserDeactivationDialog } from "@/components/users/UserDeactivationDialog";

type Usuario = Database['public']['Tables']['usuario']['Row'];
type Rol = Database['public']['Tables']['rol']['Row'];

interface UserWithRoles extends Usuario {
  user_roles: Array<{ rol_id: number }>;
}

interface UserCounts {
  active: number;
  inactive: number;
  total: number;
}

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState<UserWithRoles[]>([]);
  const [allUsuarios, setAllUsuarios] = useState<UserWithRoles[]>([]);
  const [userCounts, setUserCounts] = useState<UserCounts>({ active: 0, inactive: 0, total: 0 });
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [viewingUser, setViewingUser] = useState<UserWithRoles | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showDeactivationDialog, setShowDeactivationDialog] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState<UserWithRoles | null>(null);
  const { toast } = useToast();
  const { updateCoachStatus } = useCoachStatusUpdates();

  // Calculate user counts from all users
  const calculateUserCounts = (users: UserWithRoles[]): UserCounts => {
    const active = users.filter(u => u.est_id === 1).length;
    const inactive = users.filter(u => u.est_id === 2).length;
    const total = users.length;
    return { active, inactive, total };
  };

  // Load users and roles
  useEffect(() => {
    loadData();
  }, []);

  // Filter displayed users when statusFilter changes
  useEffect(() => {
    filterUsers();
  }, [statusFilter, allUsuarios]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all users regardless of status
      const { data: usuariosData, error: usuariosError } = await supabase
        .from('usuario')
        .select(`
          *,
          user_roles:usuario_rol(rol_id)
        `)
        .order('usu_fecha_creacion', { ascending: false });
      
      if (usuariosError) throw usuariosError;

      // Load roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('rol')
        .select('*')
        .order('rol_nombre', { ascending: true });
      
      if (rolesError) throw rolesError;

      const allUsers = usuariosData || [];
      setAllUsuarios(allUsers);
      setRoles(rolesData || []);
      
      // Calculate and store counts
      const counts = calculateUserCounts(allUsers);
      setUserCounts(counts);
      
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Error al cargar los datos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...allUsuarios];
    
    // Apply status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(u => u.est_id === 1);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(u => u.est_id === 2);
    }
    
    setUsuarios(filtered);
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleViewUser = (user: UserWithRoles) => {
    setViewingUser(user);
    setShowDetails(true);
  };

  const handleEditUser = (user: UserWithRoles) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleDeleteUser = async (userId: number) => {
    const user = allUsuarios.find(u => u.usu_id === userId);
    if (!user) return;
    
    setUserToDeactivate(user);
    setShowDeactivationDialog(true);
  };

  const confirmDeactivateUser = async () => {
    if (!userToDeactivate) return;

    try {
      // Get user roles before updating
      const userRoleIds = userToDeactivate.user_roles?.map(ur => ur.rol_id) || [];

      // Update usuario status
      const { error } = await supabase
        .from('usuario')
        .update({ 
          est_id: 2,
          usu_fecha_modificacion: new Date().toISOString()
        })
        .eq('usu_id', userToDeactivate.usu_id);

      if (error) throw error;

      // Handle coach-specific updates
      await updateCoachStatus(userToDeactivate.usu_id, 2, userRoleIds);

      toast({
        title: "Éxito",
        description: "Usuario desactivado correctamente"
      });
      
      // Reload data to update counts and lists
      await loadData();
    } catch (error) {
      console.error("Error deactivating user:", error);
      toast({
        title: "Error",
        description: "Error al desactivar el usuario",
        variant: "destructive"
      });
    } finally {
      setShowDeactivationDialog(false);
      setUserToDeactivate(null);
    }
  };

  const handleDeactivationDialogClose = () => {
    setShowDeactivationDialog(false);
    setUserToDeactivate(null);
  };

  const handleReactivateUser = async (userId: number) => {
    if (!confirm("¿Estás seguro de que quieres reactivar este usuario?")) {
      return;
    }

    try {
      // Get user roles before updating
      const user = allUsuarios.find(u => u.usu_id === userId);
      const userRoleIds = user?.user_roles?.map(ur => ur.rol_id) || [];

      // Update usuario status
      const { error } = await supabase
        .from('usuario')
        .update({ 
          est_id: 1,
          usu_fecha_modificacion: new Date().toISOString()
        })
        .eq('usu_id', userId);

      if (error) throw error;

      // Handle coach-specific updates
      await updateCoachStatus(userId, 1, userRoleIds);

      toast({
        title: "Éxito",
        description: "Usuario reactivado correctamente"
      });
      
      // Reload data to update counts and lists
      await loadData();
    } catch (error) {
      console.error("Error reactivating user:", error);
      toast({
        title: "Error",
        description: "Error al reactivar el usuario",
        variant: "destructive"
      });
    }
  };

  const handlePermanentDelete = async (userId: number) => {
    if (!confirm("¿Estás seguro de que quieres eliminar permanentemente este usuario? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      // First, try to delete associated user_role records
      const { error: roleError } = await supabase
        .from('usuario_rol')
        .delete()
        .eq('usu_id', userId);

      if (roleError) {
        console.error("Error deleting user roles:", roleError);
        toast({
          title: "Error",
          description: "No se puede eliminar el usuario: Error al eliminar los roles asociados",
          variant: "destructive"
        });
        return;
      }

      // Then delete the user
      const { error } = await supabase
        .from('usuario')
        .delete()
        .eq('usu_id', userId);

      if (error) {
        // Check for specific constraint violations
        if (error.code === '23503') {
          const constraintMatch = error.message.match(/violates foreign key constraint "([^"]+)"/);
          const tableName = error.message.match(/table "([^"]+)"/);
          
          let detailedMessage = "No se puede eliminar el usuario porque tiene datos relacionados";
          
          if (constraintMatch && tableName) {
            const constraint = constraintMatch[1];
            const table = tableName[1];
            
            // Provide user-friendly messages for known constraints
            const constraintMessages: Record<string, string> = {
              'padre_usu_id_fkey': 'porque está registrado como padre de familia',
              'entrenador_ent_id_fkey': 'porque está registrado como entrenador',
              'colegio_coordinador_usu_id_fkey': 'porque es coordinador de un colegio',
              'encuesta_encu_creador_fkey': 'porque ha creado encuestas',
              'evaluacion_eva_creador_fkey': 'porque ha creado evaluaciones',
              'asistencia_entrenador_usu_registrador_fkey': 'porque ha registrado asistencias de entrenadores',
              'asistencia_nino_usu_registrador_fkey': 'porque ha registrado asistencias de niños',
              'evaluacion_nino_pendiente_usu_id_registrador_fkey': 'porque ha registrado evaluaciones'
            };
            
            detailedMessage = constraintMessages[constraint] || 
              `porque tiene registros relacionados en ${table}`;
          }
          
          toast({
            title: "No se puede eliminar",
            description: `${detailedMessage}. Primero debe desactivar o transferir estos registros.`,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error",
            description: `Error al eliminar permanentemente el usuario: ${error.message}`,
            variant: "destructive"
          });
        }
        return;
      }

      toast({
        title: "Éxito",
        description: "Usuario eliminado permanentemente"
      });
      
      // Reload data to update counts and lists
      await loadData();
    } catch (error) {
      console.error("Error permanently deleting user:", error);
      toast({
        title: "Error",
        description: "Error inesperado al eliminar permanentemente el usuario",
        variant: "destructive"
      });
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingUser(null);
    loadData();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  const handleDetailsClose = () => {
    setShowDetails(false);
    setViewingUser(null);
  };

  const handleRoleSelect = (roleId: number) => {
    setSelectedRoles([roleId]);
    setViewMode('table');
  };

  const handleRoleToggle = (roleId: number) => {
    if (selectedRoles.includes(roleId)) {
      setSelectedRoles(selectedRoles.filter(id => id !== roleId));
    } else {
      setSelectedRoles([...selectedRoles, roleId]);
    }
    setViewMode('table');
  };

  const handleViewAll = () => {
    setSelectedRoles([]);
    setViewMode('table');
  };

  const handleBackToCards = () => {
    setViewMode('cards');
    setSelectedRoles([]);
  };

  // Filter users based on search term and selected roles
  const filteredUsuarios = usuarios.filter(user => {
    const matchesSearch = user.usu_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.usu_correo.toLowerCase().includes(searchTerm.toLowerCase());
    
    const userRoleIds = user.user_roles?.map(ur => ur.rol_id) || [];
    const matchesRole = selectedRoles.length === 0 || 
                       selectedRoles.some(roleId => userRoleIds.includes(roleId));
    
    return matchesSearch && matchesRole;
  });

  // Sorting for filtered users
  const { sortedData: sortedUsuarios, sortKey, sortDirection, handleSort } = useSorting({
    data: filteredUsuarios,
    defaultSortKey: 'usu_fecha_creacion',
    defaultSortDirection: 'desc'
  });

  // Pagination for sorted users
  const { 
    currentPage, 
    totalPages, 
    paginatedData: paginatedUsuarios, 
    goToPage, 
    canGoNext, 
    canGoPrevious, 
    startIndex, 
    endIndex, 
    totalItems 
  } = usePagination({
    data: sortedUsuarios,
    itemsPerPage: 5
  });

  const getSelectedRoleNames = () => {
    if (selectedRoles.length === 0) return "Todos los usuarios";
    return roles
      .filter(role => selectedRoles.includes(role.rol_id))
      .map(role => role.rol_nombre)
      .join(", ");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Cargando usuarios...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6 min-w-0 max-w-full overflow-hidden">
      <UsuariosHeader
        viewMode={viewMode}
        onCreateUser={handleCreateUser}
        onBackToCards={handleBackToCards}
      />

      <UserStatusFilters
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        userCounts={userCounts}
      />

      <UsuariosFilters
        viewMode={viewMode}
        roles={roles}
        users={usuarios}
        selectedRoles={selectedRoles}
        filteredUsuarios={filteredUsuarios}
        onRoleToggle={handleRoleToggle}
        onViewAll={handleViewAll}
        getSelectedRoleNames={getSelectedRoleNames}
      />
      
      {/* Only show search in table view */}
      {viewMode === 'table' && (
        <UsuariosSearch
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      )}

      <UsuariosContent
        viewMode={viewMode}
        roles={roles}
        usuarios={usuarios}
        paginatedUsuarios={paginatedUsuarios}
        selectedRoles={selectedRoles}
        sortKey={sortKey}
        sortDirection={sortDirection}
        currentPage={currentPage}
        totalPages={totalPages}
        canGoNext={canGoNext}
        canGoPrevious={canGoPrevious}
        startIndex={startIndex}
        endIndex={endIndex}
        totalItems={totalItems}
        statusFilter={statusFilter}
        onRoleSelect={handleRoleSelect}
        onView={handleViewUser}
        onEdit={handleEditUser}
        onDelete={handleDeleteUser}
        onReactivate={handleReactivateUser}
        onPermanentDelete={handlePermanentDelete}
        onSort={handleSort}
        onPageChange={goToPage}
      />

      {/* User Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editingUser ? "Editar Usuario" : "Crear Nuevo Usuario"}
            </DialogTitle>
          </DialogHeader>

          <UserForm 
            user={editingUser} 
            roles={roles} 
            onSuccess={handleFormSuccess} 
            onCancel={handleFormCancel} 
          />
        </DialogContent>
      </Dialog>

      {/* User Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-md md:max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Detalles del Usuario</DialogTitle>
          </DialogHeader>

          {viewingUser && (
            <UserDetail 
              user={viewingUser} 
              roles={roles} 
              onClose={handleDetailsClose} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* User Deactivation Confirmation Dialog */}
      <UserDeactivationDialog
        isOpen={showDeactivationDialog}
        onClose={handleDeactivationDialogClose}
        onConfirm={confirmDeactivateUser}
        userName={userToDeactivate?.usu_nombre || ''}
      />
    </div>
  );
};

export default Usuarios;
