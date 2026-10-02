import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAsignarDisciplina, useEntrenadores } from '@/hooks/useEntrenadores';
import type { Disciplina } from '@/api/disciplinas';

interface Props {
  disciplina: Disciplina;
}

/**
 * Asignar entrenador desde la propia disciplina.
 *
 * Pedido del cliente al probar la Fase 8: a una disciplina sin entrenador se le
 * puede poner uno desde Disciplinas, sin ir a Entrenadores. Es **el mismo
 * flujo**: la misma llamada (`POST /entrenadores/:id/asignaciones`) con las
 * mismas reglas del backend —entrenador activo y con el rol, disciplina activa
 * y dentro del alcance de quien asigna— y queda en la misma auditoría.
 *
 * Primero salen quienes ya dan clase en ese colegio, que es a quien se suele
 * buscar; después el resto.
 */
const AsignarEntrenadorRapido = ({ disciplina }: Props) => {
  const [elegido, setElegido] = useState('');
  const entrenadores = useEntrenadores({ page: 1, limit: 200, estado: 1, orden: 'nombre' });
  const asignar = useAsignarDisciplina();

  const todos = entrenadores.data?.items ?? [];
  const delColegio = todos.filter((e) => e.colegios.some((c) => c.col_id === disciplina.col_id));
  const resto = todos.filter((e) => !e.colegios.some((c) => c.col_id === disciplina.col_id));

  return (
    <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/5 p-3">
      <p className="text-xs font-medium">Asignar entrenador</p>
      <Select value={elegido} onValueChange={setElegido}>
        <SelectTrigger className="h-10" aria-label="Entrenador">
          <SelectValue placeholder={entrenadores.isLoading ? 'Cargando…' : 'Elige un entrenador'} />
        </SelectTrigger>
        <SelectContent>
          {delColegio.length > 0 && (
            <SelectGroup>
              <SelectLabel>Ya dan clase en {disciplina.col_nombre}</SelectLabel>
              {delColegio.map((e) => (
                <SelectItem key={e.ent_id} value={String(e.ent_id)}>
                  {e.usu_nombre} · {e.disciplinas}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {resto.length > 0 && (
            <SelectGroup>
              <SelectLabel>
                {delColegio.length > 0 ? 'Otros entrenadores' : 'Entrenadores'}
              </SelectLabel>
              {resto.map((e) => (
                <SelectItem key={e.ent_id} value={String(e.ent_id)}>
                  {e.usu_nombre} · {e.disciplinas}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">El número es cuántas disciplinas da ya.</p>
      <Button
        variant="brand"
        size="sm"
        className="w-full"
        disabled={!elegido || asignar.isPending}
        onClick={async () => {
          try {
            await asignar.mutateAsync({
              id: Number(elegido),
              colacthorId: disciplina.colacthor_id,
            });
            setElegido('');
          } catch {
            // El hook ya muestra el motivo.
          }
        }}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        {asignar.isPending ? 'Asignando…' : 'Asignar'}
      </Button>
    </div>
  );
};

export default AsignarEntrenadorRapido;
