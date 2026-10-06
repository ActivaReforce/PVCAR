import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { titularesApi } from '@/api/titulares';
import { elegirTitular, titularElegido } from '@/lib/titular';

const TODOS = 'todos';

/**
 * "De quién ver", para el Asistente o Respaldo que está con varios
 * entrenadores (pedido del cliente, 2026-10-02). Solo aparece con dos o más
 * titulares. Al cambiarlo se recargan todos los datos: el backend recalcula
 * el alcance con el elegido.
 */
const SelectorTitular = () => {
  const queryClient = useQueryClient();
  const [valor, setValor] = useState(() => String(titularElegido() ?? TODOS));
  const titulares = useQuery({
    queryKey: ['me', 'titulares'],
    queryFn: titularesApi.mios,
    staleTime: 5 * 60 * 1000,
  });

  const lista = titulares.data ?? [];

  /*
   * Si lo guardado no es uno de sus titulares (lo soltaron, o lo eligió otra
   * persona en este navegador), se vuelve a "Todos" y se recarga: si no, el
   * backend estrecharía el alcance a alguien que no es suyo y vería vacío.
   */
  useEffect(() => {
    if (!titulares.data) return;
    const guardado = titularElegido();
    if (guardado !== null && !titulares.data.some((t) => t.ent_id === guardado)) {
      elegirTitular(null);
      setValor(TODOS);
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    }
  }, [titulares.data, queryClient]);

  if (lista.length < 2) return null;
  const vigente = lista.some((t) => String(t.ent_id) === valor) ? valor : TODOS;

  const cambiar = (v: string) => {
    setValor(v);
    elegirTitular(v === TODOS ? null : Number(v));
    void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
  };

  return (
    <Select value={vigente} onValueChange={cambiar}>
      <SelectTrigger className="h-9 w-auto max-w-[14rem] gap-2" aria-label="De quién ver">
        <Users className="h-4 w-4 flex-shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>Todos mis entrenadores</SelectItem>
        {lista.map((t) => (
          <SelectItem key={t.ent_id} value={String(t.ent_id)}>
            {t.usu_nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default SelectorTitular;
