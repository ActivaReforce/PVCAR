import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Edit, Trash2, User } from "lucide-react";
import { ConditionalAction } from "@/components/ui/conditional-actions";

interface DisciplinaWithDetails {
  colacthor_id: number;
  colegio: {
    col_nombre: string;
  } | null;
  actividad: {
    act_nombre: string;
  } | null;
  dia: {
    dia_nombre: string;
  } | null;
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

interface DisciplinaCalendarProps {
  disciplinas: DisciplinaWithDetails[];
  onEdit?: (disciplina: DisciplinaWithDetails) => void;
  onDelete?: (disciplina: DisciplinaWithDetails) => void;
}

const DisciplinaCalendar = ({
  disciplinas,
  onEdit,
  onDelete
}: DisciplinaCalendarProps) => {
  const formatTime = (time: string | null) => {
    if (!time) return "—";
    return time.substring(0, 5);
  };

  const formatTimeRange = (inicio: string | null, fin: string | null) => {
    const inicioFormatted = formatTime(inicio);
    const finFormatted = formatTime(fin);
    if (inicioFormatted === "—" && finFormatted === "—") return "—";
    if (inicioFormatted === "—") return `- ${finFormatted}`;
    if (finFormatted === "—") return `${inicioFormatted} -`;
    return `${inicioFormatted} - ${finFormatted}`;
  };

  // Group disciplines by colegio
  const disciplinasByColegio = disciplinas.reduce((acc, disciplina) => {
    const colegioName = disciplina.colegio?.col_nombre || "Sin Colegio";
    if (!acc[colegioName]) {
      acc[colegioName] = [];
    }
    acc[colegioName].push(disciplina);
    return acc;
  }, {} as Record<string, DisciplinaWithDetails[]>);

  // Days of the week in order (Monday to Sunday)
  const daysOrder = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const daysLabels = {
    'lunes': 'Lunes',
    'martes': 'Martes',
    'miércoles': 'Miércoles',
    'jueves': 'Jueves',
    'viernes': 'Viernes',
    'sábado': 'Sábado',
    'domingo': 'Domingo'
  };

  // Group disciplines by day within each colegio
  const groupDisciplinasByDay = (disciplinas: DisciplinaWithDetails[]) => {
    const byDay = disciplinas.reduce((acc, disciplina) => {
      const dayName = disciplina.dia?.dia_nombre?.toLowerCase() || 'sin día';
      if (!acc[dayName]) {
        acc[dayName] = [];
      }
      acc[dayName].push(disciplina);
      return acc;
    }, {} as Record<string, DisciplinaWithDetails[]>);

    // Sort disciplines within each day by start time
    Object.keys(byDay).forEach(day => {
      byDay[day].sort((a, b) => {
        const timeA = a.colacthor_hora_inicio || "00:00";
        const timeB = b.colacthor_hora_inicio || "00:00";
        return timeA.localeCompare(timeB);
      });
    });
    return byDay;
  };

  if (disciplinas.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No se encontraron disciplinas</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(disciplinasByColegio).map(([colegioName, colegiodisciplinas]) => {
        const disciplinasByDay = groupDisciplinasByDay(colegiodisciplinas);
        
        return (
          <Card key={colegioName} className="w-full">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-[#FD5757]">
                {colegioName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Responsive grid - max 4 columns on large screens, wrapping for smaller screens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {daysOrder.map(day => (
                  <div key={day} className="space-y-3">
                    <h4 className="font-semibold text-sm text-center bg-gray-100 rounded-lg py-2 px-2 dark:text-black">
                      {daysLabels[day]}
                    </h4>
                    <div className="space-y-2 min-h-[80px]">
                      {disciplinasByDay[day] ? (
                        disciplinasByDay[day].map(disciplina => (
                          <Card key={disciplina.colacthor_id} className="border border-gray-200 shadow-sm">
                            <CardContent className="p-2">
                              {/* Updated layout with proper spacing for actions column */}
                              <div className="flex items-start justify-between gap-2">
                                {/* Left side: Time and Activity */}
                                <div className="flex-1 min-w-0">
                                  {/* Time range */}
                                  <div className="mb-1">
                                    <span className="text-xs font-medium text-gray-600">
                                      {formatTimeRange(
                                        disciplina.colacthor_hora_inicio, 
                                        disciplina.colacthor_hora_fin
                                      )}
                                    </span>
                                  </div>
                                  
                                  {/* Activity name */}
                                  <div className="mb-1">
                                    <Badge variant="outline" className="text-xs h-5 px-2 py-0 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                      {disciplina.actividad?.act_nombre || "—"}
                                    </Badge>
                                  </div>
                                </div>
                                
                                {/* Right side: Vertical action buttons stack */}
                                <div className="flex flex-col gap-1 flex-shrink-0">
                                  {/* Trainer indicator */}
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className={`h-5 w-5 p-0 border-gray-300 ${
                                          disciplina.trainer ? 'bg-green-50 border-green-300 dark:text-black' : 'bg-gray-50'
                                        }`}
                                        title={disciplina.trainer ? "Ver entrenador asignado" : "Sin entrenador asignado"}
                                      >
                                        {disciplina.trainer ? (
                                          <Avatar className="h-3 w-3">
                                            <AvatarFallback className="text-[8px] bg-green-100">
                                              {disciplina.trainer.usu_nombre.charAt(0)}
                                            </AvatarFallback>
                                          </Avatar>
                                        ) : (
                                          <User className="h-3 w-3 text-gray-400" />
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-2" side="left">
                                      <div className="text-xs">
                                        {disciplina.trainer ? (
                                          <div>
                                            <p className="font-medium">Entrenador:</p>
                                            <p>{disciplina.trainer.usu_nombre}</p>
                                          </div>
                                        ) : (
                                          <p className="text-muted-foreground">Sin entrenador asignado</p>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>

                                  {/* Edit button */}
                                  {onEdit && (
                                    <ConditionalAction module="disciplinas" action="editar">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => onEdit(disciplina)} 
                                        className="h-5 w-5 p-0 border-gray-300" 
                                        title="Editar disciplina"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                    </ConditionalAction>
                                  )}

                                  {/* Delete button */}
                                  {onDelete && (
                                    <ConditionalAction module="disciplinas" action="eliminar">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => onDelete(disciplina)} 
                                        className="h-5 w-5 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-gray-300" 
                                        title="Eliminar disciplina"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </ConditionalAction>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-xs text-muted-foreground">Sin disciplinas</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default DisciplinaCalendar;
