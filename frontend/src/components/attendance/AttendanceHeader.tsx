import React from 'react';
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
interface AttendanceHeaderProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  markAllPresent: boolean;
  onMarkAllPresentChange: (checked: boolean) => void;
}
const AttendanceHeader = ({
  selectedDate,
  onDateChange,
  markAllPresent,
  onMarkAllPresentChange
}: AttendanceHeaderProps) => {
  return <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Asistencia de Entrenadores</h1>
        
        <div className="flex items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")} aria-label="Seleccionar fecha">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP", {
                locale: es
              }) : <span>Seleccionar fecha</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={selectedDate} onSelect={date => date && onDateChange(date)} disabled={date => date > new Date()} initialFocus className="p-3" />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox id="markAllPresent" checked={markAllPresent} onCheckedChange={onMarkAllPresentChange} aria-describedby="markAllPresentDesc" />
        <Label htmlFor="markAllPresent" className="text-sm cursor-pointer">
          Marcar todos como presente
        </Label>
        <span id="markAllPresentDesc" className="sr-only">
          Selecciona esta opción para marcar automáticamente todos los entrenadores como presentes
        </span>
      </div>
    </div>;
};
export default AttendanceHeader;