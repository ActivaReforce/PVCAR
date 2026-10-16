import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Eye, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { type FichaEvaluacion, type ParametroInput } from '@/api/evaluaciones';
import { useDisciplinasDeEvaluacion } from '@/hooks/useEvaluaciones';
import {
  aIntentoVivo,
  estaRegistrado,
  METODOS,
  puntajeDeParametro,
  vacio,
  type ParametroVivo,
  type Registro,
} from './metodos';
import CamposIntento from './CamposIntento';

interface Props {
  /** Datos ya guardados (`FichaEvaluacion`) o un borrador en memoria. */
  titulo: string;
  descripcion: string;
  categoria: string;
  parametros: ParametroInput[];
  /** Si está, se trae y se muestra la sección de disciplinas vinculadas. */
  evaId?: number | null;
  onCerrar: () => void;
}

/** El borrador trae campos opcionales; el cálculo los quiere explícitos. */
const aVivo = (p: ParametroInput): ParametroVivo => ({
  evatipometo_id: p.evatipometo_id,
  evaparam_intentos: p.evaparam_intentos,
  evaparam_puntaje: p.evaparam_puntaje || 0,
  evaparam_escala_min: p.evaparam_escala_min ?? null,
  evaparam_escala_max: p.evaparam_escala_max ?? null,
  rango: p.rango ?? null,
});

const numeros = (n: number) => Array.from({ length: Math.max(0, n) }, (_, i) => i + 1);

/**
 * Vista previa de una evaluación (2026-10-15; como evaluar, 2026-10-16).
 *
 * Se ve igual que la pantalla de evaluar a un alumno —un parámetro por
 * pantalla, sus intentos con los controles de su método y el puntaje en vivo—
 * para que quien la arma vea lo que verá el entrenador. Se puede marcar para
 * probar el puntaje, pero no hay alumno ni botón de guardar: solo cerrar.
 *
 * Se usa en dos sitios:
 *   - Dentro del formulario de crear/editar, con el borrador en memoria.
 *   - En la card de la lista (ojo), con la evaluación ya guardada y una
 *     sección más con sus disciplinas vinculadas.
 */
const EvaluacionPreview = ({
  titulo,
  descripcion,
  categoria,
  parametros,
  evaId,
  onCerrar,
}: Props) => {
  const vinculadas = useDisciplinasDeEvaluacion(evaId ?? null);
  const [paso, setPaso] = useState(0);
  // Claves por posición: un borrador puede traer parámetros sin id todavía.
  const [registros, setRegistros] = useState<Record<string, Registro>>({});

  const registro = (indice: number, intento: number): Registro =>
    registros[`${indice}:${intento}`] ?? vacio();

  const cambiar = (indice: number, intento: number, cambios: Partial<Registro>) =>
    setRegistros((previos) => ({
      ...previos,
      [`${indice}:${intento}`]: { ...registro(indice, intento), ...cambios },
    }));

  const puntajeParametro = (p: ParametroInput, indice: number) =>
    puntajeDeParametro(
      aVivo(p),
      numeros(p.evaparam_intentos).map((n) => aIntentoVivo(p, registro(indice, n))),
    );

  const completo = (p: ParametroInput, indice: number) =>
    numeros(p.evaparam_intentos).every((n) => estaRegistrado(p, registro(indice, n)));

  const total = parametros.reduce((s, p) => s + (p.evaparam_puntaje || 0), 0);
  const acumulado = parametros.reduce((s, p, i) => s + puntajeParametro(p, i), 0);
  const completos = parametros.filter(completo).length;
  const marcados = Object.keys(registros).length > 0;

  // El borrador puede perder parámetros mientras la vista previa está cerrada.
  const actual = Math.min(paso, Math.max(0, parametros.length - 1));
  const parametro = parametros[actual];

  return (
    <div className="space-y-5">
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

      <p className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
        <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Así la verá quien evalúe. Puedes marcar para probar el puntaje; nada se guarda.
      </p>

      {!parametro ? (
        <p className="rounded-md border border-dashed py-4 text-center text-sm text-muted-foreground">
          Sin parámetros configurados.
        </p>
      ) : (
        <section className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                Parámetro {actual + 1} de {parametros.length}
              </span>
              <span className="font-medium">
                {acumulado} / {total} pts
              </span>
            </div>
            <Progress value={(completos / parametros.length) * 100} />
          </div>

          <div>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h4 className="break-words font-medium">
                {parametro.evaparam_nombre || `Parámetro ${actual + 1}`}
              </h4>
              <span className="text-sm font-semibold">
                {puntajeParametro(parametro, actual)} / {parametro.evaparam_puntaje || 0} pts
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {METODOS[parametro.evatipometo_id]?.nombre ?? ''} · {parametro.evaparam_intentos}{' '}
              intento{parametro.evaparam_intentos === 1 ? '' : 's'}
            </p>
            {parametro.evaparam_nota && (
              <p className="mt-1 break-words rounded-md bg-muted/50 p-2 text-sm">
                {parametro.evaparam_nota}
              </p>
            )}
          </div>

          {numeros(parametro.evaparam_intentos).map((n) => (
            <div key={n} className="space-y-2 rounded-lg border p-3">
              <Label className="text-sm">
                {parametro.evaparam_intentos > 1 ? `Intento ${n}` : 'Resultado'}
              </Label>
              <CamposIntento
                parametro={parametro}
                intento={n}
                registro={registro(actual, n)}
                onCambiar={(cambios) => cambiar(actual, n, cambios)}
              />
            </div>
          ))}

          <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 sm:h-10 sm:flex-none"
                onClick={() => setPaso(Math.max(0, actual - 1))}
                disabled={actual === 0}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 sm:h-10 sm:flex-none"
                onClick={() => setPaso(Math.min(parametros.length - 1, actual + 1))}
                disabled={actual >= parametros.length - 1}
              >
                Siguiente
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              {marcados && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 sm:h-10"
                  onClick={() => setRegistros({})}
                >
                  Limpiar
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 sm:h-10 sm:flex-none"
                onClick={onCerrar}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </section>
      )}

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
