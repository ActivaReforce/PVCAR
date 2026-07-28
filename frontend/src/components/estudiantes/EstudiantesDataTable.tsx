import React, { useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, Edit, Trash2, UserPlus, Link, MoreHorizontal, Search, Users, UserX, CheckCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DataPagination } from "@/components/ui/data-pagination";
import { ConditionalAction } from "@/components/ui/conditional-actions";
import { usePagination } from "@/hooks/usePagination";
import { Database } from "@/integrations/supabase/types";

type Nino = Database['public']['Tables']['nino']['Row'];

interface EstudianteWithDetails extends Nino {
  colegio: { col_nombre: string } | null;
  categoria_nino_grado?: { catninograd_nombre: string } | null;
  representantes: Array<{
    padre: {
      usuario: Database['public']['Tables']['usuario']['Row'];
    };
  }>;
  disciplinas_count?: number;
}

interface EstudiantesDataTableProps {
  estudiantes: EstudianteWithDetails[];
  loading: boolean;
  searchQuery: string;
  selectedDiscipline?: number | null;
  showUnassigned?: boolean;
  statusFilter: 'active' | 'inactive' | 'all';
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  startIndex?: number;
  endIndex?: number;
  canGoNext?: boolean;
  canGoPrevious?: boolean;
  onPageChange?: (page: number) => void;
  onEdit: (estudiante: EstudianteWithDetails) => void;
  onView: (estudiante: EstudianteWithDetails) => void;
  onDelete: (estudiante: EstudianteWithDetails) => void;
  onReactivate: (estudiante: EstudianteWithDetails) => void;
  onPermanentDelete: (estudiante: EstudianteWithDetails) => void;
  onAttach: (estudiante: EstudianteWithDetails) => void;
  onLinkDisciplines: (estudiante: EstudianteWithDetails) => void;
}

