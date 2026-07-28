
import React from 'react';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Edit, Trash2, UserPlus, Link, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Database } from "@/integrations/supabase/types";
import { ConditionalAction } from "@/components/ui/conditional-actions";

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

interface EstudiantesTableProps {
  estudiantes: EstudianteWithDetails[];
  loading: boolean;
  onEdit: (estudiante: EstudianteWithDetails) => void;
  onView: (estudiante: EstudianteWithDetails) => void;
  onDelete: (estudiante: EstudianteWithDetails) => void;
  onAttach: (estudiante: EstudianteWithDetails) => void;
  onLinkDisciplines: (estudiante: EstudianteWithDetails) => void;
}

const EstudiantesTable = ({
  estudiantes,
  loading,
  onEdit,
  onView,
  onDelete,
  onAttach,
  onLinkDisciplines
}: EstudiantesTableProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderMobileActions = (estudiante: EstudianteWithDetails) => {
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
            <Button 
              variant="destructive" 
              className="w-full justify-start" 
              onClick={() => onDelete(estudiante)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </ConditionalAction>
        </SheetContent>
      </Sheet>
    );
  };

  const renderDesktopActions = (estudiante: EstudianteWithDetails) => {
    return (
      <div className="hidden sm:flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(estudiante)}
          title="Ver detalles"
        >
          <Eye className="h-4 w-4" />
        </Button>
        <ConditionalAction module="estudiantes" action="editar">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(estudiante)}
            title="Editar"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </ConditionalAction>
        <ConditionalAction module="estudiantes" action="editar">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLinkDisciplines(estudiante)}
            title="Asignar disciplinas"
          >
            <Link className="h-4 w-4" />
          </Button>
        </ConditionalAction>
        <ConditionalAction module="estudiantes" action="editar">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAttach(estudiante)}
            title="Asignar representante"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </ConditionalAction>
        <ConditionalAction module="estudiantes" action="eliminar">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(estudiante)}
            title="Eliminar"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </ConditionalAction>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-muted-foreground">Cargando estudiantes...</p>
      </div>
    );
  }

  if (estudiantes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No hay estudiantes registrados</p>
        <p className="text-sm mt-2">Comience agregando un nuevo estudiante</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-visible sm:overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Alumno</TableHead>
            <TableHead className="hidden sm:table-cell">Edad</TableHead>
            <TableHead className="hidden sm:table-cell">Representante</TableHead>
            <TableHead className="hidden sm:table-cell">Grado</TableHead>
            <TableHead className="hidden sm:table-cell">Información Salud</TableHead>
            <TableHead>Disciplinas</TableHead>
            <TableHead className="w-12">⋯</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {estudiantes.map((estudiante) => (
            <TableRow key={estudiante.nino_id}>
              <TableCell className="min-w-0 max-w-[160px] sm:w-[200px] sm:max-w-none">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={estudiante.nino_foto || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(estudiante.nino_nombre)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{estudiante.nino_nombre}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {estudiante.nino_edad || 'N/A'}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <div className="truncate">
                  {estudiante.representantes.length > 0 
                    ? estudiante.representantes[0].padre.usuario.usu_nombre
                    : 'Sin representante'
                  }
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {estudiante.categoria_nino_grado?.catninograd_nombre || 'N/A'}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <div className="max-w-48 truncate">
                  {estudiante.nino_info_salud || 'Sin información'}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {estudiante.disciplinas_count || 0}
                </Badge>
              </TableCell>
              <TableCell>
                {renderMobileActions(estudiante)}
                {renderDesktopActions(estudiante)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default EstudiantesTable;
