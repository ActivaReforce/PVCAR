import { CalendarClock, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Disciplina, HorarioDisciplina } from '@/api/disciplinas';

interface Props {
  disciplinas: Disciplina[];
  /** `dia_id` de hoy: solo se pintan los horarios de ese día. */
  diaHoy: number;
  /** La hora del servidor en Ecuador, para marcar la clase que está pasando ahora. */
  ahora: string;
  cargando: boolean;
  onElegir: (disciplina: Disciplina, horario: HorarioDisciplina) => void;
  onOtraClase: () => void;
}

/** `HH:MM` en minutos desde medianoche, para comparar sin convertir fechas. */
const minutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Las clases de hoy del usuario, con un tap para entrar a pasar lista.
 *
 * Cada tarjeta es una **franja horaria de hoy**: una disciplina Lun+Mié
 * que caiga en lunes sale una sola vez (la del lunes), aunque el backend
 * devuelva la disciplina con sus dos horarios. Si el día tuviera dos
 * franjas distintas (raro con la v2 de disciplinas), aparece dos veces.
 */
const MiDiaAlumnos = ({ disciplinas, diaHoy, ahora, cargando, onElegir, onOtraClase }: Props) => {
  const franjas = disciplinas.flatMap((d) =>
    d.horarios
      .filter((h) => h.dia_id === diaHoy)
      .map((h) => ({ disciplina: d, horario: h })),
  );
  const ordenadas = [...franjas].sort(
    (a, b) => minutos(a.horario.inicio) - minutos(b.horario.inicio),
  );

  const ahoraMin = minutos(ahora);

  return (
    <div className="space-y-3">
      {cargando ? (
        <p className="py-6 text-center text-muted-foreground">Cargando tus clases de hoy…</p>
      ) : ordenadas.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center">
          <CalendarClock className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
          <p className="text-base">Hoy no hay clases en tu alcance.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Elige otra fecha o disciplina para pasar lista.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {ordenadas.map(({ disciplina, horario }) => {
            const inicioMin = minutos(horario.inicio);
            const finMin = minutos(horario.fin);
            const enCurso = ahoraMin >= inicioMin && ahoraMin < finMin;
            const yaPasada = ahoraMin >= finMin;

            return (
              <li key={`${disciplina.colacthor_id}:${horario.dia_id}`}>
                <button
                  type="button"
                  onClick={() => onElegir(disciplina, horario)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:border-primary hover:bg-accent sm:p-4 ${
                    enCurso
                      ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-950/40'
                      : ''
                  }`}
                >
                  <div
                    className="flex h-11 w-16 flex-shrink-0 flex-col items-center justify-center rounded-md border text-xs font-medium leading-none sm:h-12 sm:w-20 sm:text-sm"
                    style={
                      disciplina.act_color
                        ? { borderColor: disciplina.act_color, color: disciplina.act_color }
                        : undefined
                    }
                  >
                    <span>{horario.inicio}</span>
                    <span className="mt-0.5 text-muted-foreground">{horario.fin}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold sm:text-base">
                      {disciplina.act_nombre}
                    </div>
                    <div className="truncate text-xs text-muted-foreground sm:text-sm">
                      {disciplina.col_nombre}
                    </div>
                    {enCurso && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                        <Clock className="h-3 w-3" />
                        <span>En curso</span>
                      </div>
                    )}
                    {yaPasada && (
                      <div className="mt-0.5 text-xs text-muted-foreground">Ya pasó</div>
                    )}
                  </div>

                  <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pt-1">
        <Button type="button" variant="outline" className="h-11 w-full sm:h-10" onClick={onOtraClase}>
          Otra clase o fecha
        </Button>
      </div>
    </div>
  );
};

export default MiDiaAlumnos;
