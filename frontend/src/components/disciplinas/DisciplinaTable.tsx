
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import SortableTableHeader from "@/components/ui/sortable-table-header";
import { SortDirection } from "@/hooks/useSorting";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";

interface DisciplinaWithDetails {
  colacthor_id: number;
  colegio: { col_nombre: string } | null;
  actividad: { act_nombre: string } | null;
  dia: { dia_nombre: string } | null;
  colacthor_hora_inicio: string | null;
  colacthor_hora_fin: string | null;
  colacthor_fecha_creacion: string;
  col_id: number | null;
  act_id: number | null;
  dia_id: number | null;
  est_id: number | null;
  trainer?: {
    usu_nombre: string;
    usu_id: number;
  } | null;
}

interface DisciplinaTableProps {
  disciplinas: DisciplinaWithDetails[];
  isLoading: boolean;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
  onEdit?: (disciplina: DisciplinaWithDetails) => void;
  onDelete?: (disciplina: DisciplinaWithDetails) => void;
}

const DisciplinaTable = ({ 
  disciplinas, 
  isLoading,
  sortKey,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
}: DisciplinaTableProps) => {
  const formatTime = (time: string | null) => {
    if (!time) return "—";
    return time.substring(0, 5);
  };

  const formatHorario = (inicio: string | null, fin: string | null) => {
    const inicioFormatted = formatTime(inicio);
    const finFormatted = formatTime(fin);
    
    if (inicioFormatted === "—" && finFormatted === "—") return "—";
    if (inicioFormatted === "—") return `- ${finFormatted}`;
    if (finFormatted === "—") return `${inicioFormatted} -`;
    
    return `${inicioFormatted} - ${finFormatted}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colegio</TableHead>
                <TableHead>Actividad</TableHead>
                <TableHead>Día</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Entrenador</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHeader
                sortKey="colegio.col_nombre"
                currentSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={(key) => onSort?.(key)}
              >
                Colegio
              </SortableTableHeader>
              <SortableTableHeader
                sortKey="actividad.act_nombre"
                currentSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={(key) => onSort?.(key)}
              >
                Actividad
              </SortableTableHeader>
              <SortableTableHeader
                sortKey="dia.dia_nombre"
                currentSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={(key) => onSort?.(key)}
              >
                Día
              </SortableTableHeader>
              <SortableTableHeader
                sortKey="colacthor_hora_inicio"
                currentSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={(key) => onSort?.(key)}
              >
                Horario
              </SortableTableHeader>
              <TableHead>Entrenador</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {disciplinas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No se encontraron disciplinas
                </TableCell>
              </TableRow>
            ) : (
              disciplinas.map((disciplina) => (
                <TableRow key={disciplina.colacthor_id}>
                  <TableCell className="font-medium">
                    {disciplina.colegio?.col_nombre || "—"}
                  </TableCell>
                  <TableCell>
                    {disciplina.actividad?.act_nombre || "—"}
                  </TableCell>
                  <TableCell>
                    {disciplina.dia?.dia_nombre || "—"}
                  </TableCell>
                  <TableCell>
                    {formatHorario(disciplina.colacthor_hora_inicio, disciplina.colacthor_hora_fin)}
                  </TableCell>
                  <TableCell>
                    {disciplina.trainer ? disciplina.trainer.usu_nombre : "Sin asignar"}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {onEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(disciplina)}
                          title="Editar disciplina"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDelete(disciplina)}
                          title="Eliminar disciplina"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default DisciplinaTable;
