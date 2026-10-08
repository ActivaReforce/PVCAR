import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface Props {
  titulo: string;
  descripcion: ReactNode;
  children: ReactNode;
}

/**
 * Tarjeta desplegable de la pestaña "Más" de Inscripciones (cliente,
 * 2026-10-07). Cerrada por defecto: se abre la que se va a editar.
 */
const TarjetaConfig = ({ titulo, descripcion, children }: Props) => {
  const [abierta, setAbierta] = useState(false);

  return (
    <Collapsible open={abierta} onOpenChange={setAbierta} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="flex min-h-11 w-full items-start gap-3 rounded-lg p-4 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>
        </div>
        <ChevronDown
          className={cn('mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform', abierta && 'rotate-180')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t p-4">{children}</CollapsibleContent>
    </Collapsible>
  );
};

export default TarjetaConfig;
