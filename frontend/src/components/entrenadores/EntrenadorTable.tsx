import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import SortableTableHeader from "@/components/ui/sortable-table-header";
import { Eye, Link, UserPlus } from "lucide-react";
import { EntrenadorWithDetails } from "./EntrenadorTypes";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConditionalAction } from "@/components/ui/conditional-actions";
import { useIsMobile } from "@/hooks/use-mobile";
import EntrenadorActionMenu from "./EntrenadorActionMenu";

interface EntrenadorTableProps {
  entrenadores: EntrenadorWithDetails[];
  onView: (entrenador: EntrenadorWithDetails) => void;
  onAtar: (entrenador: EntrenadorWithDetails) => void;
  onAgregarAuxiliar?: (entrenador: EntrenadorWithDetails) => void;
  sortKey: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (key: string) => void;
}

const EntrenadorTable = ({
  entrenadores,
  onView,
  onAtar,
  onAgregarAuxiliar,
  sortKey,
  sortDirection,
  onSort
}: EntrenadorTableProps) => {
  const isMobile = useIsMobile();
  
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString();
  };

  if (entrenadores.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">No se encontraron entrenadores</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className={isMobile ? "w-full" : "overflow-x-auto"}>
          <Table className={isMobile ? "table-fixed w-full" : ""}>
            <TableHeader>
              <TableRow>
                <TableHead className={isMobile ? "w-[70%]" : "w-[280px]"}>Entrenador</TableHead>
                {!isMobile && (
                  <>
                    <SortableTableHeader
                      sortKey="colegios_count"
                      currentSortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={onSort}
                      className="w-[200px]"
                    >
                      Colegios
                    </SortableTableHeader>
                    <SortableTableHeader
                      sortKey="disciplinas_count"
                      currentSortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={onSort}
                      className="w-[120px]"
                    >
                      Disciplinas
                    </SortableTableHeader>
                    <SortableTableHeader
                      sortKey="auxiliares_count"
                      currentSortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={onSort}
                      className="w-[120px]"
                    >
                      Auxiliares
                    </SortableTableHeader>
                  </>
                )}
                <TableHead className={isMobile ? "w-[30%]" : "w-[200px]"}>Acciones</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {entrenadores.map((entrenador) => (
              <TableRow key={entrenador.ent_id}>
                <TableCell className={isMobile ? "w-[70%]" : ""}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={entrenador.usuario.usu_foto || undefined} />
                      <AvatarFallback className="text-sm">
                        {getInitials(entrenador.usuario.usu_nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{entrenador.usuario.usu_nombre}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {entrenador.usuario.usu_correo}
                      </div>
                      {isMobile && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {entrenador.colegios.length > 0 ? (
                            entrenador.colegios.slice(0, 2).map((colegio, index) => (
                              <Badge key={index} variant="outline" className="text-xs truncate max-w-[120px]">
                                {colegio}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Sin asignar
                            </Badge>
                          )}
                          {entrenador.colegios.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{entrenador.colegios.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                {!isMobile && (
                  <>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {entrenador.colegios.length > 0 ? (
                          entrenador.colegios.map((colegio, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {colegio}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">Sin asignar</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {entrenador.disciplinas_count}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {entrenador.auxiliares_count || 0}
                      </Badge>
                    </TableCell>
                  </>
                )}
                <TableCell className={isMobile ? "w-[30%]" : ""}>
                  {isMobile ? (
                    <EntrenadorActionMenu
                      entrenador={entrenador}
                      onView={onView}
                      onAtar={onAtar}
                      onAgregarAuxiliar={onAgregarAuxiliar || (() => {})}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onView(entrenador)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Ver detalles</p>
                        </TooltipContent>
                      </Tooltip>

                      <ConditionalAction module="entrenadores" action="editar">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onAtar(entrenador)}
                            >
                              <Link className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Asignar disciplinas</p>
                          </TooltipContent>
                        </Tooltip>
                      </ConditionalAction>

                      {onAgregarAuxiliar && (
                        <ConditionalAction module="entrenadores" action="editar">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onAgregarAuxiliar(entrenador)}
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Agrega un Asistente o Respaldo a este entrenador</p>
                            </TooltipContent>
                          </Tooltip>
                        </ConditionalAction>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default EntrenadorTable;
