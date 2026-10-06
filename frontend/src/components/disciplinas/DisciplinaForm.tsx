import { useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
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
import { useActualizarDisciplina, useImpactoDisciplina } from '@/hooks/useDisciplinas';
import type { Disciplina, Franja } from '@/api/disciplinas';
import { problemaDeHorarios } from '@/lib/horarios';
import HorariosEditor from './HorariosEditor';

interface Props {
  disciplina: Disciplina;
  onSuccess: () => void;
  onCancel: () => void;
}

const aFranjas = (d: Disciplina): Franja[] =>
  d.horarios.map((h) => ({ dia_id: h.dia_id, inicio: h.inicio, fin: h.fin }));

/**
 * Edición de una disciplina: colegio, actividad y sus días con su hora.
 *
 * Los horarios se pueden cambiar aunque tenga historia —los horarios cambian
 * de verdad— y se avisa antes. Lo que el backend no deja es que el cambio
 * cruce a un alumno o a un entrenador con su otra disciplina: entonces
 * responde 409 con los nombres, y el aviso los enseña.
 */
const DisciplinaForm = ({ disciplina, onSuccess, onCancel }: Props) => {
  const { toast } = useToast();
  const colegios = useColegios({ limit: 200, orden: 'nombre' });
  const actividades = useActividades({ limit: 200, orden: 'nombre' });
  const actualizar = useActualizarDisciplina();

  const [colId, setColId] = useState(String(disciplina.col_id));
  const [actId, setActId] = useState(String(disciplina.act_id));
  const [horarios, setHorarios] = useState<Franja[]>(() => aFranjas(disciplina));

  const cambiaHorario = JSON.stringify(horarios) !== JSON.stringify(aFranjas(disciplina));

  const tieneHistorial = disciplina.alumnos > 0 || disciplina.evaluaciones > 0;

  /*
   * Con historia —inscripciones de cualquier época, entrenadores, evaluaciones
   * o asistencias— el colegio y la actividad no se tocan: cambiarlos movería
   * toda esa historia a otra disciplina. El backend lo rechaza igual (409);
   * aquí se bloquea antes para no dejar escoger algo que no se va a guardar.
   * Mientras se consulta, también bloqueado.
   */
  const impacto = useImpactoDisciplina(disciplina.colacthor_id);
  const identidadFija = impacto.data ? !impacto.data.puedeEliminar : true;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();

    const problema = problemaDeHorarios(horarios);
    if (problema) {
      toast({ title: problema, variant: 'destructive' });
      return;
    }

    try {
      await actualizar.mutateAsync({
        id: disciplina.colacthor_id,
        datos: {
          ...(identidadFija ? {} : { col_id: Number(colId), act_id: Number(actId) }),
          ...(cambiaHorario ? { horarios } : {}),
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
          <Select value={colId} onValueChange={setColId} disabled={identidadFija}>
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
          <Select value={actId} onValueChange={setActId} disabled={identidadFija}>
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
      </div>

      <HorariosEditor value={horarios} onChange={setHorarios} />

      {identidadFija && impacto.data && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" />
          El colegio y la actividad no se pueden cambiar porque esta disciplina ya tiene historia
          (alumnos, entrenadores o asistencias). Si cambian, crea una disciplina nueva y da de baja
          esta.
        </p>
      )}

      {cambiaHorario && tieneHistorial && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            Esta disciplina tiene {disciplina.alumnos} alumnos
            {disciplina.evaluaciones > 0 && ` y ${disciplina.evaluaciones} evaluaciones`}. Cambiar
            los días o las horas no mueve las asistencias ya registradas: quedan con su fecha. Si
            el cambio cruza a algún alumno o entrenador con su otra disciplina, no se guardará y
            te dirá a quién.
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
