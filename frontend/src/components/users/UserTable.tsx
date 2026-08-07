
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, UserX, RotateCcw, Trash2 } from "lucide-react";
import { SortDirection } from "@/hooks/useSorting";
import { ConditionalAction } from "@/components/ui/conditional-actions";
import { useIsMobile } from "@/hooks/use-mobile";
import UserActionMenu from "./UserActionMenu";
import type { UsuarioListado } from "@/api/usuarios";

/**
 * La fila ya viene con sus roles desde el API y con la URL firmada de la foto.
 * Antes habia que cruzar user_roles con el catalogo de roles en el navegador.
 */
interface UserTableProps {
  users: UsuarioListado[];
  onView: (user: UsuarioListado) => void;
  onEdit: (user: UsuarioListado) => void;
  onDelete: (userId: number) => void;
  onReactivate: (userId: number) => void;
  onPermanentDelete: (userId: number) => void;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
}

const UserTable = ({
  users,
  onView,
  onEdit,
  onDelete,
  onReactivate,
  onPermanentDelete,
  sortKey,
  sortDirection,
  onSort,
}: UserTableProps) => {
  const isMobile = useIsMobile();
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserRoles = (user: UsuarioListado) => user.roles;

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No hay usuarios que mostrar</p>
        <p className="text-sm mt-2">Ajusta los filtros para ver más resultados</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="border rounded-lg overflow-hidden min-w-0 max-w-full">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-2/3 min-w-0">Usuario</TableHead>
              <TableHead className="w-1/3 min-w-0">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const userRoles = getUserRoles(user);
              
              return (
                <TableRow key={user.usu_id}>
                  <TableCell className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={user.usu_foto_url || undefined} />
                        <AvatarFallback>
                          {getInitials(user.usu_nombre)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate text-sm">{user.usu_nombre}</div>
                        <div className="text-xs text-muted-foreground truncate">{user.usu_correo}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <UserActionMenu
                      user={user}
                      onView={onView}
                      onEdit={onEdit}
                      onDelete={(user) => onDelete(user.usu_id)}
                      onReactivate={(user) => onReactivate(user.usu_id)}
                      onPermanentDelete={(user) => onPermanentDelete(user.usu_id)}
                      canEdit={true}
                      canDelete={true}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Usuario</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-[150px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const userRoles = getUserRoles(user);
            
            return (
              <TableRow key={user.usu_id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.usu_foto_url || undefined} />
                      <AvatarFallback>
                        {getInitials(user.usu_nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{user.usu_nombre}</div>
                      <div className="text-sm text-muted-foreground">{user.usu_correo}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {userRoles.map((role) => (
                      <Badge key={role.rol_id} variant="outline" className="text-xs">
                        {role.rol_titulo}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.est_id === 1 ? "default" : "secondary"}>
                    {user.est_id === 1 ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(user)}
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    <ConditionalAction module="usuarios" action="editar">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(user)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </ConditionalAction>

                    {user.est_id === 1 ? (
                      <ConditionalAction module="usuarios" action="eliminar">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(user.usu_id)}
                          title="Desactivar"
                          className="text-destructive hover:text-destructive"
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      </ConditionalAction>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onReactivate(user.usu_id)}
                          title="Reactivar"
                          className="text-green-600 hover:text-green-700"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <ConditionalAction module="usuarios" action="eliminar">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPermanentDelete(user.usu_id)}
                            title="Eliminar permanentemente"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </ConditionalAction>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default UserTable;
