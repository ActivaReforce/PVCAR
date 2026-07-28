import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, Eye, Link, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDeleteEvaluationTemplate } from '@/hooks/useDeleteEvaluationTemplate';
import { supabase } from '@/integrations/supabase/client';
import { SortDirection } from '@/hooks/useSorting';
import SortableTableHeader from '@/components/ui/sortable-table-header';
import EvaluateStudentModal from './EvaluateStudentModal';
import EvaluationDetailsModal from './EvaluationDetailsModal';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import { DeleteEvaluationDialog } from './DeleteEvaluationDialog';

interface Evaluation {
  eva_id: number;
  eva_titulo: string;
  eva_descripcion: string | null;
  eva_categoria: string | null;
  eva_fecha_creacion: string;
  eva_puntaje_total: number | null;
  est_id: number;
  eva_creador: number;
  estado?: {
    est_nombre: string;
  };
  usuario?: {
    usu_nombre: string;
  };
}

interface EvaluationsTableProps {
  evaluations: Evaluation[];
  onEdit: (evaluation: Evaluation) => void;
  onLink: (evaluation: Evaluation) => void;
  onRefresh: () => void;
  sortKey: string | null;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  startIndex: number;
  endIndex: number;
  totalItems: number;
}

const EvaluationsTable: React.FC<EvaluationsTableProps> = ({
  evaluations,
  onEdit,
  onLink,
  onRefresh,
  sortKey,
  sortDirection,
  onSort,
  currentPage,
  totalPages,
  onPageChange,
  canGoNext,
  canGoPrevious,
  startIndex,
  endIndex,
  totalItems
}) => {
  const { deleteEvaluationTemplate, isDeleting } = useDeleteEvaluationTemplate();
  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    evaluation: Evaluation | null;
  }>({ open: false, evaluation: null });
  
  const [detailsModal, setDetailsModal] = useState<{
    open: boolean;
    evaluation: Evaluation | null;
  }>({ open: false, evaluation: null });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    evaluation: Evaluation | null;
  }>({ open: false, evaluation: null });

  const [disciplinasCounts, setDisciplinasCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    const loadDisciplinasCounts = async () => {
      if (evaluations.length === 0) return;

      const evaluationIds = evaluations.map(e => e.eva_id);
      
      try {
        const { data, error } = await supabase
          .from('evaluacion_asignacion')
          .select('eva_id')
          .in('eva_id', evaluationIds)
          .eq('est_id', 1);

        if (error) throw error;

        const counts: Record<number, number> = {};
        evaluationIds.forEach(id => {
          counts[id] = data?.filter(item => item.eva_id === id).length || 0;
        });

        setDisciplinasCounts(counts);
      } catch (error) {
        console.error('Error loading disciplinas counts:', error);
        const fallbackCounts: Record<number, number> = {};
        evaluationIds.forEach(id => {
          fallbackCounts[id] = 0;
        });
        setDisciplinasCounts(fallbackCounts);
      }
    };

    loadDisciplinasCounts();
  }, [evaluations]);

  const handleDelete = async (evaluationId: number) => {
    const success = await deleteEvaluationTemplate(evaluationId);
    if (success) {
      onRefresh();
    }
  };

  const handleDeleteClick = (evaluation: Evaluation) => {
    setDeleteDialog({ open: true, evaluation });
  };

  const handleDeleteConfirm = async () => {
    if (deleteDialog.evaluation) {
      await handleDelete(deleteDialog.evaluation.eva_id);
      setDeleteDialog({ open: false, evaluation: null });
    }
  };

  const handlePreview = async (evaluation: Evaluation) => {
    setPreviewModal({ open: true, evaluation });
  };

  const handleDetails = async (evaluation: Evaluation) => {
    setDetailsModal({ open: true, evaluation });
  };

  const renderMobileActions = (evaluation: Evaluation) => {
    return (
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
            Acciones para {evaluation.eva_titulo}
          </div>
          
          <Button 
            variant="outline" 
            className="w-full justify-start" 
            onClick={() => handleDetails(evaluation)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Ver detalles
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full justify-start" 
            onClick={() => handlePreview(evaluation)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Vista previa
          </Button>
          
          <ConditionalAction module="evaluaciones" action="editar">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => onLink(evaluation)}
            >
              <Link className="h-4 w-4 mr-2" />
              Asignar disciplinas
            </Button>
          </ConditionalAction>
          
          <ConditionalAction module="evaluaciones" action="editar">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => onEdit(evaluation)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </ConditionalAction>
          
          <ConditionalAction module="evaluaciones" action="eliminar">
            <Button 
              variant="destructive" 
              className="w-full justify-start" 
              onClick={() => handleDeleteClick(evaluation)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </ConditionalAction>
        </SheetContent>
      </Sheet>
    );
  };

  const renderDesktopActions = (evaluation: Evaluation) => {
    return (
      <div className="hidden sm:flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDetails(evaluation)}
              className="h-8 w-8 p-0"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Ver detalles</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreview(evaluation)}
              className="h-8 w-8 p-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Vista previa</p>
          </TooltipContent>
        </Tooltip>

        <ConditionalAction module="evaluaciones" action="editar">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onLink(evaluation)}
                className="h-8 w-8 p-0"
              >
                <Link className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Asignar disciplinas</p>
            </TooltipContent>
          </Tooltip>
        </ConditionalAction>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ConditionalAction module="evaluaciones" action="editar">
              <DropdownMenuItem 
                onClick={() => onEdit(evaluation)}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Editar
              </DropdownMenuItem>
            </ConditionalAction>
            <ConditionalAction module="evaluaciones" action="eliminar">
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => handleDeleteClick(evaluation)}
                disabled={isDeleting}
                className="flex items-center gap-2 text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </ConditionalAction>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="rounded-md border overflow-visible sm:overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHeader
                  sortKey="eva_titulo"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                >
                  Título
                </SortableTableHeader>
                <SortableTableHeader
                  sortKey="eva_descripcion"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  className="hidden sm:table-cell"
                >
                  Descripción
                </SortableTableHeader>
                <SortableTableHeader
                  sortKey="eva_categoria"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  className="hidden sm:table-cell"
                >
                  Categoría
                </SortableTableHeader>
                <SortableTableHeader
                  sortKey="eva_puntaje_total"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  className="hidden md:table-cell"
                >
                  Puntaje Total de la Evaluación
                </SortableTableHeader>
                <SortableTableHeader
                  sortKey="disciplinas_count"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  className="hidden md:table-cell"
                >
                  Disciplinas
                </SortableTableHeader>
                <SortableTableHeader
                  sortKey="actions"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={() => {}}
                  className="w-12"
                >
                  <span className="hidden md:inline">⋯</span>
                  <span className="md:hidden">Acciones</span>
                </SortableTableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground md:table-cell">
                    No se encontraron evaluaciones
                  </TableCell>
                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground md:hidden">
                    No se encontraron evaluaciones
                  </TableCell>
                </TableRow>
              ) : (
                evaluations.map((evaluation) => (
                  <TableRow key={evaluation.eva_id}>
                    <TableCell className="min-w-0 max-w-[160px] truncate sm:max-w-none">
                      <div className="font-medium truncate">{evaluation.eva_titulo}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {evaluation.eva_descripcion ? (
                        <span className="text-sm text-muted-foreground">
                          {evaluation.eva_descripcion.length > 50 
                            ? `${evaluation.eva_descripcion.substring(0, 50)}...`
                            : evaluation.eva_descripcion
                          }
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Sin descripción</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {evaluation.eva_categoria ? (
                        <Badge variant="outline">{evaluation.eva_categoria}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Sin categoría</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="font-semibold">
                        {evaluation.eva_puntaje_total || 0} pts
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline">
                        {disciplinasCounts[evaluation.eva_id] || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {renderMobileActions(evaluation)}
                      {renderDesktopActions(evaluation)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Mostrando {startIndex} a {endIndex} de {totalItems} evaluaciones
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={!canGoPrevious}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(page)}
                    className="w-8 h-8 p-0"
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={!canGoNext}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {previewModal.open && previewModal.evaluation && (
        <EvaluateStudentModal
          open={previewModal.open}
          onOpenChange={(open) => setPreviewModal({ open, evaluation: null })}
          isPreviewMode={true}
          evaluationId={previewModal.evaluation.eva_id}
          evaluationTitle={previewModal.evaluation.eva_titulo}
        />
      )}

      {detailsModal.open && detailsModal.evaluation && (
        <EvaluationDetailsModal
          open={detailsModal.open}
          onOpenChange={(open) => setDetailsModal({ open, evaluation: null })}
          evaluation={{
            eva_id: detailsModal.evaluation.eva_id,
            eva_titulo: detailsModal.evaluation.eva_titulo,
            eva_descripcion: detailsModal.evaluation.eva_descripcion,
            eva_categoria: detailsModal.evaluation.eva_categoria,
            eva_puntaje_total: detailsModal.evaluation.eva_puntaje_total,
            est_id: detailsModal.evaluation.est_id,
            parameters: [] // Will be loaded by the modal
          }}
        />
      )}

      <DeleteEvaluationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, evaluation: null })}
        onConfirm={handleDeleteConfirm}
        evaluationTitle={deleteDialog.evaluation?.eva_titulo || ''}
        isDeleting={isDeleting}
      />
    </TooltipProvider>
  );
};

export default EvaluationsTable;
