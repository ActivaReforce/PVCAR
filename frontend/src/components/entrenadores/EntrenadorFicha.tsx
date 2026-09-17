import { useState } from 'react';
import { AlertTriangle, Clock, GraduationCap, UserMinus, UserPlus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import {
  useAtarAuxiliar,
  useCandidatosAuxiliar,
  useCerrarAsignacion,
  useFichaEntrenador,
  useSoltarAuxiliar,
} from '@/hooks/useEntrenadores';

interface Props {
  entId: number;
  onAsignar: () => void;
}

const hhmm = (hora: string | null) => hora?.slice(0, 5) ?? '--:--';
const fecha = (f: string | null) => (f ? new Date(f).toLocaleDateString() : '—');

/**
 * Ficha del entrenador: sus disciplinas y sus auxiliares.
 *
 * Trae dos cosas que el sistema viejo no enseñaba:
 *
 *  - **El historial.** 39 de las 119 asignaciones están cerradas y no había
 *    ninguna pantalla que las mostrara, así que no se podía saber quién daba
 *    una disciplina en marzo — justo lo que se pregunta al revisar una
 *    asistencia vieja.
 *  - **Los auxiliares que ya no cuadran.** En los datos reales hay auxiliares
 *    cuyo usuario está de baja o que perdieron el rol; heredaban el alcance
 *    del titular en silencio.
 */
const EntrenadorFicha = ({ entId, onAsignar }: Props) => {
  const [historial, setHistorial] = useState(false);
  const [candidato, setCandidato] = useState('');

  const ficha = useFichaEntrenador(entId, historial);
  const candidatos = useCandidatosAuxiliar(true);
  const cerrar = useCerrarAsignacion();
  const atar = useAtarAuxiliar();
  const soltar = useSoltarAuxiliar();

  if (ficha.isLoading) {
    return <p className="py-6 text-center text-muted-foreground">Cargando ficha…</p>;
  }
  if (!ficha.data) {
    return <p className="py-6 text-center text-destructive">No se pudo cargar la ficha.</p>;
  }

  const { entrenador, asignaciones, auxiliares } = ficha.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant={entrenador.est_id === 1 ? 'default' : 'secondary'}>
          Ficha {entrenador.est_id === 1 ? 'activa' : 'inactiva'}
        </Badge>
        {entrenador.usuario_est_id !== 1 && (
          <Badge variant="outline" className="border-amber-500/60">
            Usuario dado de baja
          </Badge>
        )}
        {!entrenador.tiene_rol && (
          <Badge variant="outline" className="border-amber-500/60">
            Sin rol de Entrenador
          </Badge>
        )}
        <span className="text-muted-foreground">
          {entrenador.disciplinas} disciplinas · {entrenador.alumnos} alumnos
        </span>
      </div>

      {/* Disciplinas */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Disciplinas</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-9"
              onClick={() => setHistorial((v) => !v)}
            >
              {historial ? 'Ver solo las activas' : 'Ver historial completo'}
            </Button>
            <ConditionalAction module="entrenadores" action="editar">
              <Button variant="brand" size="sm" className="min-h-11 sm:min-h-9" onClick={onAsignar}>
                <UserPlus className="mr-2 h-4 w-4" />
                Asignar
              </Button>
            </ConditionalAction>
          </div>
        </div>

        {asignaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tiene disciplinas asignadas.</p>
        ) : (
          <ul className="space-y-2">
            {asignaciones.map((a) => {
              const cerrada = a.entasig_fecha_fin !== null;
              return (
                <li
                  key={a.entasig_id}
                  className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                    cerrada ? 'border-dashed bg-muted/40' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">{a.act_nombre}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.col_nombre} · {a.dia_nombre.toLowerCase()}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {hhmm(a.colacthor_hora_inicio)}–{hhmm(a.colacthor_hora_fin)}
                      </span>
                      <span className="flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" />
                        {a.alumnos} alumnos
                      </span>
                      <span>
                        Desde {fecha(a.entasig_fecha_inicio)}
                        {cerrada && ` · hasta ${fecha(a.entasig_fecha_fin)}`}
                      </span>
                    </p>
                    {a.disciplina_est_id !== 1 && !cerrada && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        La disciplina está dada de baja
                      </p>
                    )}
                  </div>

                  {!cerrada && (
                    <ConditionalAction module="entrenadores" action="editar">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full flex-shrink-0 text-destructive hover:text-destructive sm:w-auto"
                        disabled={cerrar.isPending}
                        onClick={() =>
                          cerrar.mutate({ id: entId, entasigId: a.entasig_id })
                        }
                      >
                        <X className="mr-2 h-4 w-4" />
                        Quitar
                      </Button>
                    </ConditionalAction>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Quitar una disciplina no borra nada: cierra la asignación con la fecha de hoy y queda en
          el historial.
        </p>
      </section>

      {/* Auxiliares */}
      <section className="space-y-3">
        <h3 className="font-semibold">Auxiliares</h3>

        {auxiliares.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tiene auxiliares.</p>
        ) : (
          <ul className="space-y-2">
            {auxiliares.map((aux) => (
              <li
                key={aux.entaux_id}
                className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                  aux.est_id !== 1 ? 'border-dashed bg-muted/40' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="break-words font-medium">{aux.usu_nombre}</p>
                  <p className="truncate text-sm text-muted-foreground">{aux.usu_correo}</p>
                  {(!aux.usuario_activo || !aux.tiene_rol_auxiliar) && (
                    <p className="mt-1 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      {!aux.usuario_activo && 'El usuario está dado de baja. '}
                      {!aux.tiene_rol_auxiliar && 'Ya no tiene el rol de Asistente ni de Respaldo.'}
                    </p>
                  )}
                </div>

                {aux.est_id === 1 && (
                  <ConditionalAction module="entrenadores" action="editar">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 w-full flex-shrink-0 text-destructive hover:text-destructive sm:w-auto"
                      disabled={soltar.isPending}
                      onClick={() => soltar.mutate({ id: entId, entauxId: aux.entaux_id })}
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      Soltar
                    </Button>
                  </ConditionalAction>
                )}
              </li>
            ))}
          </ul>
        )}

        <ConditionalAction module="entrenadores" action="editar">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={candidato} onValueChange={setCandidato}>
              <SelectTrigger className="h-11 sm:h-10">
                <SelectValue placeholder="Elige un asistente o respaldo" />
              </SelectTrigger>
              <SelectContent>
                {(candidatos.data ?? []).map((c) => (
                  <SelectItem key={c.usu_id} value={String(c.usu_id)}>
                    {c.usu_nombre} ({c.rol_id === 6 ? 'Asistente' : 'Respaldo'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="min-h-11 flex-shrink-0 sm:min-h-10"
              disabled={!candidato || atar.isPending}
              onClick={async () => {
                await atar.mutateAsync({ id: entId, usuId: Number(candidato) });
                setCandidato('');
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Atar auxiliar
            </Button>
          </div>
        </ConditionalAction>

        {candidatos.data && candidatos.data.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No hay candidatos libres: hay que darle el rol de Asistente o Respaldo Entrenador a
            alguien desde Usuarios, o soltarlo de su titular actual.
          </p>
        )}
      </section>
    </div>
  );
};

export default EntrenadorFicha;
