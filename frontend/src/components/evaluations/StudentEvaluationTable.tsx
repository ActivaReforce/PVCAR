
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, MoreHorizontal } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

interface StudentEvaluation {
  nino_nombre: string;
  evaninopen_id: number;
  est_id: number;
}

interface StudentEvaluationTableProps {
  studentEvaluations: StudentEvaluation[];
  loading: boolean;
  onEvaluateStudent: (student: StudentEvaluation) => void;
  onModifyEvaluation?: (student: StudentEvaluation) => void;
  onDeleteEvaluation?: (student: StudentEvaluation) => void;
}

const StudentEvaluationTable: React.FC<StudentEvaluationTableProps> = ({
  studentEvaluations,
  loading,
  onEvaluateStudent,
  onModifyEvaluation,
  onDeleteEvaluation
}) => {
  const getStatusBadge = (estId: number) => {
    switch (estId) {
      case 6:
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Pendiente</Badge>;
      case 7:
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Evaluado</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const visibleEvaluations = React.useMemo(
    () => studentEvaluations.filter(s => s.est_id === 6 || s.est_id === 7),
    [studentEvaluations]
  );

  const renderMobileActions = (student: StudentEvaluation) => {
    const isEvaluated = student.est_id === 7;
    
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
            Acciones para {student.nino_nombre}
            <Badge variant="outline" className={`ml-2 ${isEvaluated ? 'bg-green-100 text-green-800 border-green-300' : 'bg-yellow-100 text-yellow-800 border-yellow-300'}`}>
              {isEvaluated ? 'Evaluado' : 'Pendiente'}
            </Badge>
          </div>
          
          {student.est_id === 6 && (
            <Button 
              variant="default" 
              className="w-full justify-start" 
              onClick={() => onEvaluateStudent(student)}
            >
              Evaluar
            </Button>
          )}
          
          {student.est_id === 7 && (
            <>
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => onModifyEvaluation?.(student)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Modificar evaluación
              </Button>
              
              <Button 
                variant="destructive" 
                className="w-full justify-start" 
                onClick={() => {
                  if (confirm(`¿Estás seguro de que quieres eliminar la evaluación de "${student.nino_nombre}"?`)) {
                    onDeleteEvaluation?.(student);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar evaluación
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>
    );
  };

  const renderDesktopActions = (student: StudentEvaluation) => {
    return (
      <div className="hidden sm:flex items-center gap-2">
        {student.est_id === 6 && (
          <Button
            size="sm"
            onClick={() => onEvaluateStudent(student)}
          >
            Evaluar
          </Button>
        )}
        {student.est_id === 7 && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onModifyEvaluation?.(student)}
              className="flex items-center gap-1"
            >
              <Edit className="h-3 w-3" />
              Modificar evaluación
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDeleteEvaluation?.(student)}
              className="flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Eliminar evaluación
            </Button>
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-lg">Cargando alumnos...</div>
      </div>
    );
  }

  if (visibleEvaluations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No hay alumnos vinculados a esta evaluación</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-visible sm:overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Alumno</TableHead>
            <TableHead className="hidden sm:table-cell">Estado</TableHead>
            <TableHead className="w-12">
              <span className="hidden sm:inline">⋯</span>
              <span className="sm:hidden">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleEvaluations.map((student) => (
            <TableRow key={student.evaninopen_id}>
              <TableCell className="min-w-0 max-w-[160px] truncate sm:max-w-none">
                <div className="font-medium truncate">{student.nino_nombre}</div>
                <div className="sm:hidden text-xs text-muted-foreground mt-1">
                  {getStatusBadge(student.est_id)}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {getStatusBadge(student.est_id)}
              </TableCell>
              <TableCell>
                {renderMobileActions(student)}
                {renderDesktopActions(student)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default StudentEvaluationTable;
