import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useColegios } from '@/hooks/useColegios';
import { useActividades } from '@/hooks/useActividades';
import { useCrearDisciplina } from '@/hooks/useDisciplinas';
import type { Franja } from '@/api/disciplinas';
import { problemaDeHorarios } from '@/lib/horarios';
import HorariosEditor from './HorariosEditor';

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Alta de una disciplina: colegio, actividad y sus días, cada uno con su hora.
 *
 * "Fútbol en Quitumbe, lunes 15:00 y miércoles 16:00" es UNA disciplina: el
 * alumno se inscribe una vez, se cobra una vez y tiene un entrenador. Si se
 * pisa con otro grupo de la misma actividad en el colegio, no entra y el
 * mensaje dice qué día.
 */
const NuevaDisciplinaForm = ({ onSuccess, onCancel }: Props) => {
  const { toast } = useToast();
  // El selector necesita el catálogo completo, no una página.
  const colegios = useColegios({ limit: 200, orden: 'nombre' });
  const actividades = useActividades({ limit: 200, orden: 'nombre' });
  const crear = useCrearDisciplina();

  const [colId, setColId] = useState('');
  const [actId, setActId] = useState('');
  const [horarios, setHorarios] = useState<Franja[]>([]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!colId || !actId) {
      toast({ title: 'Elige colegio y actividad', variant: 'destructive' });
      return;
    }
    const problema = problemaDeHorarios(horarios);
    if (problema) {
      toast({ title: problema, variant: 'destructive' });
      return;
    }

    try {
      await crear.mutateAsync({ col_id: Number(colId), act_id: Number(actId), horarios });
      onSuccess();
    } catch {
      // El hook ya muestra el motivo; el formulario queda abierto.
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="col_id">Colegio *</Label>
          <Select value={colId} onValueChange={setColId}>
            <SelectTrigger id="col_id" className="h-11 sm:h-10">
              <SelectValue placeholder="Elige un colegio" />
            </SelectTrigger>
            <SelectContent>
              {(colegios.data?.items ?? []).map((c) => (
                <SelectItem key={c.col_id} value={String(c.col_id)}>
                  {c.col_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="act_id">Actividad *</Label>
          <Select value={actId} onValueChange={setActId}>
            <SelectTrigger id="act_id" className="h-11 sm:h-10">
              <SelectValue placeholder="Elige una actividad" />
            </SelectTrigger>
            <SelectContent>
              {(actividades.data?.items ?? []).map((a) => (
                <SelectItem key={a.act_id} value={String(a.act_id)}>
                  {a.act_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <HorariosEditor value={horarios} onChange={setHorarios} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={crear.isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="brand" disabled={crear.isPending}>
          {crear.isPending ? 'Creando…' : 'Crear disciplina'}
        </Button>
      </div>
    </form>
  );
};

export default NuevaDisciplinaForm;
