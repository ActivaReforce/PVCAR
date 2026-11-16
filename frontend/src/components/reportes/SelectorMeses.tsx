import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NOMBRES_DE_MES } from '@/api/mensualidades';
import { hoyEc } from '@/lib/fecha';
import { cn } from '@/lib/utils';

interface Props {
  /** Meses elegidos, 'YYYY-MM'. Vacío = todo. */
  valor: string[];
  onChange: (meses: string[]) => void;
}

const mesDe = (ano: number, i: number) => `${ano}-${String(i + 1).padStart(2, '0')}`;

/**
 * Elegir uno o varios meses (cliente, 2026-11-16): el año pasado, el actual
 * y el siguiente, que cambian solos con el año. Sin ninguno marcado, "Todo".
 */
const SelectorMeses = ({ valor, onChange }: Props) => {
  const ano = Number(hoyEc().slice(0, 4));
  const anos = [ano - 1, ano, ano + 1];
  const elegidos = new Set(valor);

  const alternar = (m: string) => {
    const nuevo = new Set(elegidos);
    if (nuevo.has(m)) nuevo.delete(m);
    else nuevo.add(m);
    onChange([...nuevo].sort());
  };
  const alternarAno = (a: number) => {
    const delAno = NOMBRES_DE_MES.map((_, i) => mesDe(a, i));
    const todos = delAno.every((m) => elegidos.has(m));
    const nuevo = new Set(elegidos);
    for (const m of delAno) {
      if (todos) nuevo.delete(m);
      else nuevo.add(m);
    }
    onChange([...nuevo].sort());
  };

  const texto =
    valor.length === 0
      ? 'Todo'
      : valor.length === 1
        ? `${NOMBRES_DE_MES[Number(valor[0]!.slice(5, 7)) - 1]} ${valor[0]!.slice(0, 4)}`
        : `${valor.length} meses`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-11 w-full justify-between font-normal sm:h-10" aria-label="Meses">
          <span className="truncate">{texto}</span>
          <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] space-y-3 p-3" align="start">
        <Button
          variant={valor.length === 0 ? 'secondary' : 'ghost'}
          size="sm"
          className="w-full justify-start"
          onClick={() => onChange([])}
        >
          Todo
        </Button>
        {anos.map((a) => (
          <div key={a} className="space-y-1.5">
            <button
              type="button"
              className="text-sm font-semibold hover:underline"
              onClick={() => alternarAno(a)}
              title={`Marcar o quitar todo ${a}`}
            >
              {a}
            </button>
            <div className="grid grid-cols-4 gap-1">
              {NOMBRES_DE_MES.map((nombre, i) => {
                const m = mesDe(a, i);
                const id = `mes-${m}`;
                return (
                  <label
                    key={m}
                    htmlFor={id}
                    className={cn(
                      'flex min-h-9 cursor-pointer items-center gap-1.5 rounded border px-1.5 text-xs',
                      elegidos.has(m) && 'border-primary bg-primary/10',
                    )}
                  >
                    <Checkbox id={id} checked={elegidos.has(m)} onCheckedChange={() => alternar(m)} />
                    {nombre.slice(0, 3)}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export default SelectorMeses;
