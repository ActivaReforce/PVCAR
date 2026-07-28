
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Trash2 } from "lucide-react";
import SortableTableHeader from "@/components/ui/sortable-table-header";
import { SortDirection } from "@/hooks/useSorting";

interface Colegio {
  col_id: number;
  col_nombre: string;
  col_direccion: string;
  col_rep_nombre?: string | null;
  col_rep_foto?: string | null;
  col_rep_telefono?: string | null;
  col_rep_email?: string | null;
  coordinators?: Array<{
    usu_id: number;
    usu_nombre: string;
  }>;
}

interface SchoolTableProps {
  schools: Colegio[];
  onView: (school: Colegio) => void;
  onEdit: (school: Colegio) => void;
  onDelete: (school: Colegio) => void;
  sortKey?: keyof Colegio | string | null;
  sortDirection?: SortDirection;
  onSort?: (key: keyof Colegio | string) => void;
}

const SchoolTable = ({
  schools,
  onView,
  onEdit,
  onDelete,
  sortKey,
  sortDirection,
  onSort,
}: SchoolTableProps) => {
  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHeader
              sortKey="col_nombre"
              currentSortKey={sortKey as string}
              sortDirection={sortDirection}
              onSort={onSort}
            >
              Nombre
            </SortableTableHeader>
            <SortableTableHeader
              sortKey="col_direccion"
              currentSortKey={sortKey as string}
              sortDirection={sortDirection}
              onSort={onSort}
            >
              Dirección
            </SortableTableHeader>
            <SortableTableHeader
              sortKey="col_rep_nombre"
              currentSortKey={sortKey as string}
              sortDirection={sortDirection}
              onSort={onSort}
            >
              Contacto/Autoridad
            </SortableTableHeader>
            <TableHead>Coordinadores AR</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schools.map((colegio) => (
            <TableRow key={colegio.col_id}>
              <TableCell className="font-medium">{colegio.col_nombre}</TableCell>
              <TableCell>{colegio.col_direccion}</TableCell>
              <TableCell>{colegio.col_rep_nombre || "—"}</TableCell>
              <TableCell>
                {colegio.coordinators && colegio.coordinators.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {colegio.coordinators.map((coordinator) => (
                      <Badge 
                        key={coordinator.usu_id} 
                        variant="secondary" 
                        className="text-xs"
                      >
                        {coordinator.usu_nombre}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onView(colegio)}
                    aria-label="Ver detalles"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onEdit(colegio)}
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-destructive focus:ring-destructive"
                    onClick={() => onDelete(colegio)}
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default SchoolTable;
