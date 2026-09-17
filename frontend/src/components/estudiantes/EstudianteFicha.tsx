import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, HeartPulse, UserMinus, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import {
  useAtarRepresentante,
  useCandidatosRepresentante,
  useDisponiblesEstudiante,
  useFichaEstudiante,
  useGuardarInscripciones,
  useSoltarRepresentante,
} from '@/hooks/useEstudiantes';

interface Props {
  ninoId: number;
}

const hhmm = (hora: string | null) => hora?.slice(0, 5) ?? '--:--';
const fecha = (f: string | null) => (f ? new Date(f).toLocaleDateString() : '—');

/**
 * Ficha del estudiante: datos sensibles, inscripciones y representantes.
 *
 * Las inscripciones se editan **marcando casillas** sobre las disciplinas de
 * su colegio y guardando una vez: el backend calcula la diferencia e inscribe
 * o da de baja en una transacción. El sistema viejo hacía un insert o un
 * update por cada clic, sin transacción y sin comprobar que la disciplina
 * fuera de su colegio.
 */
const EstudianteFicha = ({ ninoId }: Props) => {
  const [historial, setHistorial] = useState(false);
  const [seleccion, setSeleccion] = useState<number[] | null>(null);
  const [candidato, setCandidato] = useState('');

  const ficha = useFichaEstudiante(ninoId, historial);
  const disponibles = useDisponiblesEstudiante(ninoId);
  const candidatos = useCandidatosRepresentante(true);
  const guardar = useGuardarInscripciones();
  const atar = useAtarRepresentante();
  const soltar = useSoltarRepresentante();

  const activas = (ficha.data?.inscripciones ?? [])
    .filter((i) => i.est_id === 1)
    .map((i) => i.colacthor_id);

  // La selección arranca de lo que ya tiene; se reinicia al cambiar de ficha.
  useEffect(() => {
    setSeleccion(null);
  }, [ninoId]);

  const marcadas = seleccion ?? activas;
  const hayCambios =
    seleccion !== null &&
    (seleccion.length !== activas.length || seleccion.some((id) => !activas.includes(id)));

  if (ficha.isLoading) {
    return <p className="py-6 text-center text-muted-foreground">Cargando ficha…</p>;
  }
  if (!ficha.data) {
    return <p className="py-6 text-center text-destructive">No se pudo cargar la ficha.</p>;
  }

  const { estudiante, inscripciones, representantes } = ficha.data;

  const alternar = (colacthorId: number) => {
    const base = seleccion ?? activas;
    setSeleccion(
      base.includes(colacthorId)
        ? base.filter((id) => id !== colacthorId)
        : [...base, colacthorId],
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant={estudiante.est_id === 1 ? 'default' : 'secondary'}>
          {estudiante.est_id === 1 ? 'Activo' : 'Inactivo'}
        </Badge>
        <span className="text-muted-foreground">
          {estudiante.col_nombre}
          {estudiante.catninograd_nombre && ` · ${estudiante.catninograd_nombre}`}
          {estudiante.nino_edad && ` · ${estudiante.nino_edad} años`}
          {estudiante.nino_cedula && ` · ${estudiante.nino_cedula}`}
        </span>
        {estudiante.nino_toma_transporte && <Badge variant="outline">Toma transporte</Badge>}
      </div>

      {estudiante.nino_info_salud && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <HeartPulse className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="font-medium">Información de salud</p>
            <p className="break-words">{estudiante.nino_info_salud}</p>
          </div>
        </div>
      )}

      {estudiante.nino_otra_info && (
        <p className="break-words text-sm text-muted-foreground">{estudiante.nino_otra_info}</p>
      )}

      {/* Inscripciones */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Disciplinas</h3>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-9"
            onClick={() => setHistorial((v) => !v)}
          >
            {historial ? 'Ver solo las activas' : 'Ver historial completo'}
          </Button>
        </div>

        {inscripciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No está inscrito en ninguna disciplina.</p>
        ) : (
          <ul className="space-y-2">
            {inscripciones.map((i) => {
              const cerrada = i.est_id !== 1;
              return (
                <li
                  key={i.ninoasig_id}
                  className={`rounded-lg border p-3 ${cerrada ? 'border-dashed bg-muted/40' : ''}`}
                >
                  <p className="break-words font-medium">{i.act_nombre}</p>
                  <p className="text-sm text-muted-foreground">
                    {i.dia_nombre.toLowerCase()} · {hhmm(i.colacthor_hora_inicio)}–
                    {hhmm(i.colacthor_hora_fin)} · {i.entrenador ?? 'sin entrenador'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Inscrito el {fecha(i.ninoasig_fecha_inscripcion)}
                    {cerrada && ` · baja el ${fecha(i.ninoasig_fecha_baja)}`}
                  </p>
                  {i.disciplina_est_id !== 1 && !cerrada && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      La disciplina está dada de baja
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Editar inscripciones: casillas sobre las disciplinas de su colegio */}
        <ConditionalAction module="estudiantes" action="editar">
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Inscribir o dar de baja</p>

            {disponibles.isLoading && (
              <p className="text-sm text-muted-foreground">Cargando disciplinas…</p>
            )}

            <div className="space-y-1.5">
              {inscripciones
                .filter((i) => i.est_id === 1)
                .map((i) => (
                  <label
                    key={i.colacthor_id}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-accent"
                  >
                    <Checkbox
                      checked={marcadas.includes(i.colacthor_id)}
                      onCheckedChange={() => alternar(i.colacthor_id)}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {i.act_nombre} · {i.dia_nombre.toLowerCase()}{' '}
                      {hhmm(i.colacthor_hora_inicio)}
                    </span>
                  </label>
                ))}

              {(disponibles.data ?? []).map((d) => (
                <label
                  key={d.colacthor_id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-accent"
                >
                  <Checkbox
                    checked={marcadas.includes(d.colacthor_id)}
                    onCheckedChange={() => alternar(d.colacthor_id)}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {d.act_nombre} · {d.dia_nombre.toLowerCase()} {hhmm(d.colacthor_hora_inicio)}
                    <span className="text-muted-foreground">
                      {' '}
                      · {d.alumnos} alumnos
                      {d.entrenador ? ` · ${d.entrenador}` : ' · sin entrenador'}
                    </span>
                  </span>
                  {d.fue_inscrito && (
                    <Badge variant="outline" className="flex-shrink-0 text-xs">
                      estuvo antes
                    </Badge>
                  )}
                </label>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              {hayCambios && (
                <Button variant="outline" size="sm" onClick={() => setSeleccion(null)}>
                  Descartar
                </Button>
              )}
              <Button
                variant="brand"
                size="sm"
                disabled={!hayCambios || guardar.isPending}
                onClick={async () => {
                  await guardar.mutateAsync({ id: ninoId, colacthorIds: marcadas });
                  setSeleccion(null);
                }}
              >
                {guardar.isPending ? 'Guardando…' : 'Guardar inscripciones'}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Al inscribirlo se le crean sus evaluaciones pendientes de esa disciplina. Darlo de
              baja no borra nada: la inscripción queda cerrada con fecha.
            </p>
          </div>
        </ConditionalAction>
      </section>

      {/* Representantes */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4" />
          Representantes
        </h3>

        {representantes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tiene representantes registrados.</p>
        ) : (
          <ul className="space-y-2">
            {representantes.map((r) => (
              <li
                key={r.ninopadre_id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium">{r.usu_nombre}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {r.usu_correo}
                    {r.usu_telefono && ` · ${r.usu_telefono}`}
                  </p>
                  {!r.usuario_activo && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      El usuario está dado de baja
                    </p>
                  )}
                </div>
                <ConditionalAction module="estudiantes" action="editar">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 w-full flex-shrink-0 text-destructive hover:text-destructive sm:w-auto"
                    disabled={soltar.isPending}
                    onClick={() => soltar.mutate({ id: ninoId, ninopadreId: r.ninopadre_id })}
                  >
                    <UserMinus className="mr-2 h-4 w-4" />
                    Soltar
                  </Button>
                </ConditionalAction>
              </li>
            ))}
          </ul>
        )}

        <ConditionalAction module="estudiantes" action="editar">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={candidato} onValueChange={setCandidato}>
              <SelectTrigger className="h-11 sm:h-10">
                <SelectValue placeholder="Elige un representante" />
              </SelectTrigger>
              <SelectContent>
                {(candidatos.data ?? []).map((c) => (
                  <SelectItem key={c.usu_id} value={String(c.usu_id)}>
                    {c.usu_nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="min-h-11 flex-shrink-0 sm:min-h-10"
              disabled={!candidato || atar.isPending}
              onClick={async () => {
                await atar.mutateAsync({ id: ninoId, usuId: Number(candidato) });
                setCandidato('');
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Atar
            </Button>
          </div>
        </ConditionalAction>

        {candidatos.data && candidatos.data.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No hay representantes dados de alta. Se crean desde Usuarios, con el rol de
            Representante. Hoy no hay ninguno en el sistema.
          </p>
        )}
      </section>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Creado el {fecha(estudiante.nino_fecha_creacion)}
        {estudiante.nino_fecha_modificacion &&
          ` · modificado el ${fecha(estudiante.nino_fecha_modificacion)}`}
      </p>
    </div>
  );
};

export default EstudianteFicha;
