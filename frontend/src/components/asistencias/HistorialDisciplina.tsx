import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useHistorialAsistencias } from '@/hooks/useAsistencias';

interface Props {
  disciplina: number;
  /** El día de la semana de la disciplina, para el enlace de cada fecha. */
  onAbrirFecha: (fecha: string) => void;
}

const hace = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
};

const hoy = () => new Date().toISOString().slice(0, 10);

const conDia = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-EC', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

/**
 * Historial de una disciplina.
 *
 * Existe porque hasta ahora no había forma de mirar una fecha pasada sin
 * rehacer los cuatro filtros en cascada: colegio, día, disciplina y fecha, uno
 * por uno, para ver un martes de hace tres semanas.
 *
 * Cada fila es una sesión ya registrada y se pulsa para abrirla: eso convierte
 * la corrección de un error antiguo en dos clics.
 */
const HistorialDisciplina = ({ disciplina, onAbrirFecha }: Props) => {
  const [desde, setDesde] = useState(hace(60));
  const [hasta, setHasta] = useState(hoy());

  const historial = useHistorialAsistencias(disciplina, desde, hasta, true);
  const dias = historial.data?.dias ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="historial-desde">Desde</Label>
          <Input
            id="historial-desde"
            type="date"
            value={desde}
            max={hasta}
            onChange={(evento) => setDesde(evento.target.value)}
            className="h-11 sm:h-10"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="historial-hasta">Hasta</Label>
          <Input
            id="historial-hasta"
            type="date"
            value={hasta}
            min={desde}
            onChange={(evento) => setHasta(evento.target.value)}
            className="h-11 sm:h-10"
          />
        </div>
      </div>

      {historial.isLoading && (
        <p className="py-6 text-center text-muted-foreground">Cargando historial…</p>
      )}

      {historial.isError && (
        <p className="py-6 text-center text-destructive">
          {(historial.error as Error).message}
        </p>
      )}

      {!historial.isLoading && !historial.isError && dias.length === 0 && (
        <div className="py-10 text-center text-muted-foreground">
          <CalendarRange className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>No hay asistencias registradas en ese rango.</p>
        </div>
      )}

      {dias.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-lg border">
          {dias.map((dia) => (
            <li key={dia.fecha}>
              <button
                type="button"
                onClick={() => onAbrirFecha(dia.fecha)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="font-medium">{conDia(dia.fecha)}</div>
                  <div className="text-xs text-muted-foreground">{dia.total} registros</div>
                </div>
                <div className="flex flex-shrink-0 gap-2 text-sm sm:gap-4">
                  <span className="text-emerald-700 dark:text-emerald-400">{dia.presentes}</span>
                  <span className="text-rose-700 dark:text-rose-400">{dia.ausentes}</span>
                  <span className="text-amber-700 dark:text-amber-400">{dia.tardes}</span>
                  <span className="text-sky-700 dark:text-sky-400">{dia.justificados}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {dias.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Presentes · Ausentes · Tarde · Justificados. Pulsa una fecha para abrir esa sesión.
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        className="h-11 sm:h-10"
        onClick={() => {
          setDesde(hace(60));
          setHasta(hoy());
        }}
      >
        Últimos 60 días
      </Button>
    </div>
  );
};

export default HistorialDisciplina;
