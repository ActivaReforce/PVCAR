import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
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
import { useActualizarDisciplina, useDias } from '@/hooks/useDisciplinas';
import type { Disciplina } from '@/api/disciplinas';

interface Props {
  disciplina: Disciplina;
  onSuccess: () => void;
  onCancel: () => void;
}

const hhmm = (hora: string | null) => hora?.slice(0, 5) ?? '';

/**
 * Edición de una disciplina.
 *
 * Si ya tiene alumnos o evaluaciones, cambiarle el día o la hora reescribe la
 * historia: las asistencias guardan su fecha, pero la sesión a la que
 * pertenecen pasa a ser otra. No se bloquea —los horarios cambian de verdad—
 * pero se avisa antes, que es lo que no hacía el sistema viejo.
 */
const DisciplinaForm = ({ disciplina, onSuccess, onCancel }: Props) => {
  const { toast } = useToast();
  const dias = useDias();
  const colegios = useColegios({ limit: 200, orden: 'nombre' });
  const actividades = useActividades({ limit: 200, orden: 'nombre' });
  const actualizar = useActualizarDisciplina();

  const [colId, setColId] = useState(String(disciplina.col_id));
  const [actId, setActId] = useState(String(disciplina.act_id));
  const [diaId, setDiaId] = useState(String(disciplina.dia_id));
  const [horaInicio, setHoraInicio] = useState(hhmm(disciplina.colacthor_hora_inicio));
  const [horaFin, setHoraFin] = useState(hhmm(disciplina.colacthor_hora_fin));

  const cambiaHorario =
    diaId !== String(disciplina.dia_id) ||
    horaInicio !== hhmm(disciplina.colacthor_hora_inicio) ||
    horaFin !== hhmm(disciplina.colacthor_hora_fin);

  const tieneHistorial = disciplina.alumnos > 0 || disciplina.evaluaciones > 0;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (horaFin <= horaInicio) {
      toast({
        title: 'La hora de fin tiene que ser posterior a la de inicio',
        variant: 'destructive',
      });
      return;
    }

    try {
      await actualizar.mutateAsync({
        id: disciplina.colacthor_id,
        datos: {
          col_id: Number(colId),
          act_id: Number(actId),
          dia_id: Number(diaId),
          colacthor_hora_inicio: horaInicio,
          colacthor_hora_fin: horaFin,
        },
      });
      onSuccess();
    } catch {
      // El hook ya muestra el motivo.
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit_col">Colegio</Label>
          <Select value={colId} onValueChange={setColId}>
            <SelectTrigger id="edit_col" className="h-11 sm:h-10">
              <SelectValue />
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
          <Label htmlFor="edit_act">Actividad</Label>
          <Select value={actId} onValueChange={setActId}>
            <SelectTrigger id="edit_act" className="h-11 sm:h-10">
              <SelectValue />
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

        <div className="space-y-2">
          <Label htmlFor="edit_dia">Día</Label>
          <Select value={diaId} onValueChange={setDiaId}>
            <SelectTrigger id="edit_dia" className="h-11 sm:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(dias.data ?? []).map((d) => (
                <SelectItem key={d.dia_id} value={String(d.dia_id)}>
                  {d.dia_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="edit_inicio">Inicio</Label>
            <Input
              id="edit_inicio"
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="h-11 sm:h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_fin">Fin</Label>
            <Input
              id="edit_fin"
              type="time"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
              className="h-11 sm:h-10"
            />
          </div>
        </div>
      </div>

      {cambiaHorario && tieneHistorial && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            Esta disciplina tiene {disciplina.alumnos} alumnos
            {disciplina.evaluaciones > 0 && ` y ${disciplina.evaluaciones} evaluaciones`}. Cambiar
            el día o la hora no mueve las asistencias ya registradas: quedarán con su fecha
            original pero bajo el horario nuevo.
          </p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={actualizar.isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="brand" disabled={actualizar.isPending}>
          {actualizar.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
};

export default DisciplinaForm;
