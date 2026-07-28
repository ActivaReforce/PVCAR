
import { Card, CardContent } from "@/components/ui/card";

interface TrainerAttendanceEmptyStateProps {
  selectedColegio: string;
  selectedDia: string;
  entrenadores: any[];
}

const TrainerAttendanceEmptyState = ({
  selectedColegio,
  selectedDia,
  entrenadores
}: TrainerAttendanceEmptyStateProps) => {
  if (!selectedColegio || !selectedDia || entrenadores.length > 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="text-center py-8">
        <p className="text-muted-foreground">
          No se encontraron entrenadores asignados para el colegio y día seleccionados.
        </p>
      </CardContent>
    </Card>
  );
};

export default TrainerAttendanceEmptyState;
