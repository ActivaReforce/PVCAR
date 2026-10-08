import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { UserMinus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { AuxiliarDesvinculado } from '@/api/entrenadores';

type Avisar = (lista: AuxiliarDesvinculado[] | undefined) => void;

const AvisoAuxiliaresContext = createContext<Avisar>(() => {});

/**
 * Recordatorio de auxiliares desvinculados (cliente, 2026-10-07).
 *
 * Cuando un entrenador se queda sin ninguna disciplina —reemplazo, quitarle
 * la última, baja de la disciplina o baja de la persona— sus auxiliares se
 * sueltan. No pasan solos al entrenador nuevo: hay que atarlos a mano, y este
 * modal lo recuerda justo después de la acción, sea cual sea la pantalla.
 */
export function AvisoAuxiliaresProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<AuxiliarDesvinculado[]>([]);

  const avisar = useCallback<Avisar>((nuevos) => {
    if (nuevos && nuevos.length > 0) setLista(nuevos);
  }, []);
  const valor = useMemo(() => avisar, [avisar]);

  return (
    <AvisoAuxiliaresContext.Provider value={valor}>
      {children}
      <AlertDialog open={lista.length > 0} onOpenChange={(abierto) => !abierto && setLista([])}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5 shrink-0" />
              {lista.length === 1 ? 'Un auxiliar quedó sin entrenador' : 'Auxiliares sin entrenador'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Su entrenador ya no da ninguna disciplina, así que se desvincularon. Sus asistencias se
              conservan. Si siguen trabajando, átalos a su nuevo entrenador desde Entrenadores → ficha →
              Auxiliares.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-2">
            {lista.map((a) => (
              <li key={`${a.auxiliar}-${a.titular}`} className="rounded-md border p-3 text-sm">
                <p className="font-medium break-words">{a.auxiliar}</p>
                <p className="text-muted-foreground break-words">Era auxiliar de {a.titular}</p>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogAction className="h-11 sm:h-10">Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AvisoAuxiliaresContext.Provider>
  );
}

export function useAvisoAuxiliares(): Avisar {
  return useContext(AvisoAuxiliaresContext);
}
