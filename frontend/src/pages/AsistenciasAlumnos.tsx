import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, History, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BarraGuardar from '@/components/asistencias/BarraGuardar';
import MiDiaAlumnos from '@/components/asistencias/MiDiaAlumnos';
import { usePermissions } from '@/hooks/usePermissions';
import FilaAsistencia from '@/components/asistencias/FilaAsistencia';
import HistorialDisciplina from '@/components/asistencias/HistorialDisciplina';
import ResumenAsistencia from '@/components/asistencias/ResumenAsistencia';
import { useColegiosVisibles } from '@/hooks/useColegios';
import { useDias, useDisciplinas } from '@/hooks/useDisciplinas';
import {
  useAsistenciaAlumnos,
  useContextoAsistencias,
  useGuardarAsistenciaAlumnos,
} from '@/hooks/useAsistencias';
import { useBorradorAsistencia, type FilaOriginal } from '@/hooks/useBorradorAsistencia';
import type { MarcaAlumno } from '@/api/asistencias';
import { ESTADO_ASISTENCIA } from '@/api/asistencias';
import type { Disciplina, HorarioDisciplina } from '@/api/disciplinas';

const TODOS = 'todos';

/** El `dia_id` de una fecha AAAA-MM-DD: 1=Lunes … 7=Domingo, como la tabla `dia`. */
function diaDe(fecha: string): number {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return dia === 0 ? 7 : dia;
}

/**
 * La última vez que cayó ese día de la semana, contando hoy.
 *
 * El sistema viejo proponía la **próxima**: abrías un martes una disciplina de
 * jueves y te ofrecía pasar lista de una clase que aún no había ocurrido. Se
 * propone la más reciente ya pasada, que es la que se viene a registrar.
 */
function ultimaFechaDe(diaId: number, hoy: string): string {
  const fecha = new Date(`${hoy}T00:00:00Z`);
  const atras = (diaDe(hoy) - diaId + 7) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - atras);
  return fecha.toISOString().slice(0, 10);
}

const enLetras = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const sinTildes = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Asistencia de alumnos.
 *
 * Entrada en dos modos: **Mi día** (tarjetas por clase de hoy en el alcance,
 * un tap para entrar) y **Selects** (colegio → día → disciplina → fecha, el
 * flujo largo para fechas pasadas y disciplinas ajenas al día). La elección es
 * del usuario: en cuanto hay disciplinas de hoy se le enseña Mi día y queda a
 * un botón de los selects.
 *
 * Dentro de la lista: buscador siempre arriba, barra de acción arriba y abajo,
 * y las reglas de siempre —fecha propuesta hacia atrás, lote en transacción,
 * alcance decidido en el servidor—.
 */
