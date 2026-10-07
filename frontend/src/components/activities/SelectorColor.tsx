import { Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { COLORES_ACTIVIDAD } from '@/lib/colores';
import { cn } from '@/lib/utils';

interface Props {
  valor: string | null;
  onChange: (clave: string | null) => void;
}

/**
 * El color de la actividad: diez tonos pastel y "Sin color". Tiñe su tarjeta
 * en Actividades y las de sus disciplinas.
 */
const SelectorColor = ({ valor, onChange }: Props) => {
  const elegido = COLORES_ACTIVIDAD.find((c) => c.clave === valor);
  return (
    <div className="space-y-2">
      <Label id="act_color">
        Color <span className="font-normal text-muted-foreground">· {elegido?.nombre ?? 'Sin color'}</span>
      </Label>
      <div role="radiogroup" aria-labelledby="act_color" className="flex flex-wrap gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={valor === null}
          aria-label="Sin color"
          title="Sin color"
          onClick={() => onChange(null)}
          className={cn(
            'relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 bg-card',
            valor === null && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
          )}
        >
          <span className="h-0.5 w-5 rotate-45 bg-muted-foreground/50" aria-hidden />
        </button>
        {COLORES_ACTIVIDAD.map((c) => (
          <button
            key={c.clave}
            type="button"
            role="radio"
            aria-checked={valor === c.clave}
            aria-label={c.nombre}
            title={c.nombre}
            onClick={() => onChange(c.clave)}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full border border-black/10 dark:border-white/10',
              c.muestra,
              valor === c.clave && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
            )}
          >
            {valor === c.clave && <Check className="h-4 w-4 text-foreground" aria-hidden />}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SelectorColor;
