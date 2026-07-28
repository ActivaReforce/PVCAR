import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import AttendanceDatePicker from "./AttendanceDatePicker";
import { Colegio, Dia } from "./TrainerAttendanceTypes";
interface TrainerAttendanceFiltersProps {
  selectedColegio: string;
  selectedDia: string;
  selectedDate: Date;
  colegios: Colegio[];
  dias: Dia[];
  markAllPresent: boolean;
  showMarkAllOption: boolean;
  onColegioChange: (value: string) => void;
  onDiaChange: (value: string) => void;
  onDateChange: (date: Date) => void;
  onMarkAllChange: (checked: boolean) => void;
}
const TrainerAttendanceFilters = ({
  selectedColegio,
  selectedDia,
  selectedDate,
  colegios,
  dias,
  markAllPresent,
  showMarkAllOption,
  onColegioChange,
  onDiaChange,
  onDateChange,
  onMarkAllChange
}: TrainerAttendanceFiltersProps) => {
  return <Card>
      <CardHeader>
        <CardTitle>Filtros de Selección</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="colegio-select">Colegio</Label>
            <Select value={selectedColegio} onValueChange={onColegioChange}>
              <SelectTrigger id="colegio-select">
                <SelectValue placeholder="Seleccionar colegio" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-700 border border-gray-200 shadow-lg z-50">
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
              <SelectContent className="bg-white dark:bg-gray-700 border border-gray-200 shadow-lg z-50">
                {dias.map(dia => <SelectItem key={dia.dia_id} value={dia.dia_id.toString()}>
                    {dia.dia_nombre.charAt(0).toUpperCase() + dia.dia_nombre.slice(1)}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedColegio && selectedDia && <AttendanceDatePicker selectedDate={selectedDate} selectedWeekday={parseInt(selectedDia)} onDateChange={onDateChange} />}

        {showMarkAllOption}
      </CardContent>
    </Card>;
};
export default TrainerAttendanceFilters;