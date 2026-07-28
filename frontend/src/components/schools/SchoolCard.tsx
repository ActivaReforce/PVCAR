import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Pencil, Trash2, Mail, Phone, MapPin } from 'lucide-react';
import { ConditionalAction } from '@/components/ui/conditional-actions';

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

interface SchoolCardProps {
  school: Colegio;
  onEdit: (school: Colegio) => void;
  onDelete: (school: Colegio) => void;
  index: number;
}

const SchoolCard: React.FC<SchoolCardProps> = ({
  school,
  onEdit,
  onDelete,
  index
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Color cycling for card backgrounds
  const backgroundColors = ['bg-gradient-to-r from-blue-50 to-blue-100', 'bg-gradient-to-r from-green-50 to-green-100', 'bg-gradient-to-r from-purple-50 to-purple-100', 'bg-gradient-to-r from-orange-50 to-orange-100', 'bg-gradient-to-r from-pink-50 to-pink-100', 'bg-gradient-to-r from-indigo-50 to-indigo-100', 'bg-gradient-to-r from-teal-50 to-teal-100', 'bg-gradient-to-r from-red-50 to-red-100'];
  const borderColors = ['border-l-blue-500', 'border-l-green-500', 'border-l-purple-500', 'border-l-orange-500', 'border-l-pink-500', 'border-l-indigo-500', 'border-l-teal-500', 'border-l-red-500'];
  const cardBgColor = backgroundColors[index % backgroundColors.length];
  const cardBorderColor = borderColors[index % borderColors.length];

  return <div className={`transition-all duration-200 ${isExpanded ? 'h-auto' : 'h-[180px]'}`}>
      <Card className={`h-full transition-all duration-200 hover:shadow-md border-l-4 ${cardBorderColor} ${cardBgColor} ${isExpanded ? 'overflow-visible flex flex-col' : 'overflow-hidden'}`}>
        <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {school.col_nombre}
              </h3>
              <small className="text-gray-600 text-xs block mb-1">Coordinadores AR</small>
              <div className="flex flex-wrap gap-1">
                {school.coordinators && school.coordinators.length > 0 ? school.coordinators.map(coordinator => <Badge key={coordinator.usu_id} variant="secondary" className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200">
                      {coordinator.usu_nombre}
                    </Badge>) : <Badge variant="outline" className="text-xs text-gray-500">
                    Sin coordinadores AR
                  </Badge>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={e => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }} className="text-gray-500 hover:text-gray-700">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isExpanded && (
          <CardContent className="pt-0 relative mt-auto">
            {/* Click to view details message */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground dark:text-black">
                Haz clic para ver detalles
              </p>
            </div>
          </CardContent>
        )}

        {isExpanded && <CardContent className="pt-2 border-t bg-gray-50/50 flex flex-col flex-1">
            <div className="flex-1">
              {/* School Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    
                    <div>
                      <p className="text-sm font-medium text-gray-700">Dirección</p>
                      <p className="text-sm text-gray-600">{school.col_direccion}</p>
                    </div>
                  </div>
                </div>
                
                {school.col_rep_nombre && <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Contacto/Autoridad</p>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">{school.col_rep_nombre}</p>
                      {school.col_rep_email && <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <p className="text-xs text-gray-500">{school.col_rep_email}</p>
                        </div>}
                      {school.col_rep_telefono && <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <p className="text-xs text-gray-500">{school.col_rep_telefono}</p>
                        </div>}
                    </div>
                  </div>}
              </div>
            </div>

            {/* Actions - Fixed at bottom */}
            <div className="flex justify-center gap-4 mt-4 pt-4 border-t">
              <ConditionalAction module="colegios" action="editar">
                <Button variant="outline" size="sm" onClick={e => {
                e.stopPropagation();
                onEdit(school);
              }} className="flex items-center gap-1">
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
              </ConditionalAction>
              <ConditionalAction module="colegios" action="eliminar">
                <Button variant="outline" size="sm" onClick={e => {
                e.stopPropagation();
                onDelete(school);
              }} className="flex items-center gap-1 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </ConditionalAction>
            </div>
          </CardContent>}
      </Card>
    </div>;
};

export default SchoolCard;
