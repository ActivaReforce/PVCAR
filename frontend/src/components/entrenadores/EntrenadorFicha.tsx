import { useState } from 'react';
import { AlertTriangle, Clock, GraduationCap, UserMinus, UserPlus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  useFichaEntrenador,
  useSoltarAuxiliar,
} from '@/hooks/useEntrenadores';
import { fechaDia } from '@/lib/fecha';

interface Props {
  entId: number;
  onAsignar: () => void;
}

const fecha = fechaDia;

interface AuxiliarALiberar {
  entauxId: number;
  nombre: string;
}

/**
 * Ficha del entrenador: datos, sus disciplinas y sus auxiliares.
 *
 * El modal es de **solo lectura** para las disciplinas (pedido del cliente,
 * 2026-10-15): el botón "Asignar" lleva al modal específico, que es donde se
 * añaden y se quitan. Aquí ya no sale el "Quitar" por fila ni el "Ver
 * historial completo" — simplifica y evita cerrar algo pulsando en el modal
 * equivocado.
 *
 * Los auxiliares sí se gestionan desde aquí (atar y soltar) con confirmación
 * para soltar.
 */
const EntrenadorFicha = ({ entId, onAsignar }: Props) => {
  const [candidato, setCandidato] = useState('');
  const [aLiberar, setALiberar] = useState<AuxiliarALiberar | null>(null);

  const ficha = useFichaEntrenador(entId, false);
  const candidatos = useCandidatosAuxiliar(true);
  const atar = useAtarAuxiliar();
  const soltar = useSoltarAuxiliar();

  if (ficha.isLoading) {
    return <p className="py-6 text-center text-muted-foreground">Cargando ficha…</p>;
  }
  if (!ficha.data) {
    return <p className="py-6 text-center text-destructive">No se pudo cargar la ficha.</p>;
  }

  const { entrenador, asignaciones, auxiliares } = ficha.data;
  const activa = entrenador.est_id === 1;

  /* Por colegio, en el orden en que llegan (el backend ya las ordena). */
  const porColegio = new Map<string, typeof asignaciones>();
  for (const a of asignaciones) {
    porColegio.set(a.col_nombre, [...(porColegio.get(a.col_nombre) ?? []), a]);
  }
  const variosColegios = porColegio.size > 1;

  const fila = (a: (typeof asignaciones)[number]) => (
    <li
      key={a.entasig_id}
      className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="break-words font-medium">{a.act_nombre}</p>
        {!variosColegios && <p className="text-sm text-muted-foreground">{a.col_nombre}</p>}
        <p className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {a.horario_texto}
          </span>
          <span className="flex items-center gap-1">
            <GraduationCap className="h-3 w-3" />
            {a.alumnos} alumnos
          </span>
          <span>Desde {fecha(a.entasig_fecha_inicio)}</span>
        </p>
        {a.disciplina_est_id !== 1 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            La disciplina está dada de baja
          </p>
        )}
      </div>
    </li>
  );

  const confirmarSoltar = async () => {
    if (!aLiberar) return;
    try {
      await soltar.mutateAsync({ id: entId, entauxId: aLiberar.entauxId });
      setALiberar(null);
    } catch {
      // El hook ya enseña el toast.
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant={activa ? 'default' : 'secondary'}>
          Ficha {activa ? 'activa' : 'inactiva'}
        </Badge>
        <span className="text-muted-foreground">
          {entrenador.disciplinas} disciplinas · {entrenador.alumnos} alumnos
        </span>
      </div>

      {/* Datos de contacto (2026-10-15): lo que salía en la lista como columna
          ahora vive solo aquí. */}
      {(entrenador.usu_cedula || entrenador.usu_telefono || entrenador.usu_correo) && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {entrenador.usu_cedula && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Cédula</dt>
              <dd className="break-words">{entrenador.usu_cedula}</dd>
            </div>
          )}
          {entrenador.usu_telefono && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd className="break-words">{entrenador.usu_telefono}</dd>
            </div>
          )}
          {entrenador.usu_correo && (
            <div className="flex min-w-0 gap-2 sm:col-span-2">
              <dt className="text-muted-foreground">Correo</dt>
              <dd className="min-w-0 truncate" title={entrenador.usu_correo}>
                {entrenador.usu_correo}
              </dd>
            </div>
          )}
        </dl>
      )}

      {/* Disciplinas (solo lectura) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Disciplinas</h3>
          {activa && (
            <ConditionalAction module="entrenadores" action="editar">
              <Button variant="brand" size="sm" className="min-h-11 sm:min-h-9" onClick={onAsignar}>
                <UserPlus className="mr-2 h-4 w-4" />
                Asignar
              </Button>
            </ConditionalAction>
          )}
        </div>

        {asignaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tiene disciplinas asignadas.</p>
        ) : variosColegios ? (
          <div className="space-y-4">
            {[...porColegio.entries()].map(([colegio, lista]) => (
              <div key={colegio} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {colegio} · {lista.length}
                </p>
                <ul className="space-y-2">{lista.map(fila)}</ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-2">{asignaciones.map(fila)}</ul>
        )}
        <p className="text-xs text-muted-foreground">
          Para añadir o quitar disciplinas, pulsa <strong>Asignar</strong>.
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
                </div>

                {aux.est_id === 1 && (
                  <ConditionalAction module="entrenadores" action="editar">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 w-full flex-shrink-0 text-destructive hover:text-destructive sm:w-auto"
                      disabled={soltar.isPending}
                      onClick={() =>
                        setALiberar({ entauxId: aux.entaux_id, nombre: aux.usu_nombre })
                      }
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

      {/* Confirmación para soltar un auxiliar (pedido del cliente, 2026-10-15). */}
      <AlertDialog
        open={aLiberar !== null}
        onOpenChange={(v) => (!v ? setALiberar(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Soltar a {aLiberar?.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de ver y de poder trabajar en las disciplinas de este entrenador. Las
              asistencias que registró como auxiliar se quedan en su nombre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={soltar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarSoltar}
              disabled={soltar.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {soltar.isPending ? 'Soltando…' : 'Soltar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EntrenadorFicha;
