import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pin, X } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';

/**
 * Tarjeta compacta que despliega su detalle.
 *
 * Pedido del cliente al probar la Fase 8: las listas de Actividades y
 * Disciplinas enseñan **solo el nombre** (y la hora) con su botón de acciones;
 * al pasar el ratón se despliega la información, y al hacer clic se queda
 * abierta.
 *
 * El detalle sale en un panel flotante pegado a la tarjeta y no dentro de la
 * rejilla: si se expandiera en su sitio, cada paso del ratón empujaría a las
 * tarjetas de debajo y la lista no pararía de saltar. Solo una queda fijada a
 * la vez —fijar otra suelta la anterior— para que no se apilen paneles.
 *
 * En el teléfono no hay "pasar por encima": el toque la fija y otro toque la
 * suelta.
 */

interface ContextoGrupo {
  fijada: string | null;
  fijar: (id: string | null) => void;
}

const Grupo = createContext<ContextoGrupo | null>(null);

/** Envuelve una lista para que solo una tarjeta quede fijada a la vez. */
export function GrupoDesplegable({ children }: { children: ReactNode }) {
  const [fijada, fijar] = useState<string | null>(null);
  return <Grupo.Provider value={{ fijada, fijar }}>{children}</Grupo.Provider>;
}

interface Props {
  /** Único dentro del grupo. */
  id: string;
  titulo: string;
  /** Segunda línea corta: la hora de una disciplina, por ejemplo. */
  subtitulo?: ReactNode;
  /** El botón de acciones; sus clics no fijan la tarjeta. */
  acciones?: ReactNode;
  /** Borde de aviso (ámbar fuerte): una disciplina sin entrenador. */
  aviso?: boolean;
  /** De baja: borde discontinuo y fondo apagado. */
  apagada?: boolean;
  /** Texto pequeño junto al título: "De baja". */
  etiqueta?: ReactNode;
  children: ReactNode;
}

const TarjetaDesplegable = ({
  id,
  titulo,
  subtitulo,
  acciones,
  aviso = false,
  apagada = false,
  etiqueta,
  children,
}: Props) => {
  const grupo = useContext(Grupo);
  const [fijadaSola, setFijadaSola] = useState(false);
  const [encima, setEncima] = useState(false);

  const fijada = grupo ? grupo.fijada === id : fijadaSola;
  const ponerFijada = (valor: boolean) => {
    if (grupo) grupo.fijar(valor ? id : null);
    else setFijadaSola(valor);
  };

  return (
    <HoverCard open={encima || fijada} onOpenChange={setEncima} openDelay={150} closeDelay={120}>
      <HoverCardTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={encima || fijada}
          aria-label={`${titulo}: ${fijada ? 'ocultar' : 'ver'} detalle`}
          onClick={() => ponerFijada(!fijada)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              ponerFijada(!fijada);
            }
            if (e.key === 'Escape') ponerFijada(false);
          }}
          className={cn(
            'flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            aviso && 'border-2 border-amber-500 dark:border-amber-400',
            apagada && 'border-dashed bg-muted/40',
            fijada && 'ring-2 ring-primary/40',
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-medium leading-tight">
              <span className="break-words">{titulo}</span>
              {fijada && (
                <Pin className="h-3 w-3 flex-shrink-0 text-muted-foreground" aria-hidden />
              )}
            </p>
            {(subtitulo || etiqueta) && (
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {subtitulo}
                {etiqueta}
              </p>
            )}
          </div>
          {acciones && (
            // El menú de acciones no fija ni suelta la tarjeta.
            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              {acciones}
            </div>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)] p-0"
        // Tocar dentro del panel lo fija: si no, usar un desplegable de dentro
        // (que se abre fuera del panel) lo cerraría al salir el ratón.
        onPointerDown={() => !fijada && ponerFijada(true)}
        onEscapeKeyDown={() => ponerFijada(false)}
      >
        <div className="flex items-start justify-between gap-2 border-b px-4 py-2">
          <p className="min-w-0 break-words text-sm font-semibold">{titulo}</p>
          {fijada && (
            <button
              type="button"
              onClick={() => ponerFijada(false)}
              className="-mr-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Cerrar detalle"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="space-y-3 px-4 py-3 text-sm">{children}</div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default TarjetaDesplegable;
