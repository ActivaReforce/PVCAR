
import React from 'react';
import { Label } from '@/components/ui/label';

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

interface ActivityDetailsProps {
  actividad: Actividad;
}

const ActivityDetails: React.FC<ActivityDetailsProps> = ({ actividad }) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Nombre</Label>
          <p className="text-sm">{actividad.act_nombre}</p>
        </div>
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Categoría</Label>
          <p className="text-sm">{actividad.categoria?.cat_nombre || 'No especificada'}</p>
        </div>
      </div>
      
      {actividad.act_descripcion && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Descripción</Label>
          <p className="text-sm">{actividad.act_descripcion}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actividad.act_tipo_espacio && (
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Tipo de Espacio</Label>
            <p className="text-sm">{actividad.act_tipo_espacio}</p>
          </div>
        )}
        {actividad.act_espacio_trabajo && (
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Espacio de Trabajo</Label>
            <p className="text-sm">{actividad.act_espacio_trabajo}</p>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actividad.act_espacio_secundario && (
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Espacio Secundario</Label>
            <p className="text-sm">{actividad.act_espacio_secundario}</p>
          </div>
        )}
        {actividad.act_indumentaria_tipo && (
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Tipo de Indumentaria</Label>
            <p className="text-sm">{actividad.act_indumentaria_tipo}</p>
          </div>
        )}
      </div>
      
      {actividad.act_materiales_alumno && actividad.act_materiales_alumno.length > 0 && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Materiales del Alumno</Label>
          <p className="text-sm">{actividad.act_materiales_alumno.join(', ')}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Fecha de Creación</Label>
          <p className="text-sm">
            {actividad.act_fecha_creacion 
              ? new Date(actividad.act_fecha_creacion).toLocaleString()
              : 'No disponible'
            }
          </p>
        </div>
        {actividad.act_fecha_modificacion && (
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Última Modificación</Label>
            <p className="text-sm">
              {new Date(actividad.act_fecha_modificacion).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityDetails;
