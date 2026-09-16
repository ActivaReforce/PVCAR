import { ArrowDown, ArrowUp, ArrowUpDown, Edit, Eye, RotateCcw, Trash2, UserX } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import type { UsuarioListado } from '@/api/usuarios';

/**
 * Lista de usuarios.
 *
 * Un solo markup para movil y escritorio.
 *
 * Antes eran dos ramas (`if (isMobile) return ...`) y la de movil se habia
 * quedado atras: no mostraba ni los roles ni el estado, no se podia ordenar, y
 * — lo serio — pasaba canEdit/canDelete en `true` fijo, asi que en el telefono
 * aparecian acciones que el servidor iba a rechazar con un 403. Es la misma
 * trampa que ya costo una tanda de arreglos en esta fase: dos copias del mismo
 * markup divergen siempre.
 *
 * Ahora la fila es una rejilla: en pantalla ancha son columnas, en el telefono
 * se apila como tarjeta. Las acciones son botones visibles (no un menu
 * escondido) con area tactil de 44 px, y las tres que escriben pasan por
 * ConditionalAction en los dos tamanos.
 */

interface UserTableProps {
  users: UsuarioListado[];
  onView: (user: UsuarioListado) => void;
  onEdit: (user: UsuarioListado) => void;
  onDelete: (userId: number) => void;
  onReactivate: (userId: number) => void;
  onPermanentDelete: (userId: number) => void;
  sortKey?: string | null;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: (key: string) => void;
}

/** Misma rejilla en la cabecera y en cada fila: si cambia, cambia en un sitio. */
const REJILLA =
  'grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_7rem_7rem_11rem] md:items-center md:gap-4';

const COLUMNAS_ORDENABLES = [
  { clave: 'nombre', etiqueta: 'Usuario' },
  { clave: 'estado', etiqueta: 'Estado' },
  { clave: 'creacion', etiqueta: 'Creado' },
] as const;

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const Cabecera = ({
  clave,
  children,
  sortKey,
  sortDirection,
  onSort,
  className,
}: {
  clave: string;
  children: React.ReactNode;
  sortKey?: string | null;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: (key: string) => void;
  className?: string;
}) => {
  const activa = sortKey === clave;
  const Icono = !activa ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown;

  if (!onSort) {
    return <div className={className}>{children}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onSort(clave)}
      className={`flex items-center gap-1 text-left font-medium hover:text-foreground ${
        activa ? 'text-foreground' : ''
      } ${className ?? ''}`}
      aria-label={`Ordenar por ${String(children)}`}
    >
      {children}
      <Icono className="h-3.5 w-3.5 flex-shrink-0" />
    </button>
  );
};

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
  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No hay usuarios que mostrar</p>
        <p className="text-sm mt-2">Ajusta los filtros para ver más resultados</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 min-w-0">
      {/* Ordenar en el telefono: las cabeceras de columna no existen ahi, y
          sin esto la lista solo se podia ordenar desde el escritorio. */}
      {onSort && (
        <div className="flex items-center gap-2 md:hidden">
          <Select value={sortKey ?? 'nombre'} onValueChange={(valor) => onSort(valor)}>
            <SelectTrigger className="h-11 flex-1 min-w-0">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              {COLUMNAS_ORDENABLES.map(({ clave, etiqueta }) => (
                <SelectItem key={clave} value={clave}>
                  Ordenar por {etiqueta.toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 flex-shrink-0"
            onClick={() => onSort(sortKey ?? 'nombre')}
            aria-label={sortDirection === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
            title={sortDirection === 'asc' ? 'Ascendente' : 'Descendente'}
          >
            {sortDirection === 'asc' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        {/* Cabecera: solo desde md. En el telefono cada fila se lee sola. */}
        <div
          className={`${REJILLA} hidden md:grid bg-muted/50 px-4 py-2 text-sm text-muted-foreground`}
        >
          <Cabecera
            clave="nombre"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={onSort}
          >
            Usuario
          </Cabecera>
          <div className="font-medium">Roles</div>
          <Cabecera
            clave="estado"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={onSort}
          >
            Estado
          </Cabecera>
          <Cabecera
            clave="creacion"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={onSort}
          >
            Creado
          </Cabecera>
          <div className="font-medium">Acciones</div>
        </div>

        <ul className="divide-y">
          {users.map((user) => {
            const activo = user.est_id === 1;
            return (
              <li key={user.usu_id} className={`${REJILLA} px-4 py-3`}>
                {/* Identidad */}
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={user.usu_foto_url ?? undefined} alt="" />
                    <AvatarFallback>{iniciales(user.usu_nombre)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium truncate" title={user.usu_nombre}>
                      {user.usu_nombre}
                    </div>
                    <div
                      className="text-sm text-muted-foreground truncate"
                      title={user.usu_correo}
                    >
                      {user.usu_correo}
                    </div>
                  </div>
                </div>

                {/* Roles */}
                <div className="flex flex-wrap gap-1 min-w-0">
                  {user.roles.length > 0 ? (
                    user.roles.map((rol) => (
                      <Badge key={rol.rol_id} variant="outline" className="text-xs max-w-full">
                        <span className="truncate">{rol.rol_titulo}</span>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin rol</span>
                  )}
                </div>

                {/* Estado y fecha: en el telefono van juntos en una linea. */}
                <div className="md:contents">
                  <div className="flex items-center gap-3 md:block">
                    <Badge variant={activo ? 'default' : 'secondary'}>
                      {activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <span className="text-sm text-muted-foreground md:hidden">
                      Creado {user.usu_fecha_creacion
                        ? new Date(user.usu_fecha_creacion).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                  <div className="hidden md:block text-sm text-muted-foreground">
                    {user.usu_fecha_creacion
                      ? new Date(user.usu_fecha_creacion).toLocaleDateString()
                      : '—'}
                  </div>
                </div>

                {/* Acciones: las mismas y con los mismos permisos en los dos
                    tamanos. 44 px de alto en el telefono, compactas en md. */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 md:h-9 md:w-9"
                    onClick={() => onView(user)}
                    title="Ver detalles"
                    aria-label={`Ver detalles de ${user.usu_nombre}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>

                  <ConditionalAction module="usuarios" action="editar">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 md:h-9 md:w-9"
                      onClick={() => onEdit(user)}
                      title="Editar"
                      aria-label={`Editar ${user.usu_nombre}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </ConditionalAction>

                  {activo ? (
                    <ConditionalAction module="usuarios" action="eliminar">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 md:h-9 md:w-9 text-destructive hover:text-destructive"
                        onClick={() => onDelete(user.usu_id)}
                        title="Dar de baja"
                        aria-label={`Dar de baja a ${user.usu_nombre}`}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    </ConditionalAction>
                  ) : (
                    <>
                      {/* Reactivar escribe: exige el mismo permiso que editar,
                          que es lo que pide el backend. Antes no lo pedia. */}
                      <ConditionalAction module="usuarios" action="editar">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 md:h-9 md:w-9 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                          onClick={() => onReactivate(user.usu_id)}
                          title="Reactivar"
                          aria-label={`Reactivar a ${user.usu_nombre}`}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </ConditionalAction>
                      <ConditionalAction module="usuarios" action="eliminar">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 md:h-9 md:w-9 text-destructive hover:text-destructive"
                          onClick={() => onPermanentDelete(user.usu_id)}
                          title="Eliminar permanentemente"
                          aria-label={`Eliminar permanentemente a ${user.usu_nombre}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </ConditionalAction>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default UserTable;