const AsistenciasAlumnos = () => {
  const { hasPermission } = usePermissions();
  const puedePasarLista = hasPermission('asistencias_estudiantes', 'editar');
  const contexto = useContextoAsistencias();
  const hoy = contexto.data?.hoy ?? '';
  const horaServidor = contexto.data?.hora ?? '';

  const [colegio, setColegio] = useState('');
  const [dia, setDia] = useState(TODOS);
  const [disciplina, setDisciplina] = useState('');
  const [fecha, setFecha] = useState('');
  const [verHistorial, setVerHistorial] = useState(false);
  const [vistaInicio, setVistaInicio] = useState<'mi-dia' | 'selects'>('mi-dia');
  const [buscar, setBuscar] = useState('');

  const colegios = useColegiosVisibles();
  const dias = useDias();

  const disciplinas = useDisciplinas({
    limit: 200,
    orden: 'horario',
    estado: 1,
    colegio: colegio ? [Number(colegio)] : undefined,
    dia: dia === TODOS ? undefined : Number(dia),
  });

  /** Disciplinas del día de hoy en el alcance, para Mi día. */
  const diaHoy = hoy ? diaDe(hoy) : null;
  const clasesHoy = useDisciplinas(
    { limit: 200, orden: 'horario', estado: 1, dia: diaHoy ?? undefined },
    diaHoy !== null,
  );

  /** Con un solo colegio en el alcance —el caso del entrenador— se elige solo. */
  const items = colegios.data?.items;
  useEffect(() => {
    if (!colegio && items?.length === 1) setColegio(String(items[0].col_id));
  }, [colegio, items]);

  /** El día por defecto es el de hoy, en cuanto el servidor dice cuál es. */
  useEffect(() => {
    if (hoy && dia === TODOS) setDia(String(diaDe(hoy)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoy]);

  const elegida = (disciplinas.data?.items ?? []).find(
    (d) => String(d.colacthor_id) === disciplina,
  );

  /**
   * Al cambiar de disciplina se propone su última sesión pasada. Una
   * disciplina tiene varios días: si el filtro de día es uno de ellos, la de
   * ese día; si no, la más reciente de cualquiera de sus días.
   */
  useEffect(() => {
    if (!elegida || !hoy) return;
    const suyos = elegida.horarios.map((h) => h.dia_id);
    const candidatos = dia !== TODOS && suyos.includes(Number(dia)) ? [Number(dia)] : suyos;
    const fechas = candidatos.map((d) => ultimaFechaDe(d, hoy)).sort();
    if (fechas.length > 0) setFecha(fechas[fechas.length - 1]!);
    // El filtro de día solo cuenta al elegir la disciplina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegida, hoy]);

  /** Toque en una tarjeta de Mi día: elige colegio, día, disciplina y fecha. */
  const elegirDeMiDia = (d: Disciplina, horario: HorarioDisciplina) => {
    setColegio(String(d.col_id));
    setDia(String(horario.dia_id));
    setDisciplina(String(d.colacthor_id));
    setFecha(hoy);
    setBuscar('');
  };

  const volverAMiDia = () => {
    setDisciplina('');
    setFecha('');
    setBuscar('');
    setVistaInicio('mi-dia');
  };

  /** El horario de la clase de esa fecha, si cae en uno de sus días. */
  const deEseDia =
    elegida && fecha !== '' ? elegida.horarios.find((h) => h.dia_id === diaDe(fecha)) : undefined;
  const fechaCuadra = deEseDia !== undefined;
  const susDias = (elegida?.horarios ?? []).map((h) => h.dia_nombre.toLowerCase());
  const susDiasTexto =
    susDias.length > 1 ? `${susDias.slice(0, -1).join(', ')} y ${susDias.at(-1)}` : (susDias[0] ?? '');

  const lista = useAsistenciaAlumnos(
    elegida && fechaCuadra ? elegida.colacthor_id : null,
    fechaCuadra ? fecha : null,
  );

  const alumnos = useMemo(() => lista.data?.alumnos ?? [], [lista.data]);

  const filas: FilaOriginal[] = useMemo(
    () =>
      alumnos.map((a) => ({
        clave: String(a.nino_id),
        asisest_id: a.asisest_id,
        hora_tarde: a.hora_tarde,
        razon: a.razon,
      })),
    [alumnos],
  );

  const borrador = useBorradorAsistencia(filas, `${disciplina}|${fecha}`);
  const guardar = useGuardarAsistenciaAlumnos();

  const alumnosFiltrados = useMemo(() => {
    const q = sinTildes(buscar.trim());
    if (q === '') return alumnos;
    return alumnos.filter((a) => {
      const n = sinTildes(a.nino_nombre);
      const g = sinTildes(a.catninograd_nombre ?? '');
      return n.includes(q) || g.includes(q);
    });
  }, [alumnos, buscar]);

  const enviar = (marcarRestantes: boolean) => {
    if (!elegida) return;

    const marcas: MarcaAlumno[] = borrador.envio(marcarRestantes).map(({ clave, marca }) => ({
      nino_id: Number(clave),
      asisest_id: marca.asisest_id as number,
      hora_tarde: marca.asisest_id === ESTADO_ASISTENCIA.TARDE ? marca.hora : null,
      razon:
        marca.asisest_id === ESTADO_ASISTENCIA.JUSTIFICADO ? marca.razon.trim() : null,
    }));

    if (marcas.length === 0) return;
    if (marcarRestantes) borrador.presenteALosQueFaltan();
    guardar.mutate({ colacthorId: elegida.colacthor_id, fecha, marcas });
  };

  const mostrarMiDia =
    !elegida &&
    vistaInicio === 'mi-dia' &&
    (clasesHoy.isLoading || (clasesHoy.data?.items?.length ?? 0) > 0);
  const mostrarSelects = !mostrarMiDia;

  return (
    <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Asistencia de Alumnos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige la clase y la fecha, marca y guarda todo de una vez.
        </p>
      </div>

      {mostrarMiDia && diaHoy !== null && (
        <MiDiaAlumnos
          disciplinas={clasesHoy.data?.items ?? []}
          diaHoy={diaHoy}
          ahora={horaServidor}
          cargando={clasesHoy.isLoading}
          onElegir={elegirDeMiDia}
          onOtraClase={() => setVistaInicio('selects')}
        />
      )}

      {mostrarSelects && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="colegio">Colegio</Label>
            <Select
              value={colegio}
              onValueChange={(v) => {
                setColegio(v);
                setDisciplina('');
              }}
            >
              <SelectTrigger id="colegio" className="h-11 sm:h-10">
                <SelectValue placeholder="Seleccionar colegio" />
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

          <div className="space-y-1">
            <Label htmlFor="dia">Día</Label>
            <Select
              value={dia}
              onValueChange={(v) => {
                setDia(v);
                setDisciplina('');
              }}
            >
              <SelectTrigger id="dia" className="h-11 sm:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los días</SelectItem>
                {(dias.data ?? []).map((d) => (
                  <SelectItem key={d.dia_id} value={String(d.dia_id)}>
                    {d.dia_nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="disciplina">Disciplina</Label>
            <Select value={disciplina} onValueChange={setDisciplina} disabled={!colegio}>
              <SelectTrigger id="disciplina" className="h-11 sm:h-10">
                <SelectValue placeholder={colegio ? 'Seleccionar disciplina' : 'Elige un colegio'} />
              </SelectTrigger>
              <SelectContent>
                {(disciplinas.data?.items ?? []).map((d) => (
                  <SelectItem key={d.colacthor_id} value={String(d.colacthor_id)}>
                    {d.act_nombre} · {d.horario_texto ?? ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              value={fecha}
              max={hoy || undefined}
              disabled={!elegida}
              onChange={(evento) => setFecha(evento.target.value)}
              className="h-11 sm:h-10"
            />
          </div>
        </div>
      )}

      {mostrarSelects && (clasesHoy.data?.items?.length ?? 0) > 0 && !elegida && (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setVistaInicio('mi-dia')}
            className="h-9 px-2 text-muted-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver a mis clases de hoy
          </Button>
        </div>
      )}

      {elegida && fecha !== '' && !fechaCuadra && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {elegida.act_nombre} es de los {susDiasTexto} y el {enLetras(fecha)} no lo es. Elige
          una fecha que caiga en uno de esos días.
        </p>
      )}

      {mostrarSelects && !elegida && (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <CalendarClock className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="text-lg">Elige una disciplina para pasar lista</p>
          {disciplinas.data?.items.length === 0 && colegio && (
            <p className="mt-2 text-sm">
              No hay disciplinas activas para ese colegio y ese día dentro de tu alcance.
            </p>
          )}
        </div>
      )}

      {elegida && fechaCuadra && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">
                {elegida.act_nombre} · {lista.data?.sesion.col_nombre ?? elegida.col_nombre}
              </h2>
              <p className="text-sm text-muted-foreground">
                {enLetras(fecha)}
                {deEseDia && ` · ${deEseDia.inicio}–${deEseDia.fin}`}
              </p>
            </div>

            <div className="flex gap-2">
              {(clasesHoy.data?.items?.length ?? 0) > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 sm:h-10"
                  onClick={volverAMiDia}
                  title="Volver a mis clases de hoy"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Hoy
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-10"
                onClick={() => setVerHistorial(true)}
              >
                <History className="mr-2 h-4 w-4" />
                Historial
              </Button>
            </div>
          </div>

          {lista.isLoading && (
            <p className="py-12 text-center text-muted-foreground">Cargando la lista…</p>
          )}

          {lista.isError && (
            <p className="py-12 text-center text-destructive">
              {(lista.error as Error).message}
            </p>
          )}

          {lista.data && (
            <>
              <ResumenAsistencia resumen={lista.data.resumen} />

              {alumnos.length === 0 ? (
                <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
                  <p className="text-lg">No hay alumnos inscritos en esa fecha</p>
                </div>
              ) : (
                <>
                  {puedePasarLista && (
                    <BarraGuardar
                      posicion="arriba"
                      sinMarcar={
                        Object.values(borrador.marcas).filter((m) => m.asisest_id === null).length
                      }
                      cambios={borrador.sucias.length}
                      incompletas={borrador.incompletas.length}
                      guardando={guardar.isPending}
                      onDeshacer={borrador.deshacer}
                      onGuardar={enviar}
                    />
                  )}

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      value={buscar}
                      onChange={(evento) => setBuscar(evento.target.value)}
                      placeholder="Buscar por nombre o grado"
                      aria-label="Buscar alumno"
                      className="h-11 pl-9 sm:h-10"
                    />
                  </div>

                  <fieldset disabled={!puedePasarLista} className="min-w-0">
                    {!puedePasarLista && (
                      <p className="mb-2 text-sm text-muted-foreground">
                        Solo consulta: no tienes permiso para pasar lista.
                      </p>
                    )}
                    <ul className="divide-y overflow-hidden rounded-lg border">
                      {alumnosFiltrados.length === 0 ? (
                        <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                          Nadie coincide con «{buscar}».
                        </li>
                      ) : (
                        alumnosFiltrados.map((alumno) => {
                          const clave = String(alumno.nino_id);
                          const marca = borrador.marcas[clave];
                          if (!marca) return null;

                          return (
                            <FilaAsistencia
                              key={clave}
                              clave={clave}
                              nombre={alumno.nino_nombre}
                              fotoUrl={alumno.nino_foto_url}
                              detalle={alumno.catninograd_nombre}
                              aviso={
                                alumno.inscrito
                                  ? null
                                  : 'Ya no está inscrito en esta disciplina; sale porque tiene asistencia registrada ese día'
                              }
                              marca={marca}
                              sucia={borrador.sucias.includes(clave)}
                              incompleta={borrador.incompletas.includes(clave)}
                              registro={{ por: alumno.registrado_por, en: alumno.registrado_en }}
                              horaServidor={lista.data.hora_servidor}
                              onEstado={borrador.elegirEstado}
                              onHora={borrador.escribirHora}
                              onRazon={borrador.escribirRazon}
                            />
                          );
                        })
                      )}
                    </ul>
                  </fieldset>
                </>
              )}

              {puedePasarLista && alumnos.length > 0 && (
                <BarraGuardar
                  posicion="abajo"
                  sinMarcar={
                    Object.values(borrador.marcas).filter((m) => m.asisest_id === null).length
                  }
                  cambios={borrador.sucias.length}
                  incompletas={borrador.incompletas.length}
                  guardando={guardar.isPending}
                  onDeshacer={borrador.deshacer}
                  onGuardar={enviar}
                />
              )}
            </>
          )}
        </>
      )}

      <Dialog open={verHistorial} onOpenChange={setVerHistorial}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="break-words text-lg sm:text-xl">
              Historial de {elegida?.act_nombre}
            </DialogTitle>
          </DialogHeader>
          {elegida && (
            <HistorialDisciplina
              disciplina={elegida.colacthor_id}
              onAbrirFecha={(f) => {
                setFecha(f);
                setVerHistorial(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AsistenciasAlumnos;
