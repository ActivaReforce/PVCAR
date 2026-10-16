import { Clock, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { METODO, type FichaEvaluacion, type ParametroInput } from '@/api/evaluaciones';
import { useDisciplinasDeEvaluacion } from '@/hooks/useEvaluaciones';
import { METODOS } from './metodos';

interface Props {
  /** Datos ya guardados (`FichaEvaluacion`) o un borrador en memoria. */
  titulo: string;
  descripcion: string;
  categoria: string;
  parametros: ParametroInput[];
  /** Si está, se trae y se muestra la sección de disciplinas vinculadas. */
  evaId?: number | null;
}

const etiquetaOperador = (op: string): string => {
  if (op === '<') return 'menor que';
  if (op === '<=') return 'menor o igual que';
  if (op === '>') return 'mayor que';
  return 'mayor o igual que';
};

/**
 * Vista previa readonly de una evaluación (2026-10-15).
 *
 * Se usa en dos sitios:
 *   - Dentro del formulario de crear/editar, con el borrador en memoria,
 *     para que el usuario vea cómo quedaría antes de guardar.
 *   - En la card de la lista (ojo), con la evaluación ya guardada y una
 *     sección más con sus disciplinas vinculadas.
 */
const EvaluacionPreview = ({ titulo, descripcion, categoria, parametros, evaId }: Props) => {
  const vinculadas = useDisciplinasDeEvaluacion(evaId ?? null);
  const total = parametros.reduce((s, p) => s + (p.evaparam_puntaje || 0), 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="break-words text-lg font-semibold">{titulo || 'Sin título'}</h3>
        {categoria && (
          <Badge variant="outline" className="text-xs">
            {categoria}
          </Badge>
        )}
        {descripcion && (
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {descripcion}
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">
          Parámetros{' '}
          <span className="font-normal text-muted-foreground">· {total} pts en total</span>
        </h4>

        {parametros.length === 0 ? (
          <p className="rounded-md border border-dashed py-4 text-center text-sm text-muted-foreground">
            Sin parámetros configurados.
          </p>
        ) : (
          <ul className="space-y-2">
            {parametros.map((p, i) => {
              const metodo = METODOS[p.evatipometo_id];
              return (
                <li key={p.evaparam_id ?? `p-${i}`} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-medium">
                        {p.evaparam_nombre || `Parámetro ${i + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground">{metodo?.nombre ?? ''}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {p.evaparam_puntaje} pts · {p.evaparam_intentos} intento
                      {p.evaparam_intentos === 1 ? '' : 's'}
                    </Badge>
                  </div>

                  {p.evaparam_nota && (
                    <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs">{p.evaparam_nota}</p>
                  )}

                  {p.evatipometo_id === METODO.TIEMPO && p.rango && (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      <li>
                        0 pts si el tiempo es <strong>{etiquetaOperador(p.rango.evatieran_op_cero)}</strong>{' '}
                        {p.rango.evatieran_tiempo_cero}s.
                      </li>
                      <li>
                        Puntaje completo si es{' '}
                        <strong>{etiquetaOperador(p.rango.evatieran_op_full)}</strong>{' '}
                        {p.rango.evatieran_tiempo_full}s.
                      </li>
                      <li>Entre los dos umbrales, interpolación lineal.</li>
                    </ul>
                  )}

                  {p.evatipometo_id === METODO.ESCALA && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Escala de {p.evaparam_escala_min ?? 0} a {p.evaparam_escala_max ?? 5}: el
                      mínimo vale 0 y el máximo, los {p.evaparam_puntaje} pts del parámetro.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {evaId !== undefined && evaId !== null && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Disciplinas vinculadas</h4>
          {vinculadas.isLoading && (
            <p className="text-sm text-muted-foreground">Cargando disciplinas…</p>
          )}
          {vinculadas.data &&
            (vinculadas.data.vinculadas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no está vinculada a ninguna disciplina.
              </p>
            ) : (
              <ul className="space-y-2">
                {vinculadas.data.vinculadas.map((d) => (
                  <li key={d.colacthor_id} className="rounded-lg border p-3 text-sm">
                    <p className="break-words font-medium">{d.act_nombre}</p>
                    <p className="text-xs text-muted-foreground">{d.col_nombre}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {d.horario_texto && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {d.horario_texto}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" />
                        {d.alumnos} alumno{d.alumnos === 1 ? '' : 's'}
                      </span>
                      {d.evaluados > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {d.evaluados} evaluado{d.evaluados === 1 ? '' : 's'}
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            ))}
        </section>
      )}
    </div>
  );
};

/** Convierte una ficha ya guardada al formato `ParametroInput` para pintarla. */
export function parametrosDeFicha(ficha: FichaEvaluacion): ParametroInput[] {
  return ficha.parametros.map((p) => ({
    evaparam_id: p.evaparam_id,
    evaparam_nombre: p.evaparam_nombre,
    evaparam_nota: p.evaparam_nota ?? '',
    evatipometo_id: p.evatipometo_id,
    evaparam_intentos: p.evaparam_intentos,
    evaparam_puntaje: p.evaparam_puntaje,
    evaparam_escala_min: p.evaparam_escala_min,
    evaparam_escala_max: p.evaparam_escala_max,
    rango: p.rango,
  }));
}

export default EvaluacionPreview;
