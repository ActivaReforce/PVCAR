import React from 'react';
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
interface AttendanceDatePickerProps {
  selectedDate: Date;
  selectedWeekday: number; // 0 = Sunday, 1 = Monday, etc.
  onDateChange: (date: Date) => void;
}
const AttendanceDatePicker = ({
  selectedDate,
  selectedWeekday,
  onDateChange
}: AttendanceDatePickerProps) => {
  const getDayName = (dayId: number): string => {
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    return dayNames[dayId] || 'día';
  };

  // Function to check if a date should be disabled (not matching the selected weekday)
  const isDateDisabled = (date: Date): boolean => {
    return date.getDay() !== selectedWeekday;
  };
  return <div className="space-y-2 ">
      <Label htmlFor="date-picker" className="">
        Fecha de la Sesión ({getDayName(selectedWeekday)})
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button id="date-picker" variant="outline" className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")} aria-label={`Seleccionar fecha - ${getDayName(selectedWeekday)}`}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", {
            locale: es
          }) : <span>Seleccionar fecha</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={selectedDate} onSelect={date => date && onDateChange(date)} disabled={isDateDisabled} initialFocus className="p-3 pointer-events-auto" modifiers={{
          available: date => !isDateDisabled(date)
        }} modifiersStyles={{
          available: {
            backgroundColor: 'hsl(var(--accent))',
            color: 'hsl(var(--accent-foreground))'
          }
        }} />
          <div className="px-3 pb-3">
            <p className="text-xs text-muted-foreground">
              Solo se pueden seleccionar fechas que caigan en {getDayName(selectedWeekday)}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>;
};
export default AttendanceDatePicker;