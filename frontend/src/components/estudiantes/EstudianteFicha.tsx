import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock, HeartPulse, UserMinus, UserPlus, Users, X } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import type { EstudianteDetalle } from '@/api/estudiantes';
import {
  useAtarRepresentante,
  useCandidatosRepresentante,
  useDisponiblesEstudiante,
  useFichaEstudiante,
  useGuardarInscripciones,
  useSoltarRepresentante,
} from '@/hooks/useEstudiantes';
import { primerCruce } from '@/lib/horarios';
import { fechaDia } from '@/lib/fecha';

interface Props {
  ninoId: number;
}

interface RepALiberar {
  ninopadreId: number;
  nombre: string;
}

const fecha = fechaDia;

/**
 * Ficha del estudiante: datos personales, inscripciones y representantes.
 *
 * Reestructurada el 2026-10-15 (pedido del cliente):
 *   1. Datos del niño y transporte, con los **tres permisos de imagen** en
 *      el orden del formulario público (verde si los dio, rojo si no).
 *   2. Información de salud, en ámbar.
 *   3. Representante del contrato, contacto de emergencia y persona
 *      autorizada para retirar.
 *   4. Inscribir o dar de baja (una sola lista con casillas).
 *   5. Representantes atados, con confirmación al soltar.
 *
 * Las inscripciones se editan **marcando casillas** sobre las disciplinas de
 * su colegio y guardando una vez: el backend calcula la diferencia e inscribe
 * o da de baja en una transacción.
 */
