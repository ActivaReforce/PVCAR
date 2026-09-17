import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import { usePendientes } from '@/hooks/useEvaluaciones';
import { useDisciplinasDeEvaluacion } from '@/hooks/useEvaluaciones';
import type { Evaluacion } from '@/api/evaluaciones';
import EvaluarAlumnoDialog from './EvaluarAlumnoDialog';
import { iniciales } from './metodos';

interface Props {
  /** Las evaluaciones activas que se pueden pasar, ya filtradas por alcance. */
  evaluaciones: Evaluacion[];
}

const TODOS = 'todos';
const PENDIENTE = 6;
const EVALUADO = 7;

/**
 * Evaluar alumnos.
 *
 * Cascada evaluación → disciplina → alumnos, en ese orden y no al revés:
 * el sistema viejo pedía colegio → disciplina → evaluación, o sea tres pasos
 * antes de saber si esa disciplina tenía alguna evaluación vinculada. Como la
 * evaluación ya sabe a qué disciplinas se aplica, empezar por ella quita un
 * filtro entero y no deja llegar a una combinación vacía.
 *
 * El contador de **cuántos faltan** es nuevo: antes no existía en ningún sitio.
 */
const EvaluarAlumnos = ({ evaluaciones }: Props) => {
  const [evaluacionId, setEvaluacionId] = useState<string>('');
  const [disciplinaId, setDisciplinaId] = useState<string>('');
  const [estado, setEstado] = useState(TODOS);
  const [busqueda, setBusqueda] = useState('');
  const [evaluando, setEvaluando] = useState<number | null>(null);

  const conDisciplinas = evaluaciones.filter((e) => e.est_id === 1 && e.disciplinas > 0);

  const disciplinas = useDisciplinasDeEvaluacion(evaluacionId ? Number(evaluacionId) : null);

  /** Al cambiar de evaluación, la disciplina se elige sola si solo hay una. */
  const vinculadas = disciplinas.data?.vinculadas;
  useEffect(() => {
    if (!vinculadas) return;
    if (vinculadas.length === 1) setDisciplinaId(String(vinculadas[0].colacthor_id));
    else if (!vinculadas.some((v) => String(v.colacthor_id) === disciplinaId)) setDisciplinaId('');
  }, [vinculadas, disciplinaId]);

  const lista = usePendientes(
    evaluacionId ? Number(evaluacionId) : null,
    disciplinaId ? Number(disciplinaId) : null,
    estado === TODOS ? undefined : Number(estado),
    busqueda || undefined,
  );

  const alumnos = lista.data?.alumnos ?? [];
  const conteos = lista.data?.conteos;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="evaluacion">Evaluación</Label>
          <Select
            value={evaluacionId}
            onValueChange={(v) => {
              setEvaluacionId(v);
              setDisciplinaId('');
            }}
          >
            <SelectTrigger id="evaluacion" className="h-11 sm:h-10">
              <SelectValue placeholder="Seleccionar evaluación" />
            </SelectTrigger>
            <SelectContent>
              {conDisciplinas.map((e) => (
                <SelectItem key={e.eva_id} value={String(e.eva_id)}>
                  {e.eva_titulo}
                  {e.pendientes > 0 ? ` · ${e.pendientes} por evaluar` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {conDisciplinas.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hay evaluaciones activas vinculadas a ninguna disciplina de tu alcance.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="disciplina">Disciplina</Label>
          <Select value={disciplinaId} onValueChange={setDisciplinaId} disabled={!evaluacionId}>
            <SelectTrigger id="disciplina" className="h-11 sm:h-10">
              <SelectValue
                placeholder={evaluacionId ? 'Seleccionar disciplina' : 'Elige una evaluación'}
              />
            </SelectTrigger>
            <SelectContent>
              {(vinculadas ?? []).map((d) => (
                <SelectItem key={d.colacthor_id} value={String(d.colacthor_id)}>
                  {d.act_nombre} · {d.col_nombre}
                  {d.pendientes > 0 ? ` · ${d.pendientes} faltan` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="estado-alumno">Estado</Label>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger id="estado-alumno" className="h-11 sm:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              <SelectItem value={String(PENDIENTE)}>Por evaluar</SelectItem>
              <SelectItem value={String(EVALUADO)}>Evaluados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!disciplinaId && (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="text-lg">Elige una evaluación y una disciplina</p>
        </div>
      )}

      {disciplinaId && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {conteos && (
              <p className="text-sm text-muted-foreground">
                {conteos.total} alumno{conteos.total === 1 ? '' : 's'} ·{' '}
                <span
                  className={
                    conteos.pendientes > 0 ? 'text-amber-700 dark:text-amber-400' : undefined
                  }
                >
                  {conteos.pendientes} por evaluar
                </span>{' '}
                · {conteos.evaluados} evaluados · sobre {lista.data?.eva_puntaje_total ?? 0} pts
              </p>
            )}

            <DebouncedSearchInput
              placeholder="Buscar alumno…"
              value={busqueda}
              onChange={setBusqueda}
              className="w-full sm:w-64"
            />
          </div>

          {lista.isLoading && (
            <p className="py-12 text-center text-muted-foreground">Cargando alumnos…</p>
          )}

          {lista.isError && (
            <p className="py-12 text-center text-destructive">{(lista.error as Error).message}</p>
          )}

          {lista.data && alumnos.length === 0 && (
            <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
              <p className="text-lg">No hay alumnos que mostrar</p>
            </div>
          )}

          {alumnos.length > 0 && (
            <ul className="divide-y overflow-hidden rounded-lg border">
              {alumnos.map((a) => {
                const evaluado = a.est_id === EVALUADO;
                return (
                  <li
                    key={a.evaninopen_id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={a.nino_foto_url ?? undefined} alt="" />
                        <AvatarFallback>{iniciales(a.nino_nombre)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-medium" title={a.nino_nombre}>
                          {a.nino_nombre}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">
                          {a.catninograd_nombre ?? 'Sin grado'}
                          {evaluado && a.evaluado_por && ` · evaluado por ${a.evaluado_por}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:flex-shrink-0">
                      {evaluado ? (
                        <Badge variant="default">
                          {a.puntaje} / {lista.data?.eva_puntaje_total ?? 0} pts
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {a.intentos_registrados > 0 ? 'A medias' : 'Por evaluar'}
                        </Badge>
                      )}

                      <Button
                        variant={evaluado ? 'outline' : 'brand'}
                        className="h-11 flex-1 sm:h-10 sm:flex-none"
                        onClick={() => setEvaluando(a.evaninopen_id)}
                      >
                        {evaluado ? 'Ver o corregir' : 'Evaluar'}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <EvaluarAlumnoDialog evaninopenId={evaluando} onClose={() => setEvaluando(null)} />
    </div>
  );
};

export default EvaluarAlumnos;
