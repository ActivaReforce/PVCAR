import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import SortableTableHeader from '@/components/ui/sortable-table-header';
import { SortDirection } from '@/hooks/useSorting';
interface Actividad {
  act_id: number;
  act_nombre: string;
  cat_id?: number;
  categoria?: {
    cat_nombre: string;
  };
  act_descripcion?: string;
  act_tipo_espacio?: string;
  act_espacio_trabajo?: string;
  act_espacio_secundario?: string;
  act_indumentaria_tipo?: string;
  act_materiales_alumno?: string[];
  act_fecha_creacion?: string;
  act_fecha_modificacion?: string;
}
interface ActivityTableProps {
  activities: Actividad[];
  onView: (actividad: Actividad) => void;
  onEdit: (actividad: Actividad) => void;
  onDelete: (actividad: Actividad) => void;
  sortKey?: keyof Actividad | string | null;
  sortDirection?: SortDirection;
  onSort?: (key: keyof Actividad | string) => void;
}
const ActivityTable: React.FC<ActivityTableProps> = ({
  activities = [],
  onView,
  onEdit,
  onDelete,
  sortKey,
  sortDirection,
  onSort
}) => {
  return <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHeader sortKey="act_nombre" currentSortKey={sortKey as string} sortDirection={sortDirection} onSort={onSort}>
              Nombre
            </SortableTableHeader>
            <SortableTableHeader sortKey="categoria" currentSortKey={sortKey as string} sortDirection={sortDirection} onSort={onSort}>
              Categoría
            </SortableTableHeader>
            <SortableTableHeader sortKey="act_espacio_trabajo" currentSortKey={sortKey as string} sortDirection={sortDirection} onSort={onSort}>
              Espacio
            </SortableTableHeader>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.length === 0 ? <TableRow>
              <TableCell colSpan={4} className="text-center py-8">
                No hay actividades registradas
              </TableCell>
            </TableRow> : activities.map(actividad => <TableRow key={actividad.act_id}>
                <TableCell className="font-medium">
                  {actividad.act_nombre}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
                    {actividad.categoria?.cat_nombre || 'No especificada'}
                  </span>
                </TableCell>
                <TableCell>
                  {actividad.act_espacio_trabajo || 'No especificado'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => onView(actividad)} className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(actividad)} className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-900 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente
                            la actividad "{actividad.act_nombre}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(actividad)} className="bg-[#FD5757] text-white hover:bg-[#E04747]">
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>)}
        </TableBody>
      </Table>
    </div>;
};
export default ActivityTable;