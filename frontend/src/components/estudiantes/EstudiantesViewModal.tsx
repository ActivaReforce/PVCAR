import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import EstudianteDisciplinasChips from "./EstudianteDisciplinasChips";
type Nino = Database['public']['Tables']['nino']['Row'];
interface EstudianteWithDetails extends Nino {
  colegio: {
    col_nombre: string;
  } | null;
  categoria_nino_grado?: {
    catninograd_nombre: string;
  } | null;
  representantes: Array<{
    padre: {
      usuario: Database['public']['Tables']['usuario']['Row'];
      padre_sector_residencia?: string;
    };
  }>;
}
interface EstudiantesViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estudiante: EstudianteWithDetails | null;
  onEdit: () => void;
  onDelete: () => void;
  onAttach: () => void;
  onLinkDisciplines: () => void;
}
const EstudiantesViewModal = ({
  open,
  onOpenChange,
  estudiante,
  onEdit,
  onDelete,
  onAttach,
  onLinkDisciplines
}: EstudiantesViewModalProps) => {
  if (!estudiante) return null;
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onOpenChange(false);
    }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyDown}>
        <DialogHeader className="relative">
          {/* Title bar with avatar + full name */}
          <div className="flex items-center gap-4 pr-8">
            {estudiante.nino_foto && <img src={estudiante.nino_foto} alt={estudiante.nino_nombre} className="w-16 h-16 rounded-full object-cover border-2 border-border" />}
            <div>
              <DialogTitle className="text-2xl font-semibold">
                {estudiante.nino_nombre}
              </DialogTitle>
              
            </div>
          </div>
          
          {/* Close button - top right */}
          
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Two-column grid of static fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg mb-4">Información Personal</h3>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Cédula</p>
                <p className="text-sm">{estudiante.nino_cedula || 'No registrada'}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Edad</p>
                <p className="text-sm">{estudiante.nino_edad ? `${estudiante.nino_edad} años` : 'No especificada'}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Grado</p>
                <p className="text-sm">{estudiante.categoria_nino_grado?.catninograd_nombre || 'No asignado'}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Transporte Escolar</p>
                <p className="text-sm">
                  {estudiante.nino_toma_transporte === null ? 'No especificado' : estudiante.nino_toma_transporte ? 'Sí' : 'No'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg mb-4">Información Académica</h3>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Colegio</p>
                <p className="text-sm">{estudiante.colegio?.col_nombre || 'No asignado'}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Estado</p>
                <Badge variant={estudiante.est_id === 1 ? "default" : "secondary"}>
                  {estudiante.est_id === 1 ? "Activo" : "Inactivo"}
                </Badge>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Fecha de Registro</p>
                <p className="text-sm">
                  {estudiante.nino_fecha_creacion ? new Date(estudiante.nino_fecha_creacion).toLocaleDateString() : 'No disponible'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Disciplinas activas section */}
          <EstudianteDisciplinasChips estudiante={{
          nino_id: estudiante.nino_id,
          nino_nombre: estudiante.nino_nombre
        }} onLinkDisciplines={() => {}} // Empty function since this is read-only
        readonly={true} />

          <Separator />

          {/* Representatives section */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Representante</h4>
            {estudiante.representantes.length > 0 ? <div className="space-y-3">
                {estudiante.representantes.map((rep, index) => <div key={index} className="p-4 border rounded-lg bg-muted/30">
                    <div className="space-y-2">
                      <p className="font-medium">{rep.padre.usuario.usu_nombre}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Email:</span> {rep.padre.usuario.usu_correo}
                        </div>
                        {rep.padre.usuario.usu_telefono && <div>
                            <span className="font-medium">Teléfono:</span> {rep.padre.usuario.usu_telefono}
                          </div>}
                        {rep.padre.padre_sector_residencia && <div className="sm:col-span-2">
                            <span className="font-medium">Sector:</span> {rep.padre.padre_sector_residencia}
                          </div>}
                      </div>
                    </div>
                  </div>)}
              </div> : <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                <p>Sin representante asignado</p>
              </div>}
          </div>

          {/* Health information */}
          {estudiante.nino_info_salud && <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold text-lg">Información de Salud</h4>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm">{estudiante.nino_info_salud}</p>
                </div>
              </div>
            </>}

          {/* Additional information */}
          {estudiante.nino_otra_info && <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold text-lg">Información Adicional</h4>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm">{estudiante.nino_otra_info}</p>
                </div>
              </div>
            </>}
        </div>
      </DialogContent>
    </Dialog>;
};
export default EstudiantesViewModal;