const EstudianteFicha = ({ ninoId }: Props) => {
  const [seleccion, setSeleccion] = useState<number[] | null>(null);
  const [candidato, setCandidato] = useState('');
  const [aSoltar, setASoltar] = useState<RepALiberar | null>(null);

  const ficha = useFichaEstudiante(ninoId, false);
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

  // Aviso antes de guardar: el backend rechaza dos disciplinas que se pisan.
  const horariosDe = new Map(
    [...inscripciones, ...(disponibles.data ?? [])].map((d) => [
      d.colacthor_id,
      { nombre: d.act_nombre, horarios: d.horarios },
    ]),
  );
  const cruce = primerCruce(
    marcadas.map((id) => horariosDe.get(id)).filter((d) => d !== undefined),
  );

  const alternar = (colacthorId: number) => {
    const base = seleccion ?? activas;
    setSeleccion(
      base.includes(colacthorId)
        ? base.filter((id) => id !== colacthorId)
        : [...base, colacthorId],
    );
  };

  const confirmarSoltar = async () => {
    if (!aSoltar) return;
    try {
      await soltar.mutateAsync({ id: ninoId, ninopadreId: aSoltar.ninopadreId });
      setASoltar(null);
    } catch {
      // El hook ya enseña el toast.
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Datos del alumno */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant={estudiante.est_id === 1 ? 'default' : 'secondary'}>
            {estudiante.est_id === 1 ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Dato etiqueta="Colegio" valor={estudiante.col_nombre} />
          <Dato etiqueta="Grado" valor={estudiante.catninograd_nombre} />
          <Dato
            etiqueta="Edad"
            valor={estudiante.nino_edad != null ? `${estudiante.nino_edad} años` : null}
          />
          <Dato
            etiqueta="Transporte"
            valor={
              estudiante.nino_modalidad_salida === 'escolar'
                ? 'Escolar'
                : estudiante.nino_modalidad_salida === 'privado'
                  ? 'Privado'
                  : null
            }
          />
        </dl>

        <PermisosDeImagen e={estudiante} />
      </section>

      {/* 2. Salud en ámbar */}
      {estudiante.nino_info_salud && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <HeartPulse className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="font-medium">Información de salud</p>
            <p className="break-words">{estudiante.nino_info_salud}</p>
          </div>
        </div>
      )}

      {/* 3. Representante del contrato · emergencia · retiro */}
      {(estudiante.contacto_emergencia || estudiante.contacto_retiro || estudiante.nino_detalle_retiro) && (
        <section className="space-y-2">
          <h3 className="font-semibold">Contactos</h3>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {estudiante.contacto_emergencia && (
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contacto de emergencia
                </dt>
                <dd className="break-words">
                  {estudiante.contacto_emergencia.nombre} ({estudiante.contacto_emergencia.relacion}) ·{' '}
                  {estudiante.contacto_emergencia.telefono}
                </dd>
              </div>
            )}
            {estudiante.contacto_retiro && (
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Autorizado para retirarlo
                </dt>
                <dd className="break-words">
                  {estudiante.contacto_retiro.nombre} ({estudiante.contacto_retiro.relacion}) · C.C.{' '}
                  {estudiante.contacto_retiro.cedula} · {estudiante.contacto_retiro.telefono}
                </dd>
              </div>
            )}
            {estudiante.nino_detalle_retiro && (
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Instrucciones de retiro
                </dt>
                <dd className="break-words">{estudiante.nino_detalle_retiro}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* 4. Inscribir o dar de baja */}
      <section className="space-y-3">
        <h3 className="font-semibold">Disciplinas</h3>

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
                    <span className="min-w-0 flex-1 break-words text-sm">
                      {i.act_nombre} · {i.horario_texto}
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
                  <span className="min-w-0 flex-1 break-words text-sm">
                    {d.act_nombre} · {d.horario_texto}
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

            {hayCambios && cruce && (
              <p className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {cruce}: no puede estar en las dos.
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              {hayCambios && (
                <Button variant="outline" size="sm" onClick={() => setSeleccion(null)}>
                  Descartar
                </Button>
              )}
              <Button
                variant="brand"
                size="sm"
                disabled={!hayCambios || Boolean(cruce) || guardar.isPending}
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

      {/* 5. Representantes */}
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
                    onClick={() =>
                      setASoltar({ ninopadreId: r.ninopadre_id, nombre: r.usu_nombre })
                    }
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
            Representante.
          </p>
        )}
      </section>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Creado el {fecha(estudiante.nino_fecha_creacion)}
        {estudiante.nino_fecha_modificacion &&
          ` · modificado el ${fecha(estudiante.nino_fecha_modificacion)}`}
      </p>

      <AlertDialog
        open={aSoltar !== null}
        onOpenChange={(v) => (!v ? setASoltar(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Soltar a {aSoltar?.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de ser representante de este alumno. Sus datos de usuario se quedan intactos;
              para volver a atarlo, elígelo abajo y pulsa "Atar".
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

const Dato = ({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) => (
  <div className="flex min-w-0 flex-wrap gap-x-2">
    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {etiqueta}
    </dt>
    <dd className="break-words">{valor && valor.trim() !== '' ? valor : '—'}</dd>
  </div>
);

const PERMISOS_IMAGEN = [
  ['nino_imagen_familias', 'Compartir con las familias del grupo'],
  ['nino_imagen_redes', 'Publicar en redes sociales de ACTIVA'],
  ['nino_imagen_promocional', 'Material institucional o promocional'],
] as const;

/**
 * Los tres permisos de imagen, en el orden del formulario público. Verde con
 * check cuando lo autorizó, rojo con X cuando no (sin respuesta se trata
 * como no, para no asumir permisos). Pedido del cliente (2026-10-15).
 */
const PermisosDeImagen = ({ e }: { e: EstudianteDetalle }) => (
  <div className="space-y-1.5">
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      Permisos de imagen
    </p>
    <ul className="space-y-1">
      {PERMISOS_IMAGEN.map(([clave, texto]) => {
        const si = e[clave] === true;
        return (
          <li key={clave} className="flex items-start gap-2 text-sm">
            {si ? (
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
            )}
            <span className={si ? '' : 'text-destructive'}>{texto}</span>
          </li>
        );
      })}
    </ul>
  </div>
);

export default EstudianteFicha;
