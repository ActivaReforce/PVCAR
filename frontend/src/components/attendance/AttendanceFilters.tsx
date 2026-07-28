import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import AttendanceDatePicker from "./AttendanceDatePicker";
import { Colegio, Dia, DisciplineWithDetails } from "./AttendanceTypes";
interface AttendanceFiltersProps {
  colegios: Colegio[];
  dias: Dia[];
  disciplines: DisciplineWithDetails[];
  selectedColegio: string;
  selectedDia: string;
  selectedDiscipline: string;
  selectedDate: Date;
  markAllPresent: boolean;
  onColegioChange: (value: string) => void;
  onDiaChange: (value: string) => void;
  onDisciplineChange: (value: string) => void;
  onDateChange: (date: Date) => void;
  onMarkAllPresentChange: (checked: boolean) => void;
}
const AttendanceFilters = ({
  colegios,
  dias,
  disciplines,
  selectedColegio,
  selectedDia,
  selectedDiscipline,
  selectedDate,
  markAllPresent,
  onColegioChange,
  onDiaChange,
  onDisciplineChange,
  onDateChange,
  onMarkAllPresentChange
}: AttendanceFiltersProps) => {
  return <Card>
      <CardHeader>
        <CardTitle>Filtros de Selección</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="colegio-select">Colegio</Label>
            <Select value={selectedColegio} onValueChange={onColegioChange}>
              <SelectTrigger id="colegio-select">
                <SelectValue placeholder="Seleccionar colegio" />
              </SelectTrigger>
              <SelectContent>
                {colegios.map(colegio => <SelectItem key={colegio.col_id} value={colegio.col_id.toString()}>
                    {colegio.col_nombre}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dia-select">Día de la Semana</Label>
            <Select value={selectedDia} onValueChange={onDiaChange} disabled={!selectedColegio}>
              <SelectTrigger id="dia-select">
                <SelectValue placeholder="Seleccionar día" />
              </SelectTrigger>
              <SelectContent>
                {dias.map(dia => <SelectItem key={dia.dia_id} value={dia.dia_id.toString()}>
                    {dia.dia_nombre.charAt(0).toUpperCase() + dia.dia_nombre.slice(1)}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="discipline-select">Disciplina</Label>
            <Select value={selectedDiscipline} onValueChange={onDisciplineChange} disabled={!selectedColegio || !selectedDia}>
              <SelectTrigger id="discipline-select">
                <SelectValue placeholder="Seleccionar disciplina" />
              </SelectTrigger>
              <SelectContent>
                {disciplines.map(discipline => {
                  // Guard against null/undefined actividad
                  const actName = discipline.actividad?.act_nombre ?? 'Sin nombre';
                  const startTime = discipline.colacthor_hora_inicio ?? '';
                  const endTime = discipline.colacthor_hora_fin ?? '';
                  return (
                    <SelectItem key={discipline.colacthor_id} value={discipline.colacthor_id.toString()}>
                      {actName} ({startTime} - {endTime})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedDiscipline && <AttendanceDatePicker selectedDate={selectedDate} selectedWeekday={parseInt(selectedDia)} onDateChange={onDateChange} />}

        
      </CardContent>
    </Card>;
};
export default AttendanceFilters;