import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useCrearDisciplinas, useDias } from '@/hooks/useDisciplinas';

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Alta de disciplinas por lote.
 *
 * Así se crea de verdad: "karate en Quitumbe, lunes y miércoles de 15:00 a
 * 16:00". Se elige colegio, actividad, los días y una franja, y sale una
 * disciplina por día — todas en una transacción. Si una choca con otra
 * existente no entra ninguna, y el mensaje dice cuál.
 */
const DisciplinaLoteForm = ({ onSuccess, onCancel }: Props) => {
  const { toast } = useToast();
  const dias = useDias();
  // El selector necesita el catálogo completo, no una página.
  const colegios = useColegios({ limit: 200, orden: 'nombre' });
  const actividades = useActividades({ limit: 200, orden: 'nombre' });
  const crear = useCrearDisciplinas();

  const [colId, setColId] = useState('');
  const [actId, setActId] = useState('');
  const [diasElegidos, setDiasElegidos] = useState<number[]>([]);
  const [horaInicio, setHoraInicio] = useState('15:00');
  const [horaFin, setHoraFin] = useState('16:00');

  const alternarDia = (diaId: number) =>
    setDiasElegidos((prev) =>
      prev.includes(diaId) ? prev.filter((d) => d !== diaId) : [...prev, diaId],
    );

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!colId || !actId) {
      toast({ title: 'Elige colegio y actividad', variant: 'destructive' });
      return;
    }
    if (diasElegidos.length === 0) {
      toast({ title: 'Elige al menos un día', variant: 'destructive' });
      return;
    }
    if (horaFin <= horaInicio) {
      toast({
        title: 'La hora de fin tiene que ser posterior a la de inicio',
        variant: 'destructive',
      });
      return;
    }

    try {
      await crear.mutateAsync({
        col_id: Number(colId),
        act_id: Number(actId),
        horarios: diasElegidos
          .slice()
          .sort((a, b) => a - b)
          .map((dia_id) => ({
            dia_id,
            colacthor_hora_inicio: horaInicio,
            colacthor_hora_fin: horaFin,
          })),
      });
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

      <div className="space-y-2">
        <Label>Días *</Label>
        <div className="flex flex-wrap gap-2">
          {(dias.data ?? []).map((dia) => {
            const activo = diasElegidos.includes(dia.dia_id);
            return (
              <button
                key={dia.dia_id}
                type="button"
                onClick={() => alternarDia(dia.dia_id)}
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
        <p className="text-xs text-muted-foreground">
          Se creará una disciplina por día, todas con el mismo horario.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hora_inicio">Hora de inicio *</Label>
          <Input
            id="hora_inicio"
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            className="h-11 sm:h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hora_fin">Hora de fin *</Label>
          <Input
            id="hora_fin"
            type="time"
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
            className="h-11 sm:h-10"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={crear.isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="brand" disabled={crear.isPending}>
          {crear.isPending
            ? 'Creando…'
            : `Crear ${diasElegidos.length || ''} ${
                diasElegidos.length === 1 ? 'disciplina' : 'disciplinas'
              }`.trim()}
        </Button>
      </div>
    </form>
  );
};

export default DisciplinaLoteForm;
