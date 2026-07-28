
import React from 'react';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';

interface School {
  col_id: number;
  col_nombre: string;
  disciplines: Discipline[];
}

interface Discipline {
  colacthor_id: number;
  actividad: {
    act_nombre: string;
  };
  dia: {
    dia_nombre: string;
  };
  colacthor_hora_inicio: string;
  colacthor_hora_fin: string;
}

interface AvailableDisciplinesPanelProps {
  schools: School[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedDisciplines: Set<number>;
  onDisciplineToggle: (disciplineId: number) => void;
  isLoading: boolean;
}

const AvailableDisciplinesPanel: React.FC<AvailableDisciplinesPanelProps> = ({
  schools,
  searchTerm,
  onSearchChange,
  selectedDisciplines,
  onDisciplineToggle,
  isLoading
}) => {
  const formatTime = (time: string) => {
    if (!time) return '';
    return time.substring(0, 5);
  };

  const filteredSchools = schools.map(school => ({
    ...school,
    disciplines: school.disciplines.filter(discipline =>
      discipline.actividad?.act_nombre?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(school => school.disciplines.length > 0 || !searchTerm);

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="border-b pb-3 mb-4">
        <h3 className="font-medium text-lg">Añadir disciplinas</h3>
        <div className="mt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar disciplinas..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Cargando disciplinas...</span>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {filteredSchools.map((school) => (
              <AccordionItem key={school.col_id} value={`school-${school.col_id}`} className="border rounded-lg">
                <AccordionTrigger className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{school.col_nombre}</span>
                    <Badge variant="secondary">{school.disciplines.length} disciplinas</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {school.disciplines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay disciplinas disponibles.</p>
                  ) : (
                    <div className="space-y-3">
                      {school.disciplines.map((discipline) => (
                        <div
                          key={discipline.colacthor_id}
                          className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <Checkbox
                            id={`discipline-${discipline.colacthor_id}`}
                            checked={selectedDisciplines.has(discipline.colacthor_id)}
                            onCheckedChange={() => onDisciplineToggle(discipline.colacthor_id)}
                          />
                          <div className="flex-1 min-w-0">
                            <label
                              htmlFor={`discipline-${discipline.colacthor_id}`}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {discipline.actividad?.act_nombre}
                            </label>
                            <div className="text-xs text-muted-foreground mt-1">
                              <div>{discipline.dia?.dia_nombre}</div>
                              <div>
                                {formatTime(discipline.colacthor_hora_inicio)} - {formatTime(discipline.colacthor_hora_fin)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {filteredSchools.length === 0 && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No se encontraron disciplinas disponibles.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailableDisciplinesPanel;