const EstudiantesDataTable = ({
  estudiantes,
  loading,
  searchQuery,
  selectedDiscipline,
  showUnassigned = false,
  statusFilter,
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  startIndex = 1,
  endIndex = 0,
  canGoNext = false,
  canGoPrevious = false,
  onPageChange,
  onEdit,
  onView,
  onDelete,
  onReactivate,
  onPermanentDelete,
  onAttach,
  onLinkDisciplines
}: EstudiantesDataTableProps) => {
  const filteredEstudiantes = useMemo(() => {
    let filtered = estudiantes;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(estudiante =>
        estudiante.nino_nombre.toLowerCase().includes(query) ||
        estudiante.colegio?.col_nombre.toLowerCase().includes(query) ||
        estudiante.categoria_nino_grado?.catninograd_nombre.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [estudiantes, searchQuery]);

  const isStudentActive = (estudiante: EstudianteWithDetails) => estudiante.est_id === 1;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Use the data directly since pagination is handled server-side
  const paginatedData = filteredEstudiantes;

  if (loading) {
    return (
      <div className="border rounded-lg">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Cargando estudiantes...</p>
        </div>
      </div>
    );
  }

  if (filteredEstudiantes.length === 0) {
    return (
      <div className="border rounded-lg">
        <div className="text-center py-12 text-muted-foreground">
          {showUnassigned ? (
            <>
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No hay estudiantes sin disciplinas asignadas</p>
            </>
          ) : selectedDiscipline ? (
            <>
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No existen estudiantes asignados a esta disciplina</p>
            </>
          ) : searchQuery ? (
            <>
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No se encontraron estudiantes</p>
              <p className="text-sm mt-2">Intenta con otros términos de búsqueda</p>
            </>
          ) : (
            <>
              <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No hay estudiantes registrados</p>
              <p className="text-sm mt-2">Comience agregando un nuevo estudiante</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="border rounded-lg overflow-visible">
          <div className="w-full sm:overflow-x-auto">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[calc(100%-60px)] sm:w-[30%]">Alumno</TableHead>
                  <TableHead className="hidden sm:table-cell w-[10%]">Edad</TableHead>
                  <TableHead className="hidden sm:table-cell w-[35%]">Colegio</TableHead>
                  <TableHead className="hidden sm:table-cell w-[10%]">Disciplinas</TableHead>
                  <TableHead className="w-[60px] sm:w-[15%]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {paginatedData.map((estudiante) => {
                const isActive = isStudentActive(estudiante);
                return (
                 <TableRow key={estudiante.nino_id} className={`hover:bg-muted/50 ${!isActive ? "opacity-60" : ""}`}>
                   <TableCell className="min-w-0 pr-2">
                     <div className="flex items-center gap-3 min-w-0">
                       <Avatar className="h-8 w-8 flex-shrink-0">
                         <AvatarImage src={estudiante.nino_foto || undefined} />
                         <AvatarFallback className="text-xs">
                           {getInitials(estudiante.nino_nombre)}
                         </AvatarFallback>
                       </Avatar>
                       <div className="min-w-0 flex-1">
                         <div className="font-medium truncate text-sm sm:text-base">{estudiante.nino_nombre}</div>
                         <div className="text-xs sm:text-sm text-muted-foreground truncate sm:hidden">
                           <span className="truncate">{estudiante.categoria_nino_grado?.catninograd_nombre || 'Sin grado'}</span> • <span>{estudiante.disciplinas_count || 0} disc.</span>
                         </div>
                       </div>
                     </div>
                   </TableCell>
                   <TableCell className="hidden sm:table-cell">
                     <Badge variant="secondary" className="text-xs">
                       {estudiante.nino_edad || 'N/A'} años
                     </Badge>
                   </TableCell>
                   <TableCell className="hidden sm:table-cell">
                     <div className="truncate">
                       {estudiante.colegio?.col_nombre || 'Sin colegio'}
                     </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {estudiante.disciplinas_count || 0}
                      </Badge>
                    </TableCell>
                   <TableCell>
                     {/* Mobile Actions */}
                     <Sheet>
                       <SheetTrigger asChild>
                         <Button
                           size="icon"
                           variant="ghost"
                           className="p-1 sm:hidden"
                           aria-label="Más acciones"
                         >
                           <MoreHorizontal className="h-4 w-4" />
                         </Button>
                       </SheetTrigger>

                       <SheetContent side="bottom" className="p-4 space-y-2 sm:hidden">
                         <div className="text-lg font-semibold mb-4">
                           Acciones para {estudiante.nino_nombre}
                         </div>
                         
                         <Button 
                           variant="outline" 
                           className="w-full justify-start" 
                           onClick={() => onView(estudiante)}
                         >
                           <Eye className="h-4 w-4 mr-2" />
                           Ver detalles
                         </Button>
                         
                         {isActive ? (
                           <>
                             <ConditionalAction module="estudiantes" action="editar">
                               <Button 
                                 variant="outline" 
                                 className="w-full justify-start" 
                                 onClick={() => onEdit(estudiante)}
                               >
                                 <Edit className="h-4 w-4 mr-2" />
                                 Editar
                               </Button>
                             </ConditionalAction>
                             
                             <ConditionalAction module="estudiantes" action="editar">
                               <Button 
                                 variant="outline" 
                                 className="w-full justify-start" 
                                 onClick={() => onLinkDisciplines(estudiante)}
                               >
                                 <Link className="h-4 w-4 mr-2" />
                                 Asignar disciplinas
                               </Button>
                             </ConditionalAction>
                             
                             <ConditionalAction module="estudiantes" action="editar">
                               <Button 
                                 variant="outline" 
                                 className="w-full justify-start" 
                                 onClick={() => onAttach(estudiante)}
                               >
                                 <UserPlus className="h-4 w-4 mr-2" />
                                 Asignar representante
                               </Button>
                             </ConditionalAction>
                             
                              <ConditionalAction module="estudiantes" action="eliminar">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      className="w-full justify-start text-orange-600 hover:text-orange-700"
                                    >
                                      <UserX className="h-4 w-4 mr-2" />
                                      Desactivar
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Desactivar estudiante?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Se desactivará el estudiante "{estudiante.nino_nombre}" y todas sus disciplinas asignadas.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => onDelete(estudiante)}
                                        className="bg-orange-600 text-white hover:bg-orange-700"
                                      >
                                        Desactivar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </ConditionalAction>
                           </>
                         ) : (
                            <>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    className="w-full justify-start text-green-600 hover:text-green-700"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Activar
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Activar estudiante?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se activará el estudiante "{estudiante.nino_nombre}".
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => onReactivate(estudiante)}
                                      className="bg-green-600 text-white hover:bg-green-700"
                                    >
                                      Activar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="destructive" 
                                    className="w-full justify-start"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar permanentemente
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar permanentemente?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se eliminará permanentemente el estudiante "{estudiante.nino_nombre}". Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => onPermanentDelete(estudiante)}
                                      className="bg-red-600 text-white hover:bg-red-700"
                                    >
                                      Eliminar permanentemente
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                         )}
                        </SheetContent>
                      </Sheet>

                      {/* Desktop Actions */}
                      <div className="hidden sm:flex items-center gap-1">
                       <Tooltip>
                         <TooltipTrigger asChild>
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => onView(estudiante)}
                             className="h-8 w-8 p-0"
                           >
                             <Eye className="h-4 w-4" />
                           </Button>
                         </TooltipTrigger>
                         <TooltipContent>Ver detalles</TooltipContent>
                       </Tooltip>

                       {isActive ? (
                         <>
                           <ConditionalAction module="estudiantes" action="editar">
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => onLinkDisciplines(estudiante)}
                                   className="h-8 w-8 p-0"
                                 >
                                   <Link className="h-4 w-4" />
                                 </Button>
                               </TooltipTrigger>
                               <TooltipContent>Asignar disciplinas</TooltipContent>
                             </Tooltip>
                           </ConditionalAction>

                           <ConditionalAction module="estudiantes" action="editar">
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => onAttach(estudiante)}
                                   className="h-8 w-8 p-0"
                                 >
                                   <UserPlus className="h-4 w-4" />
                                 </Button>
                               </TooltipTrigger>
                               <TooltipContent>Asignar representante</TooltipContent>
                             </Tooltip>
                           </ConditionalAction>

                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                 <MoreHorizontal className="h-4 w-4" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end" className="w-[160px]">
                               <ConditionalAction module="estudiantes" action="editar">
                                 <DropdownMenuItem onClick={() => onEdit(estudiante)}>
                                   <Edit className="h-4 w-4 mr-2" />
                                   Editar
                                 </DropdownMenuItem>
                               </ConditionalAction>
                               <ConditionalAction module="estudiantes" action="eliminar">
                                 <AlertDialog>
                                   <AlertDialogTrigger asChild>
                                     <DropdownMenuItem 
                                       onSelect={(e) => e.preventDefault()}
                                       className="text-orange-600 focus:text-orange-600"
                                     >
                                       <UserX className="h-4 w-4 mr-2" />
                                       Desactivar
                                     </DropdownMenuItem>
                                   </AlertDialogTrigger>
                                   <AlertDialogContent>
                                     <AlertDialogHeader>
                                       <AlertDialogTitle>¿Desactivar estudiante?</AlertDialogTitle>
                                       <AlertDialogDescription>
                                         Se desactivará el estudiante "{estudiante.nino_nombre}" y todas sus disciplinas asignadas.
                                       </AlertDialogDescription>
                                     </AlertDialogHeader>
                                     <AlertDialogFooter>
                                       <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                       <AlertDialogAction 
                                         onClick={() => onDelete(estudiante)}
                                         className="bg-orange-600 text-white hover:bg-orange-700"
                                       >
                                         Desactivar
                                       </AlertDialogAction>
                                     </AlertDialogFooter>
                                   </AlertDialogContent>
                                 </AlertDialog>
                               </ConditionalAction>
                             </DropdownMenuContent>
                           </DropdownMenu>
                         </>
                       ) : (
                         <>
                           <AlertDialog>
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <AlertDialogTrigger asChild>
                                   <Button
                                     variant="outline"
                                     size="sm"
                                     className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                   >
                                     <CheckCircle className="h-4 w-4" />
                                   </Button>
                                 </AlertDialogTrigger>
                               </TooltipTrigger>
                               <TooltipContent>Activar</TooltipContent>
                             </Tooltip>
                             
                             <AlertDialogContent>
                               <AlertDialogHeader>
                                 <AlertDialogTitle>¿Activar estudiante?</AlertDialogTitle>
                                 <AlertDialogDescription>
                                   El estudiante "{estudiante.nino_nombre}" será activado.
                                 </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter>
                                 <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                 <AlertDialogAction 
                                   onClick={() => onReactivate(estudiante)}
                                   className="bg-green-600 text-white hover:bg-green-700"
                                 >
                                   Activar
                                 </AlertDialogAction>
                               </AlertDialogFooter>
                             </AlertDialogContent>
                           </AlertDialog>
                           
                           <AlertDialog>
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <AlertDialogTrigger asChild>
                                   <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                                     <Trash2 className="h-4 w-4" />
                                   </Button>
                                 </AlertDialogTrigger>
                               </TooltipTrigger>
                               <TooltipContent>Eliminar definitivamente</TooltipContent>
                             </Tooltip>
                             
                             <AlertDialogContent>
                               <AlertDialogHeader>
                                 <AlertDialogTitle>¿Eliminar permanentemente?</AlertDialogTitle>
                                 <AlertDialogDescription>
                                   Esta acción no se puede deshacer. Se eliminará permanentemente
                                   el estudiante "{estudiante.nino_nombre}" y todos sus datos asociados.
                                 </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter>
                                 <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                 <AlertDialogAction 
                                   onClick={() => onPermanentDelete(estudiante)}
                                   className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                 >
                                   Eliminar permanentemente
                                 </AlertDialogAction>
                               </AlertDialogFooter>
                             </AlertDialogContent>
                           </AlertDialog>
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
        </div>

        {onPageChange && (
          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            canGoNext={canGoNext}
            canGoPrevious={canGoPrevious}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={totalCount}
            itemName="alumnos"
          />
        )}
      </div>
    </TooltipProvider>
  );
};

export default EstudiantesDataTable;
