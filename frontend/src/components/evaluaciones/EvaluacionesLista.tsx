import { Link2, Pencil, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import type { Evaluacion } from '@/api/evaluaciones';

interface Props {
  evaluaciones: Evaluacion[];
  onEditar: (e: Evaluacion) => void;
  onVincular: (e: Evaluacion) => void;
  onBaja: (e: Evaluacion) => void;
  onReactivar: (e: Evaluacion) => void;
  onEliminar: (e: Evaluacion) => void;
}

/** Misma rejilla en la cabecera y en cada fila. */
const REJILLA =
  'grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_6rem_7rem_9rem_11rem] lg:items-center lg:gap-4';

/**
 * Lista de evaluaciones.
 *
 * Un solo markup: columnas en escritorio, tarjeta apilada en el teléfono.
 *
 * La columna que antes no existía es **"por evaluar"**: el sistema viejo no
 * decía en ningún sitio cuántos alumnos quedaban pendientes, así que la única
 * forma de saberlo era entrar disciplina por disciplina. Hoy en `PVCAR_Dev` son
 * 1 058 pendientes repartidos entre tres evaluaciones.
 */
const EvaluacionesLista = ({
  evaluaciones,
  onEditar,
  onVincular,
  onBaja,
  onReactivar,
  onEliminar,
}: Props) => {
  if (evaluaciones.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-lg">No hay evaluaciones que mostrar</p>
        <p className="mt-2 text-sm">Ajusta los filtros o crea la primera.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div
        className={`${REJILLA} hidden bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground lg:grid`}
      >
        <div>Evaluación</div>
        <div>Categoría</div>
        <div>Puntaje</div>
        <div>Disciplinas</div>
        <div>Por evaluar</div>
        <div>Acciones</div>
      </div>

      <ul className="divide-y">
        {evaluaciones.map((e) => {
          const activa = e.est_id === 1;
          return (
            <li key={e.eva_id} className={`${REJILLA} px-4 py-3`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium" title={e.eva_titulo}>
                    {e.eva_titulo}
                  </span>
                  {!activa && <Badge variant="secondary">De baja</Badge>}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {e.parametros === 0 ? (
                    <span className="text-amber-700 dark:text-amber-400">
                      Sin parámetros: configúralos antes de vincularla
                    </span>
                  ) : (
                    `${e.parametros} parámetro${e.parametros === 1 ? '' : 's'} · creada por ${e.creador}`
                  )}
                </div>
              </div>

              <div className="min-w-0 truncate text-sm" title={e.eva_categoria ?? ''}>
                {e.eva_categoria ?? '—'}
              </div>

              <div className="text-sm">
                <strong>{e.eva_puntaje_total}</strong> pts
              </div>

              <div className="text-sm">
                {e.disciplinas > 0 ? (
                  `${e.disciplinas} vinculada${e.disciplinas === 1 ? '' : 's'}`
                ) : (
                  <span className="text-muted-foreground">Sin vincular</span>
                )}
              </div>

              <div className="text-sm">
                {e.pendientes > 0 ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    <strong>{e.pendientes}</strong> por evaluar
                  </span>
                ) : e.evaluados > 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {e.evaluados} evaluado{e.evaluados === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                {e.pendientes > 0 && e.evaluados > 0 && (
                  <span className="text-muted-foreground"> · {e.evaluados} listos</span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <ConditionalAction module="evaluaciones" action="editar">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 lg:h-9 lg:w-9"
                    onClick={() => onEditar(e)}
                    title="Editar y configurar parámetros"
                    aria-label={`Editar ${e.eva_titulo}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </ConditionalAction>

                <ConditionalAction module="evaluaciones" action="editar">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 lg:h-9 lg:w-9"
                    onClick={() => onVincular(e)}
                    title="Vincular a disciplinas"
                    aria-label={`Vincular ${e.eva_titulo} a disciplinas`}
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                </ConditionalAction>

                {activa ? (
                  <ConditionalAction module="evaluaciones" action="editar">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-destructive hover:text-destructive lg:h-9 lg:w-9"
                      onClick={() => onBaja(e)}
                      title="Dar de baja"
                      aria-label={`Dar de baja ${e.eva_titulo}`}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </ConditionalAction>
                ) : (
                  <ConditionalAction module="evaluaciones" action="editar">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 lg:h-9 lg:w-9"
                      onClick={() => onReactivar(e)}
                      title="Reactivar"
                      aria-label={`Reactivar ${e.eva_titulo}`}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </ConditionalAction>
                )}

                <ConditionalAction module="evaluaciones" action="eliminar">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-destructive hover:text-destructive lg:h-9 lg:w-9"
                    onClick={() => onEliminar(e)}
                    title="Eliminar permanentemente"
                    aria-label={`Eliminar ${e.eva_titulo}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </ConditionalAction>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default EvaluacionesLista;
