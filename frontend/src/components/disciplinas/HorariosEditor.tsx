import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDias } from '@/hooks/useDisciplinas';
import type { Franja } from '@/api/disciplinas';

interface Props {
  value: Franja[];
  onChange: (horarios: Franja[]) => void;
}

/**
 * Los días de una disciplina, cada uno con su hora.
 *
 * Se marcan los días y cada uno trae su fila de horas. Un día nuevo copia la
 * hora del último marcado, así el caso de siempre ("lunes y miércoles de
 * 15:00 a 16:00") sigue siendo dos clics.
 */
const HorariosEditor = ({ value, onChange }: Props) => {
  const dias = useDias();
  const porDia = new Map(value.map((f) => [f.dia_id, f]));

  const alternar = (diaId: number) => {
    if (porDia.has(diaId)) {
      onChange(value.filter((f) => f.dia_id !== diaId));
      return;
    }
    const ultimo = value[value.length - 1];
    const nuevo = { dia_id: diaId, inicio: ultimo?.inicio ?? '15:00', fin: ultimo?.fin ?? '16:00' };
    onChange([...value, nuevo].sort((a, b) => a.dia_id - b.dia_id));
  };

  const cambiar = (diaId: number, campo: 'inicio' | 'fin', hora: string) =>
    onChange(value.map((f) => (f.dia_id === diaId ? { ...f, [campo]: hora } : f)));

  const nombre = (diaId: number) =>
    dias.data?.find((d) => d.dia_id === diaId)?.dia_nombre ?? `Día ${diaId}`;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Días *</Label>
        <div className="flex flex-wrap gap-2">
          {(dias.data ?? []).map((dia) => {
            const activo = porDia.has(dia.dia_id);
            return (
              <button
                key={dia.dia_id}
                type="button"
                onClick={() => alternar(dia.dia_id)}
                aria-pressed={activo}
                className={`min-h-11 rounded-md border px-3 py-2 text-sm transition-colors ${
                  activo
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {dia.dia_nombre}
              </button>
            );
          })}
        </div>
      </div>

      {value.length > 0 && (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs text-muted-foreground">
            Es una sola disciplina: el alumno se inscribe una vez y va todos estos días. Cada día
            puede tener su propia hora.
          </p>
          {value.map((f) => {
            const mal = f.fin <= f.inicio;
            return (
              <div
                key={f.dia_id}
                className="grid grid-cols-[6.5rem_1fr_1fr] items-center gap-2 sm:grid-cols-[8rem_9rem_9rem]"
              >
                <span className="text-sm font-medium">{nombre(f.dia_id)}</span>
                <Input
                  type="time"
                  aria-label={`${nombre(f.dia_id)}, hora de inicio`}
                  value={f.inicio}
                  onChange={(e) => cambiar(f.dia_id, 'inicio', e.target.value)}
                  className="h-11 sm:h-10"
                />
                <Input
                  type="time"
                  aria-label={`${nombre(f.dia_id)}, hora de fin`}
                  aria-invalid={mal}
                  value={f.fin}
                  onChange={(e) => cambiar(f.dia_id, 'fin', e.target.value)}
                  className={`h-11 sm:h-10 ${mal ? 'border-destructive' : ''}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HorariosEditor;
