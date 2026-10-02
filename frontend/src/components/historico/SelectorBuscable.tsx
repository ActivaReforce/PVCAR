import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Opcion } from '@/api/historico';

interface Props {
  /** Texto del botón cuando no hay nada elegido: "Todos los colegios". */
  todos: string;
  opciones: Opcion[];
  valor: number | undefined;
  onChange: (valor: number | undefined) => void;
  /** Para el lector de pantalla, que no ve la etiqueta de encima. */
  etiqueta: string;
}

/** Sin tildes ni mayúsculas: "calderon" encuentra "Innova Schools Calderón". */
const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Un desplegable con buscador.
 *
 * Los filtros de Data anterior tienen listas largas —más de cincuenta personas
 * entre entrenadores y quienes registraron asistencia— y un `Select` sin
 * búsqueda obliga a desplazarse por todas.
 */
const SelectorBuscable = ({ todos, opciones, valor, onChange, etiqueta }: Props) => {
  const [abierto, setAbierto] = useState(false);
  const elegido = opciones.find((o) => o.id === valor);

  const elegir = (nuevo: number | undefined) => {
    onChange(nuevo);
    setAbierto(false);
  };

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          aria-label={etiqueta}
          className="h-11 w-full justify-between px-3 font-normal sm:h-10"
        >
          <span className={cn('truncate', !elegido && 'text-muted-foreground')}>
            {elegido?.nombre ?? todos}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
        <Command filter={(valorItem, busqueda) => (normalizar(valorItem).includes(normalizar(busqueda)) ? 1 : 0)}>
          <CommandInput placeholder="Buscar…" />
          <CommandList>
            <CommandEmpty>Nada coincide.</CommandEmpty>
            <CommandGroup>
              <CommandItem value={todos} onSelect={() => elegir(undefined)}>
                <Check className={cn('mr-2 h-4 w-4', valor === undefined ? 'opacity-100' : 'opacity-0')} />
                {todos}
              </CommandItem>
              {opciones.map((o) => (
                /* El id va en el value para que dos nombres iguales no se pisen. */
                <CommandItem key={o.id} value={`${o.nombre} #${o.id}`} onSelect={() => elegir(o.id)}>
                  <Check className={cn('mr-2 h-4 w-4', valor === o.id ? 'opacity-100' : 'opacity-0')} />
                  {o.nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SelectorBuscable;
