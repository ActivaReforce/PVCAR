import { Building2, CalendarClock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ColegioMiniatura {
  col_id: number;
  col_nombre: string;
}

interface Props {
  colegios: ColegioMiniatura[];
  cargando: boolean;
  onElegir: (colegio: ColegioMiniatura) => void;
  onOtroColegio: () => void;
}

/**
 * Los colegios en el alcance, con un tap para pasar lista de hoy.
 *
 * Para el coordinador y el propietario que entran a esta pantalla es la vía
 * rápida: la fecha arranca en hoy, el día lo deduce el backend desde la
 * fecha y la lista sale de las asignaciones vigentes.
 */
const MiDiaEntrenadores = ({ colegios, cargando, onElegir, onOtroColegio }: Props) => {
  return (
    <div className="space-y-3">
      {cargando ? (
        <p className="py-6 text-center text-muted-foreground">Cargando tus colegios…</p>
      ) : colegios.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center">
          <CalendarClock className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
          <p className="text-base">No hay colegios en tu alcance.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {colegios.map((colegio) => (
            <li key={colegio.col_id}>
              <button
                type="button"
                onClick={() => onElegir(colegio)}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:border-primary hover:bg-accent sm:p-4"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground sm:h-12 sm:w-12">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold sm:text-base">
                    {colegio.col_nombre}
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-sm">Pasar lista de hoy</div>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-1">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full sm:h-10"
          onClick={onOtroColegio}
        >
          Otra fecha o colegio
        </Button>
      </div>
    </div>
  );
};

export default MiDiaEntrenadores;
