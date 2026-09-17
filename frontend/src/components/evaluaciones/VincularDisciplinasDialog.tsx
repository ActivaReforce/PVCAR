import { useEffect, useMemo, useState } from 'react';
import { Info, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  useDisciplinasDeEvaluacion,
  useGuardarDisciplinasDeEvaluacion,
} from '@/hooks/useEvaluaciones';
import type { Evaluacion } from '@/api/evaluaciones';

interface Props {
  evaluacion: Evaluacion | null;
  onClose: () => void;
}

const sinTildes = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Vincular una evaluación a disciplinas.
 *
 * Es la operación con más consecuencias del módulo, y aquí se dicen antes de
 * ejecutarlas:
 *
 * - **Marcar** una disciplina crea una evaluación pendiente para cada alumno
 *   inscrito. En el sistema viejo eran dos peticiones por alumno desde el
 *   navegador, en un bucle, y los fallos se tragaban con un `console.error`.
 * - **Desmarcar** ya no borra nada: desactiva las que siguen pendientes y
 *   **conserva las notas ya puestas**. Antes hacía un `DELETE` de todas las
 *   pendientes de esa disciplina, evaluadas incluidas, sin avisar.
 *
 * La lista de disponibles viene ya filtrada por el alcance, y al guardar el
 * backend solo desvincula lo que el actor puede ver: un coordinador no puede
 * quitar, sin querer, las disciplinas de otro colegio que ni siquiera ve.
 */
const VincularDisciplinasDialog = ({ evaluacion, onClose }: Props) => {
  const [busqueda, setBusqueda] = useState('');
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());

  const datos = useDisciplinasDeEvaluacion(evaluacion?.eva_id ?? null);
  const guardar = useGuardarDisciplinasDeEvaluacion();

  /** El estado arranca en lo que hay vinculado; el diálogo edita esa selección. */
  useEffect(() => {
    if (datos.data) {
      setElegidas(new Set(datos.data.vinculadas.map((v) => v.colacthor_id)));
    }
  }, [datos.data]);

  const todas = useMemo(() => {
    if (!datos.data) return [];
    const vinculadas = datos.data.vinculadas.map((v) => ({
      colacthor_id: v.colacthor_id,
      col_nombre: v.col_nombre,
      act_nombre: v.act_nombre,
      dia_nombre: v.dia_nombre,
      hora: v.colacthor_hora_inicio,
      alumnos: v.alumnos,
      evaluados: v.evaluados,
      estuvo: false,
    }));
    const disponibles = datos.data.disponibles.map((d) => ({
      colacthor_id: d.colacthor_id,
      col_nombre: d.col_nombre,
      act_nombre: d.act_nombre,
      dia_nombre: d.dia_nombre,
      hora: d.colacthor_hora_inicio,
      alumnos: d.alumnos,
      evaluados: 0,
      estuvo: d.estuvo,
    }));
    return [...vinculadas, ...disponibles].sort(
      (a, b) =>
        a.col_nombre.localeCompare(b.col_nombre) || a.act_nombre.localeCompare(b.act_nombre),
    );
  }, [datos.data]);

  const filtradas = useMemo(() => {
    const texto = sinTildes(busqueda.trim());
    if (!texto) return todas;
    return todas.filter(
      (d) => sinTildes(d.act_nombre).includes(texto) || sinTildes(d.col_nombre).includes(texto),
    );
  }, [todas, busqueda]);

  const originales = new Set((datos.data?.vinculadas ?? []).map((v) => v.colacthor_id));

  /** Lo que cambia, para poder avisar antes de guardar. */
  const aVincular = [...elegidas].filter((id) => !originales.has(id));
  const aDesvincular = [...originales].filter((id) => !elegidas.has(id));

  const alumnosNuevos = aVincular.reduce(
    (suma, id) => suma + (todas.find((d) => d.colacthor_id === id)?.alumnos ?? 0),
    0,
  );
  const notasEnJuego = aDesvincular.reduce(
    (suma, id) => suma + (todas.find((d) => d.colacthor_id === id)?.evaluados ?? 0),
    0,
  );

  const alternar = (colacthorId: number) => {
    setElegidas((previas) => {
      const siguiente = new Set(previas);
      if (siguiente.has(colacthorId)) siguiente.delete(colacthorId);
      else siguiente.add(colacthorId);
      return siguiente;
    });
  };

  const confirmar = async () => {
    if (!evaluacion) return;
    try {
      await guardar.mutateAsync({ id: evaluacion.eva_id, colacthorIds: [...elegidas] });
      onClose();
    } catch {
      // El hook ya enseña el motivo.
    }
  };

  return (
    <Dialog open={Boolean(evaluacion)} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="break-words text-lg sm:text-xl">
            Disciplinas de {evaluacion?.eva_titulo}
          </DialogTitle>
          <DialogDescription>
            Marca las disciplinas en las que se aplica. Al marcar una, sus alumnos pasan a la lista
            de por evaluar.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por actividad o colegio…"
            className="h-11 pl-10 sm:h-10"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {datos.isLoading && (
            <p className="py-8 text-center text-muted-foreground">Cargando disciplinas…</p>
          )}

          {datos.data && filtradas.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              No hay disciplinas activas dentro de tu alcance.
            </p>
          )}

          <ul className="divide-y">
            {filtradas.map((d) => (
              <li key={d.colacthor_id} className="flex items-start gap-3 py-3">
                <Checkbox
                  id={`disc-${d.colacthor_id}`}
                  checked={elegidas.has(d.colacthor_id)}
                  onCheckedChange={() => alternar(d.colacthor_id)}
                  className="mt-1"
                />
                <label htmlFor={`disc-${d.colacthor_id}`} className="min-w-0 flex-1 cursor-pointer">
                  <div className="truncate font-medium">{d.act_nombre}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {d.col_nombre} · {d.dia_nombre} {d.hora ?? ''} · {d.alumnos} alumno
                    {d.alumnos === 1 ? '' : 's'}
                  </div>
                  {d.evaluados > 0 && (
                    <div className="text-xs text-emerald-700 dark:text-emerald-400">
                      {d.evaluados} ya evaluado{d.evaluados === 1 ? '' : 's'}
                    </div>
                  )}
                  {d.estuvo && (
                    <div className="text-xs text-muted-foreground">
                      Estuvo vinculada: al marcarla se reactiva
                    </div>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>

        {(aVincular.length > 0 || aDesvincular.length > 0) && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="mb-1 flex items-center gap-2 font-medium">
              <Info className="h-4 w-4 flex-shrink-0" />
              Al guardar:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {aVincular.length > 0 && (
                <li>
                  Se vinculan <strong>{aVincular.length}</strong> disciplina(s) y{' '}
                  <strong>{alumnosNuevos}</strong> alumno(s) pasan a por evaluar.
                </li>
              )}
              {aDesvincular.length > 0 && (
                <li>
                  Se desvinculan <strong>{aDesvincular.length}</strong>. Sus pendientes se
                  desactivan
                  {notasEnJuego > 0 ? (
                    <>
                      {' '}
                      y las <strong>{notasEnJuego}</strong> nota(s) ya puestas{' '}
                      <strong>se conservan</strong>.
                    </>
                  ) : (
                    '.'
                  )}
                </li>
              )}
            </ul>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" className="h-11 sm:h-10" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="brand"
            className="h-11 sm:h-10"
            onClick={confirmar}
            disabled={guardar.isPending || (aVincular.length === 0 && aDesvincular.length === 0)}
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VincularDisciplinasDialog;
